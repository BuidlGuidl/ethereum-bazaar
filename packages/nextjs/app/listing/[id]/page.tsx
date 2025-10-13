"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useParams } from "next/navigation";
import { Hex, decodeAbiParameters, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { PayButton } from "~~/components/marketplace/PayButton";
import { Address } from "~~/components/scaffold-eth/Address/Address";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth/useDeployedContractInfo";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth/useScaffoldReadContract";
import { fetchJsonFromCid, resolveIpfsUrl } from "~~/services/ipfs/fetch";

const ListingDetailsPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<any | null>(null);
  const [indexed, setIndexed] = useState<any | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const idNum = useMemo(() => (params?.id ? BigInt(params.id) : undefined), [params?.id]);
  useAccount();

  const { data: ptr } = useScaffoldReadContract({
    contractName: "Marketplace",
    functionName: "getListing",
    args: [idNum],
  });
  const { data: simpleListingsInfo } = useDeployedContractInfo("SimpleListings");

  // decoder registry keyed by listing type contract address
  const decoders = useMemo(() => {
    const map = new Map<string, (data: Hex) => any>();
    if (simpleListingsInfo?.address) {
      map.set(simpleListingsInfo.address.toLowerCase(), (bytes: Hex) => {
        const [creator, paymentToken, price, ipfsHash, active] = decodeAbiParameters(
          [{ type: "address" }, { type: "address" }, { type: "uint256" }, { type: "string" }, { type: "bool" }],
          bytes,
        );
        return { creator, paymentToken, price, ipfsHash, active };
      });
    }
    return map;
  }, [simpleListingsInfo?.address]);

  const pointer = useMemo(() => (ptr ? (ptr as any)[0] : undefined), [ptr]);
  const listingTypeDataBytes = useMemo(() => (ptr ? (ptr as any)[1] : undefined), [ptr]);

  useEffect(() => {
    if (!pointer || !listingTypeDataBytes) return;
    const lt = (pointer.listingType as string | undefined)?.toLowerCase?.();
    const decoder = lt ? decoders.get(lt) : undefined;
    const doWork = async () => {
      let decoded: any | undefined;
      try {
        decoded = decoder ? decoder(listingTypeDataBytes as Hex) : undefined;
      } catch {
        // ignore
      }
      let metadata: any | undefined;
      const maybeIpfs = decoded?.ipfsHash || decoded?.metadata || undefined;
      if (maybeIpfs && typeof maybeIpfs === "string") {
        try {
          metadata = await fetchJsonFromCid(maybeIpfs);
        } catch {
          // ignore metadata fetch failure
        }
      }
      setData({ pointer, decoded, metadata, raw: !decoded ? listingTypeDataBytes : undefined });
    };
    void doWork();
  }, [pointer, listingTypeDataBytes, decoders]);
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
                listingss(where: { id: $id }, limit: 1) {
                  items {
                    id
                    creator
                    listingType
                    listingInnerId
                    paymentToken
                    priceWei
                    ipfsCid
                    active
                    tokenName
                    tokenSymbol
                    tokenDecimals
                    title
                    description
                    category
                    image
                    locationId
                    createdBlockNumber
                    createdBlockTimestamp
                    createdTxHash
                  }
                }
              }`,
            variables: { id },
          }),
        });
        const json = await res.json();
        const item = json?.data?.listingss?.items?.[0] || null;
        setIndexed(item);
      } catch {
        setIndexed(null);
      } finally {
      }
    };
    run();
  }, [params?.id]);

  const imageUrl = useMemo(() => {
    const cid = data?.metadata?.image || indexed?.image;
    return resolveIpfsUrl(cid) || cid || null;
  }, [data?.metadata?.image, indexed?.image]);

  const title = data?.metadata?.title || indexed?.title || `Listing ${params?.id}`;
  const description = data?.metadata?.description || indexed?.description || "";
  const category = data?.metadata?.category || indexed?.category || "";
  const active = data?.decoded?.active ?? indexed?.active ?? true;
  const seller = data?.pointer?.creator || indexed?.creator || undefined;

  const tags = useMemo(() => {
    const raw = (data?.metadata?.tags ?? (indexed as any)?.tags) as unknown;
    if (!raw) return [] as string[];
    try {
      if (Array.isArray(raw)) return (raw as any[]).map(v => String(v)).filter(Boolean);
      if (typeof raw === "string")
        return raw
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
    } catch {}
    return [] as string[];
  }, [data?.metadata?.tags, indexed]);

  const priceLabel = useMemo(() => {
    try {
      const wei =
        data?.decoded?.price != null
          ? (data.decoded.price as bigint)
          : indexed?.priceWei
            ? BigInt(indexed.priceWei)
            : 0n;
      const decimals = typeof indexed?.tokenDecimals === "number" ? indexed.tokenDecimals : 18;
      const symbol = indexed?.tokenSymbol || "ETH";
      const amount = formatUnits(wei, decimals);
      return `${amount} ${symbol}`;
    } catch {
      if (data?.metadata?.price && data?.metadata?.currency) return `${data.metadata.price} ${data.metadata.currency}`;
      return "0";
    }
  }, [
    data?.decoded?.price,
    indexed?.priceWei,
    indexed?.tokenDecimals,
    indexed?.tokenSymbol,
    data?.metadata?.price,
    data?.metadata?.currency,
  ]);

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
        <div className={`badge ${active ? "badge-success" : ""} ml-auto`}>{active ? "Active" : "Sold"}</div>
      </div>

      <div className="flex items-center mb-0">
        <h1 className="text-2xl font-semibold mb-1">{title}</h1>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {imageUrl ? (
          <div className="w-full">
            <Image
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
          <div className="opacity-70 text-sm flex items-center gap-2">
            {postedAgo ? <span>Posted {postedAgo} by</span> : null}
            {seller ? (
              <span className="flex items-center gap-1">
                <Address address={seller as `0x${string}`} disableAddressLink={true} />
              </span>
            ) : null}
          </div>
        </div>

        {category || tags.length ? (
          <div className="flex items-center flex-wrap gap-1">
            {category ? <span className="opacity-70 text-sm">in {category}</span> : null}
            {category && tags.length ? <span className="opacity-40 text-xs px-1">|</span> : null}
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
            <div className="text-xl font-semibold">{priceLabel}</div>
            {indexed?.id ? (
              <PayButton
                listingId={indexed.id}
                priceWei={indexed.priceWei}
                paymentToken={indexed.paymentToken}
                disabled={!active}
              />
            ) : null}
          </div>
        </div>

        {!data ? <p className="opacity-70">Loading details…</p> : null}

        {data?.metadata?.contact || indexed?.contact ? (
          <details className="collapse collapse-arrow bg-base-200">
            <summary className="collapse-title px-0 font-medium">Contact preferences</summary>
            <div className="collapse-content">
              <div className="p-0">
                {typeof (data?.metadata?.contact ?? indexed?.contact) === "object" ? (
                  <ul className="space-y-0">
                    {Object.entries((data?.metadata?.contact ?? indexed?.contact) as Record<string, string>)
                      .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
                      .map(([k, v]) => (
                        <li key={k} className="flex items-center">
                          <span className="capitalize">
                            {k}: {v}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="break-all">{(data?.metadata?.contact ?? indexed?.contact) as string}</div>
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
    </div>
  );
};

export default ListingDetailsPage;
