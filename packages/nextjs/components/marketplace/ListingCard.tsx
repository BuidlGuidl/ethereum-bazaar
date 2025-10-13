import Image from "next/image";
import Link from "next/link";
import { formatUnits } from "viem";
import { resolveIpfsUrl } from "~~/services/ipfs/fetch";

export interface ListingCardProps {
  id: string | number;
  title: string;
  priceWei?: string | bigint;
  tokenDecimals?: number;
  tokenSymbol?: string;
  imageUrl?: string;
}

export const ListingCard = ({ id, title, priceWei, tokenDecimals, tokenSymbol, imageUrl }: ListingCardProps) => {
  const resolved = resolveIpfsUrl(imageUrl) || imageUrl;
  let priceLabel = "";
  try {
    const wei = typeof priceWei === "bigint" ? priceWei : priceWei ? BigInt(priceWei) : 0n;
    const decimals = typeof tokenDecimals === "number" ? tokenDecimals : 18;
    const symbol = tokenSymbol || "ETH";
    const amount = formatUnits(wei, decimals);
    priceLabel = `${amount} ${symbol}`;
  } catch {
    priceLabel = typeof priceWei === "string" ? priceWei : "";
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
    <Link href={`/listing/${id}${fromQuery}`} className="card card-compact bg-base-100 shadow">
      {resolved ? (
        <Image
          src={resolved}
          alt={title}
          width={800}
          height={320}
          className="w-full h-40 object-cover"
          onError={e => {
            const img = e.currentTarget as HTMLImageElement;
            img.src = "/thumbnail.jpg";
          }}
        />
      ) : null}
      <div className="card-body">
        <div className="card-title text-base">{title}</div>
        <div className="opacity-80 text-sm">{priceLabel}</div>
      </div>
    </Link>
  );
};
