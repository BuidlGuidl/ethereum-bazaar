import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Hex, decodeAbiParameters, formatUnits, zeroAddress } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { resolveIpfsUrl } from "~~/services/ipfs/fetch";

export interface ListingCardProps {
  id: string | number;
  title: string;
  imageUrl?: string | null;
  tags?: string[];
  priceWei?: string | bigint | null;
  tokenSymbol?: string | null;
  tokenDecimals?: number | null;
}

export const ListingCard = ({
  id,
  title,
  imageUrl,
  tags = [],
  priceWei: priceWeiProp,
  tokenSymbol: tokenSymbolProp,
  tokenDecimals: tokenDecimalsProp,
}: ListingCardProps) => {
  const resolved = resolveIpfsUrl(imageUrl) || imageUrl;
  const idBig = useMemo(() => BigInt(typeof id === "number" ? id : id.toString()), [id]);
  const { data: listingRes } = useScaffoldReadContract({
    contractName: "Marketplace",
    functionName: "getListing",
    args: [idBig],
    watch: true,
  } as any);
  const listingDataBytes = useMemo(() => (listingRes ? (listingRes as any)[1] : undefined), [listingRes]);
  const { priceWei, tokenSymbol, tokenDecimals, remainingQuantity, limited } = useMemo(() => {
    // Prefer indexer-provided values when available
    if (priceWeiProp != null && tokenSymbolProp) {
      try {
        const parsedWei = typeof priceWeiProp === "bigint" ? priceWeiProp : BigInt(priceWeiProp);
        const decimals = typeof tokenDecimalsProp === "number" && tokenDecimalsProp > 0 ? tokenDecimalsProp : 18;
        return {
          priceWei: parsedWei,
          tokenSymbol: tokenSymbolProp,
          tokenDecimals: decimals,
          remainingQuantity: undefined,
          limited: false,
        } as const;
      } catch {
        // fall through to on-chain decode
      }
    }
    try {
      if (!listingDataBytes) return { priceWei: 0n, tokenSymbol: "ETH", tokenDecimals: 18 } as const;
      try {
        const [paymentToken, pricePerUnit, initialQuantity, remaining] = decodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
          listingDataBytes as Hex,
        );
        const isEth = String(paymentToken).toLowerCase() === zeroAddress;
        return {
          priceWei: pricePerUnit as bigint,
          tokenSymbol: isEth ? "ETH" : tokenSymbolProp || "TOKEN",
          tokenDecimals: tokenDecimalsProp || 18,
          remainingQuantity: Number(remaining as bigint),
          limited: (initialQuantity as bigint) > 0n,
        } as const;
      } catch {
        const [paymentToken, price] = decodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          listingDataBytes as Hex,
        );
        const isEth = String(paymentToken).toLowerCase() === zeroAddress;
        return {
          priceWei: price as bigint,
          tokenSymbol: isEth ? "ETH" : tokenSymbolProp || "TOKEN",
          tokenDecimals: tokenDecimalsProp || 18,
          remainingQuantity: undefined,
          limited: false,
        } as const;
      }
    } catch {
      return {
        priceWei: 0n,
        tokenSymbol: tokenSymbolProp || "ETH",
        tokenDecimals: tokenDecimalsProp || 18,
        remainingQuantity: undefined,
        limited: false,
      } as const;
    }
  }, [listingDataBytes, priceWeiProp, tokenDecimalsProp, tokenSymbolProp]);
  let priceLabel = "";
  try {
    if ((priceWei as bigint) === 0n) {
      priceLabel = "FREE";
    } else {
      const amount = formatUnits(priceWei as bigint, tokenDecimals as number);
      priceLabel = `${amount} ${tokenSymbol}`;
    }
  } catch {
    priceLabel = "";
  }
  // Preserve the originating location to enable sensible back navigation from listing details
  let fromQuery = "";
  try {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const loc = params.get("loc");
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const isOnLocationPage = path.startsWith("/location/");
    const currentLocId = isOnLocationPage ? decodeURIComponent(path.replace("/location/", "")) : null;
    const from = loc || currentLocId || undefined;
    if (from) fromQuery = `?from=${encodeURIComponent(from)}`;
  } catch {}

  return (
    <Link
      href={`/listing/${id}${fromQuery}`}
      className="card card-compact bg-base-100 shadow border border-base-300 hover:border-primary/50 transition-colors h-full rounded-xl overflow-hidden"
    >
      {resolved ? (
        <Image
          priority={false}
          src={resolved}
          alt={title}
          width={800}
          height={320}
          className="w-full aspect-[3/2] object-cover rounded-t-xl"
          onError={e => {
            const img = e.currentTarget as HTMLImageElement;
            img.src = "/thumbnail.jpg";
          }}
        />
      ) : null}
      <div className="card-body">
        <div className="card-title text-base">{title}</div>
        {tags && tags.length ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.slice(0, 3).map(t => (
              <span key={t} className="badge badge-secondary badge-sm max-w-[16ch]">
                <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left">{t}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="opacity-80 text-sm">{priceLabel}</div>
          {limited && typeof remainingQuantity === "number" ? (
            <div className="badge badge-outline badge-sm">{remainingQuantity} left</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
};
