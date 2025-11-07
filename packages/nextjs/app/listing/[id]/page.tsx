"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useParams } from "next/navigation";
import { Hex, decodeAbiParameters, formatUnits, keccak256, stringToHex } from "viem";
import { useAccount } from "wagmi";
import { useMiniapp } from "~~/components/MiniappProvider";
import FcAddressRating from "~~/components/marketplace/FcAddressRating";
import { PayButton } from "~~/components/marketplace/PayButton";
import { Address } from "~~/components/scaffold-eth/Address/Address";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { resolveIpfsUrl } from "~~/services/ipfs/fetch";

const ListingDetailsPageInner = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any | null>(null);
  const [indexed, setIndexed] = useState<any | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { composeCast, isMiniApp } = useMiniapp();
  const idNum = useMemo(() => (params?.id ? BigInt(params.id) : undefined), [params?.id]);
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync: writeMarketplace } = useScaffoldWriteContract({ contractName: "Marketplace" });

  const { data: ptr } = useScaffoldReadContract({
    contractName: "Marketplace",
    functionName: "getListing",
    args: [idNum],
    watch: true,
  });
  // decoder for listing data:
  // - QuantityListings: (address paymentToken, uint256 pricePerUnit, uint256 initialQuantity, uint256 remainingQuantity)
  // - SimpleListings fallback: (address paymentToken, uint256 price)
  const decodeListingData = useCallback((bytes: Hex) => {
    try {
      const [paymentToken, pricePerUnit, initialQuantity, remainingQuantity] = decodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
        bytes,
      );
      return { paymentToken, price: pricePerUnit, initialQuantity, remainingQuantity };
    } catch {
      const [paymentToken, price] = decodeAbiParameters([{ type: "address" }, { type: "uint256" }], bytes);
      return { paymentToken, price, initialQuantity: undefined, remainingQuantity: undefined };
    }
  }, []);

  const pointer = useMemo(() => {
    if (!ptr) return undefined;
    const arr = ptr as unknown as any[];
    return {
      creator: arr?.[0],
      listingType: arr?.[1],
      contenthash: arr?.[2],
      active: arr?.[3] as boolean | undefined,
    } as { creator?: string; listingType?: string; contenthash?: string; active?: boolean };
  }, [ptr]);
  const listingTypeDataBytes = useMemo(() => (ptr ? (ptr as any)[4] : undefined), [ptr]);

  useEffect(() => {
    if (!pointer || !listingTypeDataBytes) return;
    let decoded: any | undefined;
    try {
      decoded = decodeListingData(listingTypeDataBytes as Hex);
    } catch {}
    const metadata = indexed?.metadata;
    setData({ pointer, decoded, metadata, raw: !decoded ? listingTypeDataBytes : undefined });
  }, [pointer, listingTypeDataBytes, decodeListingData, indexed?.metadata]);
  useEffect(() => {
    setData(null);
  }, [params?.id]);

  // Ensure the listing URL contains a from=locationId param when we know it from the indexer
  useEffect(() => {
    try {
      const currentFrom = searchParams?.get("from");
      const loc = (indexed?.locationId as string | undefined) || undefined;
      if (!currentFrom && loc) {
        const url = new URL(window.location.href);
        url.searchParams.set("from", loc);
        // Use replace to avoid polluting history
        router.replace(url.pathname + "?" + url.searchParams.toString());
      }
    } catch {}
  }, [indexed?.locationId, searchParams, router]);

  // Fetch indexed listing (for timestamp, status, metadata fallback)
  useEffect(() => {
    const run = async () => {
      setIndexed(null);
      try {
        const id = params?.id as string;
        if (!id) return;
        const res = await fetch(process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: `
              query ListingById($id: String!) {
                listings(id: $id) {
                  id
                  creator
                  listingType
                  cid
                  active
                  title
                  description
                  image
                  contact
                  tags
                  price
                  currency
                  locationId
                  createdBlockNumber
                  createdBlockTimestamp
                  createdTxHash
                  paymentToken
                  priceWei
                  tokenName
                  tokenSymbol
                  tokenDecimals
                  buyer
                  buyerReviewed
                  sellerReviewed
                  initialQuantity
                  remainingQuantity
                  unlimited
                }
              }`,
            variables: { id },
          }),
        });
        const json = await res.json();
        const item = json?.data?.listings || null;
        setIndexed(item);
      } catch {
        setIndexed(null);
      } finally {
      }
    };
    run();
  }, [params?.id]);

  const imageUrl = useMemo(() => {
    const cid = data?.image || indexed?.image;
    return resolveIpfsUrl(cid) || cid || null;
  }, [data?.image, indexed?.image]);

  const title = data?.title || indexed?.title || `Listing ${params?.id}`;
  const description = data?.description || indexed?.description || "";
  const active = pointer?.active ?? indexed?.active ?? true;
  const seller = pointer?.creator || indexed?.creator || undefined;

  const isCreator = useMemo(() => {
    if (!connectedAddress || !seller) return false;
    return connectedAddress.toLowerCase() === seller.toLowerCase();
  }, [connectedAddress, seller]);

  const handleDelete = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (idNum === undefined) {
      return;
    }

    setShowDeleteModal(false);
    setDeleting(true);
    try {
      // Call the close action to deactivate the listing instead of deleting it
      const sigHash = keccak256(stringToHex("close(uint256,address,bool,address,bytes)"));
      const selector = `0x${sigHash.slice(2, 10)}` as `0x${string}`;
      const action = (selector + "0".repeat(64 - 8)) as `0x${string}`;

      await writeMarketplace({
        functionName: "callAction",
        args: [idNum, action, "0x"],
      });
      router.push("/");
    } catch (error) {
      console.error("Error closing listing:", error);
      alert("Failed to close listing. Please try again.");
      setDeleting(false);
    }
  }, [idNum, writeMarketplace, router]);

  const handleOpenEdit = useCallback(() => {
    const idStr = params?.id;
    if (!idStr) return;
    const base = `/listing/new?edit=${encodeURIComponent(idStr)}`;
    const from = indexed?.locationId;
    router.push(from ? `${base}&loc=${encodeURIComponent(from)}` : base);
  }, [params?.id, indexed?.locationId, router]);

  const tags = useMemo(() => {
    const raw = (data?.tags ?? (indexed as any)?.tags) as unknown;
    if (!raw) return [] as string[];
    try {
      if (Array.isArray(raw)) return (raw as any[]).map(v => String(v)).filter(Boolean);
      if (typeof raw === "string")
        return raw
          .split(/\s+/)
          .map(s => s.trim())
          .filter(Boolean);
    } catch {}
    return [] as string[];
  }, [data?.tags, indexed]);

  const priceLabel = useMemo(() => {
    // Prefer indexed numeric fields when available
    try {
      if (indexed?.priceWei) {
        const wei = BigInt(indexed.priceWei as string);
        const decimals = typeof indexed.tokenDecimals === "number" ? indexed.tokenDecimals : 18;
        const symbol = indexed?.tokenSymbol || "ETH";
        if (wei === 0n) return "FREE";
        const amount = formatUnits(wei, decimals);
        return `${amount} ${symbol}`;
      }
      // Fallback to on-chain decoded price (assumed ETH)
      if (data?.decoded?.price != null) {
        const wei = data.decoded.price as bigint;
        if (wei === 0n) return "FREE";
        const amount = formatUnits(wei, 18);
        return `${amount} ETH`;
      }
    } catch {}

    // Final fallback to string price/currency from indexer or metadata
    if (indexed?.price && indexed?.currency) return `${indexed.price} ${indexed.currency}`;
    if (data?.metadata?.price && data?.metadata?.currency) return `${data.metadata.price} ${data.metadata.currency}`;
    return "0";
  }, [
    indexed?.priceWei,
    indexed?.tokenDecimals,
    indexed?.tokenSymbol,
    data?.decoded?.price,
    indexed?.price,
    indexed?.currency,
    data?.metadata?.price,
    data?.metadata?.currency,
  ]);

  // Quantity / availability
  const limited = useMemo(() => {
    const init = data?.decoded?.initialQuantity as bigint | undefined;
    if (typeof init === "bigint") return init > 0n;
    // fallback using indexer fields when present
    if (typeof (indexed as any)?.initialQuantity === "number") return (indexed as any).initialQuantity > 0;
    return false;
  }, [data?.decoded?.initialQuantity, indexed]);
  const remaining = useMemo(() => {
    const rem = data?.decoded?.remainingQuantity as bigint | undefined;
    if (typeof rem === "bigint") return Number(rem);
    if (typeof (indexed as any)?.remainingQuantity === "number") return (indexed as any).remainingQuantity as number;
    return undefined;
  }, [data?.decoded?.remainingQuantity, indexed]);
  const [quantity, setQuantity] = useState<number>(1);
  useEffect(() => {
    if (!limited) return;
    const max = typeof remaining === "number" ? remaining : 1;
    if (quantity > max) setQuantity(Math.max(1, max));
  }, [limited, remaining, quantity]);

  const postedAgo = useMemo(() => {
    const ts = indexed?.createdBlockTimestamp ? Number(indexed.createdBlockTimestamp) : undefined;
    if (!ts) return null;
    const now = Date.now();
    const diff = Math.max(0, now - ts * 1000);
    const minutes = Math.floor(diff / (60 * 1000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  }, [indexed?.createdBlockTimestamp]);

  // Derive PayButton props from indexed values with on-chain fallbacks
  const payPriceWei = useMemo(
    () =>
      (indexed?.priceWei as string | undefined) ??
      (data?.decoded?.price != null ? String(data.decoded.price) : undefined),
    [indexed?.priceWei, data?.decoded?.price],
  );

  const payToken = useMemo(
    () => (indexed?.paymentToken as string | undefined) ?? (data?.decoded?.paymentToken as string | undefined),
    [indexed?.paymentToken, data?.decoded?.paymentToken],
  );

  const payListingTypeAddress = useMemo(() => {
    try {
      const addr = (indexed?.listingType as string | undefined) ?? (pointer?.listingType as string | undefined);
      return addr?.toLowerCase();
    } catch {
      return undefined;
    }
  }, [indexed?.listingType, pointer]);

  // (back navigation handled globally in Header BackButton)

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        {isMiniApp ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                const url = typeof window !== "undefined" ? window.location.href : "";
                const text = `Check out this listing: ${title}\n\n${description}\n\n${priceLabel}`;
                const embeds: string[] = [];
                if (url) embeds.push(url);
                await composeCast({ text, embeds });
              } catch (e) {
                console.error("share compose error", e);
              }
            }}
          >
            Share
          </button>
        ) : null}
        <div className="flex items-center gap-2 ml-auto">
          <div className={`badge ${active ? "badge-success" : ""}`}>{active ? "Active" : "Sold"}</div>
          {isCreator && active && (
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-sm text-lg">
                ⋯
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-32 p-2 shadow">
                <li>
                  <button onClick={handleOpenEdit} className="w-full text-left">
                    Edit
                  </button>
                </li>
                <li>
                  <button onClick={handleDelete} disabled={deleting} className="w-full text-left text-error">
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center mb-0">
        <h1 className="text-2xl font-semibold mb-1">{title}</h1>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {imageUrl ? (
          <div className="w-full">
            <Image
              priority={false}
              src={imageUrl}
              alt={title}
              width={1200}
              height={600}
              className="w-full h-60 object-cover rounded-xl cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
              onError={e => {
                const img = e.currentTarget as HTMLImageElement;
                img.src = "/thumbnail.jpg";
              }}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="opacity-70 text-sm flex items-center gap-2 flex-wrap">
            {postedAgo ? <span>Posted {postedAgo} by</span> : null}
            {seller ? (
              <span className="flex items-center gap-2">
                <Address address={seller as `0x${string}`} disableAddressLink={true} />
                <FcAddressRating address={seller as `0x${string}`} />
              </span>
            ) : null}
          </div>
        </div>

        {tags.length ? (
          <div className="flex items-center flex-wrap gap-1">
            {tags.map(t => (
              <span key={t} className="badge badge-secondary badge-sm">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {description ? <p className="opacity-90 whitespace-pre-wrap">{description}</p> : null}

        <div className="divider my-0" />

        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            {limited && typeof remaining === "number" ? (
              <div className="badge badge-outline">{remaining} left</div>
            ) : null}
            <div className="text-xl font-semibold">{priceLabel}</div>
            {limited || true ? (
              <div className="flex items-center gap-1">
                <span className="opacity-70">x</span>
                <input
                  className="input input-bordered input-sm w-16 text-center"
                  type="number"
                  min={1}
                  max={limited && typeof remaining === "number" ? Math.max(1, remaining) : undefined}
                  value={quantity}
                  onFocus={e => (e.target as HTMLInputElement).select()}
                  onClick={e => (e.currentTarget as HTMLInputElement).select()}
                  onChange={e => {
                    const v = Math.max(1, Number(e.target.value || "1"));
                    setQuantity(limited && typeof remaining === "number" ? Math.min(v, remaining) : v);
                  }}
                />
              </div>
            ) : null}
            {indexed?.id ? (
              <PayButton
                listingId={indexed.id}
                // For ETH payments, pass decoded values when available (non-ETH handled via approval in button)
                priceWei={payPriceWei}
                paymentToken={payToken}
                listingTypeAddress={payListingTypeAddress}
                quantity={quantity}
                disabled={!active}
              />
            ) : null}
          </div>
        </div>

        {!data ? <p className="opacity-70">Loading details…</p> : null}

        {data?.contact || (indexed as any)?.contact ? (
          <details className="collapse collapse-arrow bg-base-200">
            <summary className="collapse-title px-0 font-medium">Contact preferences</summary>
            <div className="collapse-content">
              <div className="p-0">
                {typeof (data?.contact ?? (indexed as any)?.contact) === "object" ? (
                  <ul className="space-y-0">
                    {Object.entries((data?.contact ?? (indexed as any)?.contact) as Record<string, string>)
                      .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
                      .map(([k, v]) => (
                        <li key={k} className="flex items-center">
                          <span>
                            {k}: {v}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="break-all">{(data?.contact ?? (indexed as any)?.contact) as string}</div>
                )}
              </div>
            </div>
          </details>
        ) : null}
      </div>

      {lightboxOpen && imageUrl ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-5xl w-full p-4" onClick={e => e.stopPropagation()}>
            <button
              className="btn btn-circle btn-ghost btn-lg text-3xl absolute right-4 top-4"
              aria-label="Close"
              onClick={() => setLightboxOpen(false)}
            >
              ✕
            </button>
            <Image
              src={imageUrl}
              alt={title}
              width={1600}
              height={900}
              className="w-full h-auto object-contain rounded-xl"
            />
          </div>
        </div>
      ) : null}

      {showDeleteModal && (
        <div className="modal modal-open" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Delete Listing</h3>
            <p className="py-4">Are you sure you want to delete this listing? This action cannot be undone.</p>
            <div className="modal-action">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-error" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ListingDetailsPage() {
  return (
    <Suspense fallback={null}>
      <ListingDetailsPageInner />
    </Suspense>
  );
}
