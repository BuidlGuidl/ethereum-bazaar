"use client";

import React, { useEffect, useMemo, useState } from "react";
import RatingStars from "~~/components/marketplace/RatingStars";

type Props = {
  address?: `0x${string}` | string | null;
  size?: number;
  className?: string;
};

export const FcAddressRating: React.FC<Props> = ({ address, size = 16, className }) => {
  const reviewee = useMemo(() => (address ? String(address).toLowerCase() : null), [address]);
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!reviewee) return;
      setLoading(true);
      try {
        const base = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql";
        const query = `
          query ReviewsByReviewee($reviewee: String!) {
            reviewss(where: { reviewee: $reviewee }, limit: 500, orderBy: "time", orderDirection: "desc") {
              items { rating }
              totalCount
            }
          }
        `;
        const res = await fetch(base, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, variables: { reviewee } }),
        });
        const json = await res.json();
        const items = (json?.data?.reviewss?.items ?? []) as Array<{ rating: number | null }>;
        const ratings = items
          .map(i => (typeof i.rating === "number" ? i.rating : null))
          .filter((n): n is number => n != null);
        const c = ratings.length;
        const a = c > 0 ? ratings.reduce((s, n) => s + n, 0) / c : null;
        if (!cancelled) {
          setCount(json?.data?.reviewss?.totalCount || c || 0);
          setAvg(a);
        }
      } catch {
        if (!cancelled) {
          setAvg(null);
          setCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [reviewee]);

  if (!reviewee) return null;
  if (loading) return <span className={`opacity-50 text-xs ${className || ""}`}>…</span>;
  if (avg == null || count === 0) return <span className={`opacity-50 text-xs ${className || ""}`}>No ratings</span>;

  return (
    <div className={`flex items-center gap-1 ${className || ""}`}>
      <RatingStars value={avg} size={size} showCount={count} />
    </div>
  );
};

export default FcAddressRating;
