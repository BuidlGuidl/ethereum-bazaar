"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { ReviewCard } from "~~/components/marketplace/ReviewCard";
import SaleReviewCard from "~~/components/marketplace/SaleReviewCard";
import { fetchJsonFromCid, resolveIpfsUrl } from "~~/services/ipfs/fetch";

type ListingRow = {
  id: string;
  creator: string;
  buyer: string | null;
  title: string | null;
  image: string | null;
  buyerReviewed: boolean | null;
  sellerReviewed: boolean | null;
  createdBlockTimestamp?: string | null;
};

type ReviewRow = {
  id: string;
  listingId: string;
  reviewer: string;
  reviewee: string;
  rating: number | null;
  commentIPFSHash: string | null;
  time?: string | null;
};

const ReviewRecentSalesPage = () => {
  const params = useParams<{ address: string }>();
  const { address } = useAccount();
  const me = useMemo(() => (address || params?.address || "").toLowerCase(), [address, params]);
  const [loading, setLoading] = useState(true);
  const [buyerSalesAll, setBuyerSalesAll] = useState<ListingRow[]>([]);
  const [sellerSalesAll, setSellerSalesAll] = useState<ListingRow[]>([]);
  const [reviewsByListing, setReviewsByListing] = useState<Record<string, ReviewRow[]>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!me) return;
      setLoading(true);
      try {
        const base = process.env.NEXT_PUBLIC_PONDER_URL || "http://127.0.0.1:42069/graphql";

        const listingsQuery = (role: "buyer" | "seller") => `{
  listingss(where: {
    ${role === "buyer" ? "buyer" : "creator"}: "${me}"
  }, limit: 200, orderBy: "createdBlockTimestamp", orderDirection: "desc") {
    items { id creator buyer title image buyerReviewed sellerReviewed createdBlockTimestamp }
  }
}`;

        const [buyerRes, sellerRes] = await Promise.all([
          fetch(base, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: listingsQuery("buyer") }),
          }),
          fetch(base, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: listingsQuery("seller") }),
          }),
        ]);

        const [buyerJson, sellerJson] = await Promise.all([buyerRes.json(), sellerRes.json()]);
        const buyerItems = ((buyerJson?.data?.listingss?.items ?? []) as ListingRow[]).filter(l => !!l.buyer);
        const sellerItems = ((sellerJson?.data?.listingss?.items ?? []) as ListingRow[]).filter(l => !!l.buyer);

        if (!cancelled) {
          setBuyerSalesAll(buyerItems);
          setSellerSalesAll(sellerItems);
        }

        // Fetch reviews in batch for all listing ids
        const listingIds = Array.from(new Set([...buyerItems, ...sellerItems].map(l => l.id)));
        if (listingIds.length > 0) {
          const chunk = (arr: string[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
          const chunks = chunk(listingIds, 50);
          const reviewQueries = chunks.map(
            ids => `{
  reviewss(where: { listingId_in: [${ids.map(id => `"${id}"`).join(",")} ] }, limit: 500, orderBy: "time", orderDirection: "desc") {
    items { id listingId reviewer reviewee rating commentIPFSHash time }
  }
}`,
          );

          const reviewResponses = await Promise.all(
            reviewQueries.map(q =>
              fetch(base, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ query: q }),
              }),
            ),
          );
          const reviewJsons = await Promise.all(reviewResponses.map(r => r.json()));
          const allReviews = reviewJsons.flatMap(j => (j?.data?.reviewss?.items ?? []) as ReviewRow[]);
          const grouped: Record<string, ReviewRow[]> = {};
          for (const r of allReviews) {
            if (!grouped[r.listingId]) grouped[r.listingId] = [];
            grouped[r.listingId].push(r);
          }
          if (!cancelled)
            setReviewsByListing(prev => {
              const merged: Record<string, ReviewRow[]> = { ...grouped };
              for (const [listingId, prevArr] of Object.entries(prev)) {
                const tempArr = prevArr.filter(rr => rr.id?.startsWith?.("temp-") ?? false);
                if (tempArr.length === 0) continue;
                const existingReviewers = new Set((grouped[listingId] ?? []).map(rr => rr.reviewer?.toLowerCase()));
                const toAdd = tempArr.filter(rr => !existingReviewers.has((rr.reviewer || "").toLowerCase()));
                merged[listingId] = [...(merged[listingId] ?? []), ...toAdd];
              }
              return merged;
            });

          // Prefetch comments for unique IPFS CIDs
          const uniqueCids = Array.from(new Set(allReviews.map(r => r.commentIPFSHash).filter(Boolean) as string[]));
          const out: Record<string, string> = {};
          await Promise.all(
            uniqueCids.map(async cid => {
              try {
                const json = await fetchJsonFromCid(cid);
                const comment = typeof json?.comment === "string" ? json.comment : "";
                out[cid] = comment;
              } catch {
                out[cid] = "";
              }
            }),
          );
          if (!cancelled) setReviewComments(prev => ({ ...prev, ...out }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    const onRefresh = () => load();
    window.addEventListener("refresh", onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("refresh", onRefresh);
    };
  }, [me]);

  const onSubmitted = async (payload: {
    listingId: string;
    rating: number;
    commentIPFSHash: string;
    comment?: string;
    reviewer?: string;
    reviewee?: string;
  }) => {
    // Optimistically add to reviewsByListing
    setReviewsByListing(prev => {
      const copy = { ...prev };
      const arr = copy[payload.listingId] ? [...copy[payload.listingId]] : [];
      arr.unshift({
        id: `temp-${Date.now()}`,
        listingId: payload.listingId,
        reviewer: (payload.reviewer || me) as string,
        reviewee: (payload.reviewee || "") as string,
        rating: payload.rating,
        commentIPFSHash: payload.commentIPFSHash,
        time: `${Date.now() / 1000}`,
      });
      copy[payload.listingId] = arr;
      return copy;
    });

    if (payload.commentIPFSHash) {
      setReviewComments(prev => ({
        ...prev,
        [payload.commentIPFSHash]: payload.comment ?? reviewComments[payload.commentIPFSHash] ?? "",
      }));
    }

    // Background refresh to reconcile flags
    const evt = new Event("refresh");
    window.dispatchEvent(evt);
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Recent Activity</h1>
      {loading ? <div>Loading…</div> : null}

      {/* Past Sales (as seller) */}
      {sellerSalesAll.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Past Sales</h2>
          {sellerSalesAll
            .sort((a, b) => Number(b?.createdBlockTimestamp ?? 0) - Number(a?.createdBlockTimestamp ?? 0))
            .map(s => {
              const reviews = reviewsByListing[s.id] || [];
              const myReview = reviews.find(r => r.reviewer?.toLowerCase() === me);
              const theirReview = reviews.find(r => r.reviewer?.toLowerCase() !== me);
              return (
                <div key={`h-${s.id}`} className="card bg-base-200 shadow p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      href={`/listing/${s.id}`}
                      className="block font-semibold truncate flex-1 min-w-0 link link-hover"
                      title={s.title || undefined}
                    >
                      {s.title || `Listing #${s.id}`}
                    </Link>
                  </div>
                  {s.image
                    ? (() => {
                        const url = resolveIpfsUrl(s.image);
                        return url ? (
                          <Image src={url} alt="listing" width={320} height={200} className="w-full max-w-xs rounded" />
                        ) : null;
                      })()
                    : null}
                  {myReview ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="font-medium mb-1">Your review</div>
                        <ReviewCard
                          rating={myReview.rating ?? 0}
                          comment={myReview.commentIPFSHash ? (reviewComments[myReview.commentIPFSHash] ?? "") : ""}
                          reviewer={"you"}
                        />
                      </div>
                      <div>
                        <div className="font-medium mb-1">Their review</div>
                        {theirReview ? (
                          <ReviewCard
                            rating={theirReview.rating ?? 0}
                            comment={
                              theirReview.commentIPFSHash ? (reviewComments[theirReview.commentIPFSHash] ?? "") : ""
                            }
                            reviewer={theirReview.reviewer}
                          />
                        ) : (
                          <div className="text-sm opacity-70">No review from counterparty yet.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <SaleReviewCard
                        sale={{
                          listingId: s.id,
                          creator: s.creator,
                          buyer: s.buyer || "0x0000000000000000000000000000000000000000",
                          title: s.title,
                          image: s.image,
                        }}
                        role={"seller"}
                        onSubmitted={onSubmitted}
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : null}

      {/* Past Purchases (as buyer) */}
      {buyerSalesAll.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Past Purchases</h2>
          {buyerSalesAll
            .sort((a, b) => Number(b?.createdBlockTimestamp ?? 0) - Number(a?.createdBlockTimestamp ?? 0))
            .map(s => {
              const reviews = reviewsByListing[s.id] || [];
              const myReview = reviews.find(r => r.reviewer?.toLowerCase() === me);
              const theirReview = reviews.find(r => r.reviewer?.toLowerCase() !== me);
              return (
                <div key={`h-${s.id}`} className="card bg-base-200 shadow p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      href={`/listing/${s.id}`}
                      className="block font-semibold truncate flex-1 min-w-0 link link-hover"
                      title={s.title || undefined}
                    >
                      {s.title || `Listing #${s.id}`}
                    </Link>
                  </div>
                  {s.image
                    ? (() => {
                        const url = resolveIpfsUrl(s.image);
                        return url ? (
                          <Image src={url} alt="listing" width={320} height={200} className="w-full max-w-xs rounded" />
                        ) : null;
                      })()
                    : null}
                  {myReview ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="font-medium mb-1">Your review</div>
                        <ReviewCard
                          rating={myReview.rating ?? 0}
                          comment={myReview.commentIPFSHash ? (reviewComments[myReview.commentIPFSHash] ?? "") : ""}
                          reviewer={"you"}
                        />
                      </div>
                      <div>
                        <div className="font-medium mb-1">Their review</div>
                        {theirReview ? (
                          <ReviewCard
                            rating={theirReview.rating ?? 0}
                            comment={
                              theirReview.commentIPFSHash ? (reviewComments[theirReview.commentIPFSHash] ?? "") : ""
                            }
                            reviewer={theirReview.reviewer}
                          />
                        ) : (
                          <div className="text-sm opacity-70">No review from counterparty yet.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <SaleReviewCard
                        sale={{
                          listingId: s.id,
                          creator: s.creator,
                          buyer: s.buyer || "0x0000000000000000000000000000000000000000",
                          title: s.title,
                          image: s.image,
                        }}
                        role={"buyer"}
                        onSubmitted={onSubmitted}
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : null}
    </div>
  );
};

export default ReviewRecentSalesPage;
