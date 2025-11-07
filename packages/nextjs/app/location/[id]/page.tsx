"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListingCard } from "~~/components/marketplace/ListingCard";

const LocationPage = () => {
  const params = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [location, setLocation] = useState<any | null>(null);
  const [cachedName, setCachedName] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("");

  const refreshDelay = process.env.NEXT_PUBLIC_REFRESH_DELAY ? Number(process.env.NEXT_PUBLIC_REFRESH_DELAY) : 4000;
  // Future: we could store geo/radius for map previews
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      setLocation(null);
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
    };
    run();
  }, [params?.id, cachedName]);

  // Fetch listings for this location from Ponder GraphQL
  const fetchListings = useCallback(
    async (opts?: { silent?: boolean }) => {
      const id = decodeURIComponent(params?.id as string);
      if (!id) return;
      if (!opts?.silent) setLoadingListings(true);
      try {
        const res = await fetch(process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: `
            query ListingsByLocation($loc: String!) {
              listingss(
                where: { locationId: $loc, active: true }
                orderBy: "createdBlockNumber"
                orderDirection: "desc"
                limit: 100
              ) {
                items {
                  id
                  title
                  image
                  tags
                  priceWei
                  tokenSymbol
                  tokenDecimals
                }
              }
            }`,
            variables: { loc: id },
          }),
        });
        const json = await res.json();
        const items = (json?.data?.listingss?.items || []).map((it: any) => {
          let tags: string[] = [];
          try {
            const raw = (it as any)?.tags;
            if (Array.isArray(raw)) {
              tags = raw.map((t: any) => String(t)).filter(Boolean);
            } else if (typeof raw === "string" && raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) tags = parsed.map((t: any) => String(t)).filter(Boolean);
              } catch {}
            }
          } catch {}
          return {
            id: it.id,
            title: it?.title ?? it.id,
            image: it?.image ?? null,
            tags,
            priceWei: it?.priceWei ?? null,
            tokenSymbol: it?.tokenSymbol ?? null,
            tokenDecimals: it?.tokenDecimals ?? null,
          };
        });
        setListings(items);
      } catch {
        setListings([]);
      } finally {
        if (!opts?.silent) setLoadingListings(false);
      }
    },
    [params?.id],
  );

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
        fetchListings({ silent: true }).finally(() => {
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

  const availableTags = useMemo(() => {
    const tagSet = listings.reduce((acc: Set<string>, listing) => {
      if (Array.isArray(listing.tags)) {
        listing.tags.forEach((tag: string) => {
          if (tag && typeof tag === "string") {
            acc.add(tag.toLowerCase());
          }
        });
      }
      return acc;
    }, new Set<string>());
    return Array.from(tagSet).sort();
  }, [listings]);

  const filtered = useMemo(() => {
    const q = (query || "").toLowerCase();
    const selectedTag = (tagFilter || "").toLowerCase();

    return listings.filter(l => {
      if (q && !(l.title || "").toLowerCase().includes(q)) return false;
      if (selectedTag) {
        const listingTags = Array.isArray(l.tags) ? l.tags.map((t: string) => String(t).toLowerCase()) : [];
        if (!listingTags.includes(selectedTag)) return false;
      }
      return true;
    });
  }, [listings, query, tagFilter]);

  return (
    <div className="p-4 space-y-4">
      <div className="mx-auto max-w-6xl flex items-center">
        <h1 className="text-2xl mb-0 font-semibold">{location?.name || cachedName || ""}</h1>
      </div>

      <div className="mx-auto max-w-6xl">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search listings"
          className="input input-bordered w-full"
        />
      </div>
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-2">
        <details className="dropdown">
          <summary className="btn btn-sm relative">
            Filters
            {tagFilter ? <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" /> : null}
          </summary>
          <div className="menu dropdown-content bg-base-100 rounded-box shadow p-3 mt-2 w-80 space-y-2">
            <div className="space-y-1">
              <div className="text-sm opacity-80">Tag</div>
              {availableTags.length > 0 ? (
                <select
                  className="select select-bordered w-full"
                  value={tagFilter}
                  onChange={e => {
                    setTagFilter(e.target.value);
                    try {
                      const parent = (e.target as HTMLSelectElement).closest("details") as HTMLDetailsElement | null;
                      if (parent) parent.open = false; // auto close
                    } catch {}
                  }}
                >
                  <option value="">All tags</option>
                  {availableTags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm opacity-60 py-2">No tags available</div>
              )}
              <div className="flex justify-end pt-1">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={e => {
                    e.preventDefault();
                    setTagFilter("");
                    try {
                      const parent = (e.currentTarget as HTMLButtonElement).closest(
                        "details",
                      ) as HTMLDetailsElement | null;
                      if (parent) parent.open = false;
                    } catch {}
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </details>
        <Link href={`/listing/new?loc=${encodeURIComponent(params?.id as string)}`} className="btn btn-sm btn-primary">
          Create Listing
        </Link>
      </div>
      {loadingListings ? (
        <div className="mx-auto max-w-6xl flex items-center justify-center py-8">
          <span className="loading loading-spinner loading-md" />
          <span className="ml-2 opacity-70">Loading listings…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="opacity-70">No listings yet.</p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(item => (
            <ListingCard
              key={item.id}
              id={item.id}
              title={item.title || item.id}
              imageUrl={item.image}
              tags={item.tags}
              priceWei={item.priceWei}
              tokenSymbol={item.tokenSymbol}
              tokenDecimals={item.tokenDecimals}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationPage;
