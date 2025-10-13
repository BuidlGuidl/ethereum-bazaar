"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListingCard } from "~~/components/marketplace/ListingCard";

const LocationPage = () => {
  const params = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<any | null>(null);
  const [cachedName, setCachedName] = useState<string | null>(null);

  const refreshDelay = process.env.NEXT_PUBLIC_REFRESH_DELAY ? Number(process.env.NEXT_PUBLIC_REFRESH_DELAY) : 4000;
  // Future: we could store geo/radius for map previews
  const hasRefreshedRef = useRef(false);

  const decodedId = useMemo(() => {
    try {
      return decodeURIComponent(params?.id as string);
    } catch {
      return params?.id as string;
    }
  }, [params?.id]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLocation(null);
      try {
        const id = params?.id as string;
        if (!id) return;
        // Persist this location as the current/default and add to recents
        try {
          const decoded = decodeURIComponent(id);
          if (decoded) {
            // Prefer consolidated default data if available
            const raw = localStorage.getItem("marketplace.defaultLocationData");
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed?.id === decoded) {
                  setCachedName(parsed?.name ?? null);
                }
              } catch {}
            }

            // Save recents (ids)
            const stored = localStorage.getItem("marketplace.locations");
            const prev: string[] = stored ? JSON.parse(stored) : [];
            const next = Array.from(new Set([decoded, ...prev])).slice(0, 5);
            localStorage.setItem("marketplace.locations", JSON.stringify(next));
          }
        } catch {}
        const res = await fetch(`/api/locations/${id}`);
        if (res.ok) {
          const json = await res.json();
          setLocation(json.location || null);
          // cache consolidated default data for fast subsequent loads
          try {
            const decoded = decodeURIComponent(id);
            const loc = json?.location;
            if (decoded && loc) {
              const data = {
                id: String(decoded),
                name: loc?.name ?? null,
                lat: loc?.lat ?? null,
                lng: loc?.lng ?? null,
                radiusMiles: loc?.radiusMiles ?? null,
                savedAt: Date.now(),
              };
              localStorage.setItem("marketplace.defaultLocationData", JSON.stringify(data));
              if (!cachedName && data.name) setCachedName(data.name);
            }
          } catch {}
        } else if (res.status === 404) {
          try {
            const raw = localStorage.getItem("marketplace.defaultLocationData");
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                const storedId = parsed?.id;
                if (storedId === decodeURIComponent(id)) {
                  localStorage.removeItem("marketplace.defaultLocationData");
                }
              } catch {}
            }
          } catch {}
          // redirect to home if this location no longer exists
          window.location.href = "/?home=1";
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [params?.id, cachedName]);

  // Fetch listings for this location from Ponder GraphQL
  const fetchListings = useCallback(async () => {
    const id = decodeURIComponent(params?.id as string);
    if (!id) return;
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: `
            query ListingsByLocation($loc: String!) {
              listingss(where: { locationId: $loc, active: true }, orderBy: "createdBlockNumber", orderDirection: "desc", limit: 100) {
                items {
                  id
                  title
                  priceWei
                  image
                  paymentToken
                  tokenName
                  tokenSymbol
                  tokenDecimals
                }
              }
            }`,
          variables: { loc: id },
        }),
      });
      const json = await res.json();
      const items = json?.data?.listingss?.items || [];
      setListings(items);
    } catch {
      setListings([]);
    }
  }, [params?.id]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // One-time delayed refresh ~Xs after landing
  useEffect(() => {
    hasRefreshedRef.current = false;
    const timeout = setTimeout(() => {
      if (!hasRefreshedRef.current) {
        hasRefreshedRef.current = true;
        const doc = document.documentElement;
        const wasAtTop = window.scrollY === 0;
        const prevFromBottom = Math.max(0, doc.scrollHeight - window.scrollY - window.innerHeight);
        fetchListings().finally(() => {
          // Restore position relative to bottom to account for new content height
          // Double rAF to ensure layout has settled after state updates
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (wasAtTop) {
                return;
              }
              const newDoc = document.documentElement;
              const targetTop = Math.max(
                0,
                Math.min(
                  newDoc.scrollHeight - window.innerHeight,
                  newDoc.scrollHeight - prevFromBottom - window.innerHeight,
                ),
              );
              window.scrollTo({ top: targetTop, left: 0, behavior: "auto" });
            });
          });
        });
      }
    }, refreshDelay);
    return () => clearTimeout(timeout);
  }, [fetchListings, params?.id, refreshDelay]);

  const filtered = useMemo(() => {
    if (!query) return listings;
    return listings.filter(l => (l.title || "").toLowerCase().includes(query.toLowerCase()));
  }, [listings, query]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl mb-0 font-semibold">{location?.name || cachedName || decodedId}</h1>
        <Link href={`/listing/new?loc=${encodeURIComponent(params?.id as string)}`} className="btn btn-primary">
          Create Listing
        </Link>
      </div>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search listings"
        className="input input-bordered w-full"
      />
      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="opacity-70">No listings yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(item => (
            <ListingCard
              key={item.id}
              id={item.id}
              title={item.title || item.id}
              priceWei={item.priceWei}
              tokenDecimals={item.tokenDecimals}
              tokenSymbol={item.tokenSymbol}
              imageUrl={item.image}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationPage;
