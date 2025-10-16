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
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const refreshDelay = process.env.NEXT_PUBLIC_REFRESH_DELAY ? Number(process.env.NEXT_PUBLIC_REFRESH_DELAY) : 4000;
  // Future: we could store geo/radius for map previews
  const hasRefreshedRef = useRef(false);

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
                  priceWei
                  tokenSymbol
                  tokenDecimals
                  category
                }
              }
            }`,
          variables: { loc: id },
        }),
      });
      const json = await res.json();
      const items = (json?.data?.listingss?.items || []).map((it: any) => ({
        id: it.id,
        title: it?.title ?? it.id,
        image: it?.image ?? null,
        priceWei: it?.priceWei ?? null,
        tokenSymbol: it?.tokenSymbol ?? null,
        tokenDecimals: it?.tokenDecimals ?? null,
        category: it?.category ?? null,
      }));
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
    const q = (query || "").toLowerCase();
    const cat = (categoryFilter || "").toLowerCase();

    return listings.filter(l => {
      if (q && !(l.title || "").toLowerCase().includes(q)) return false;
      if (cat && String(l.category || "").toLowerCase() !== cat) return false;
      return true;
    });
  }, [listings, query, categoryFilter]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl mb-0 font-semibold">{location?.name || cachedName || ""}</h1>
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
      <div className="flex items-center gap-2">
        <details className="dropdown">
          <summary className="btn btn-sm relative">
            Filters
            {categoryFilter ? <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" /> : null}
          </summary>
          <div className="menu dropdown-content bg-base-100 rounded-box shadow p-3 mt-2 w-80 space-y-2">
            <div className="space-y-1">
              <div className="text-sm opacity-80">Category</div>
              <select
                className="select select-bordered w-full"
                value={categoryFilter}
                onChange={e => {
                  setCategoryFilter(e.target.value);
                  try {
                    const parent = (e.target as HTMLSelectElement).closest("details") as HTMLDetailsElement | null;
                    if (parent) parent.open = false; // auto close
                  } catch {}
                }}
              >
                <option value="">All categories</option>
                <option value="vehicles">Vehicles</option>
                <option value="housing">Housing & Rooms</option>
                <option value="furniture">Furniture</option>
                <option value="appliances">Appliances</option>
                <option value="electronics">Electronics</option>
                <option value="tools">Tools & Equipment</option>
                <option value="garden_outdoor">Garden & Outdoor</option>
                <option value="home_improvement">Home Improvement</option>
                <option value="clothing_accessories">Clothing & Accessories</option>
                <option value="baby_kids">Baby & Kids</option>
                <option value="sports_fitness">Sports & Fitness</option>
                <option value="bikes">Bikes</option>
                <option value="pets">Pets & Supplies</option>
                <option value="farm_garden">Farm & Garden</option>
                <option value="business_industrial">Business & Industrial</option>
                <option value="services">Services</option>
                <option value="jobs">Jobs</option>
                <option value="classes">Classes & Lessons</option>
                <option value="events">Local Events</option>
                <option value="free_stuff">Free Stuff</option>
                <option value="lost_found">Lost & Found</option>
                <option value="community">Community</option>
                <option value="garage_sales">Garage & Yard Sales</option>
                <option value="rideshare">Rideshare & Carpool</option>
                <option value="other">Other</option>
              </select>
              <div className="flex justify-end pt-1">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={e => {
                    e.preventDefault();
                    setCategoryFilter("");
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
      </div>
      {loading ? (
        <p className="opacity-70">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="opacity-70">No listings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(item => (
            <ListingCard
              key={item.id}
              id={item.id}
              title={item.title || item.id}
              imageUrl={item.image}
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
