"use client";

import { useEffect, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import MapRadius from "~~/components/marketplace/MapRadiusGL";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"] });

const Home: NextPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingLocations(true);
    const run = async () => {
      const q = query.trim();
      try {
        const res = await fetch(`/api/locations?all=1&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setLocations(Array.isArray(json.locations) ? json.locations : []);
        } else {
          if (!cancelled) setLocations([]);
        }
      } catch {
        if (!cancelled) setLocations([]);
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    };
    const id = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  // Redirect to user's selected default location unless explicitly on Home (?home=1)
  useEffect(() => {
    try {
      const suppress = searchParams?.get("home") === "1";
      if (suppress) return;
      const raw = localStorage.getItem("marketplace.defaultLocationData");
      if (raw) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(raw);
        } catch {}
        const id = parsed?.id as string | undefined;
        if (id) {
          // verify the location still exists before redirecting
          fetch(`/api/locations/${id}`)
            .then(async res => {
              if (res.ok) {
                router.replace(`/location/${id}`);
              } else {
                try {
                  localStorage.removeItem("marketplace.defaultLocationData");
                } catch {}
                router.replace(`/?home=1`);
              }
            })
            .catch(() => {
              try {
                localStorage.removeItem("marketplace.defaultLocationData");
              } catch {}
              router.replace(`/?home=1`);
            });
        }
      }
    } catch {}
  }, [router, searchParams]);

  return (
    <>
      <div className="flex items-center flex-col grow pt-2">
        <div className="px-5 w-full max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="lg:hidden flex items-center gap-2">
                <Image
                  alt="Ethereum Bazaar logo"
                  width={64}
                  height={64}
                  className="shrink-0 -mx-3"
                  src="/ethereum-bazaar-logo.svg"
                />
                <div className="flex flex-col">
                  <span
                    className={`${cormorant.className} font-semibold leading-tight text-xl tracking-[0.01em] text-primary`}
                  >
                    Ethereum Bazaar
                  </span>
                  <span className="text-xs text-neutral/80">A peer to peer marketplace</span>
                </div>
              </div>
              <div className="hidden lg:block" aria-hidden="true" />
            </div>
            <Link href="/location/new" className="btn btn-primary">
              Create location
            </Link>
          </div>
          <div className="my-6">
            <div className="w-full flex items-center gap-2">
              <input
                className="input input-bordered w-full"
                placeholder="Search locations..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {loadingLocations ? (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 flex items-center justify-center py-8">
                <span className="loading loading-spinner loading-md" />
                <span className="ml-2 opacity-70">Loading locations…</span>
              </div>
            ) : (
              <>
                {locations.map(l => (
                  <button
                    key={l.id}
                    className="card bg-base-100 border border-base-300 hover:border-primary/60 transition-colors text-left cursor-pointer"
                    onClick={async () => {
                      setSelected(null);
                      setLoadingSelected(true);
                      try {
                        const res = await fetch(`/api/locations/${encodeURIComponent(l.id)}`);
                        if (res.ok) {
                          const json = await res.json();
                          setSelected(json.location || l);
                        } else {
                          setSelected(l);
                        }
                      } finally {
                        setLoadingSelected(false);
                        const checkbox = document.getElementById("location-preview-modal") as HTMLInputElement | null;
                        if (checkbox) checkbox.checked = true;
                      }
                    }}
                  >
                    <div className="card-body p-3">
                      <div className="card-title text-base">{l.name || l.id}</div>
                    </div>
                  </button>
                ))}
                {locations.length === 0 && <div className="opacity-70">No locations found in that search.</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Location Preview Modal */}
      <div>
        <input type="checkbox" id="location-preview-modal" className="modal-toggle" />
        <label htmlFor="location-preview-modal" className="modal cursor-pointer">
          <label className="modal-box relative max-w-3xl max-h-[90vh] overflow-y-auto">
            <input className="h-0 w-0 absolute top-0 left-0" />
            <label htmlFor="location-preview-modal" className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3">
              ✕
            </label>
            <div className="space-y-3">
              <div className="text-lg font-semibold">{selected?.name || selected?.id || "Location"}</div>
              <div className="rounded-xl overflow-hidden border bg-base-100">
                {loadingSelected ? (
                  <div className="p-4 text-sm opacity-70">Loading…</div>
                ) : selected?.lat != null && selected?.lng != null && selected?.radiusMiles != null ? (
                  <MapRadius
                    lat={Number(selected.lat)}
                    lng={Number(selected.lng)}
                    radiusMiles={Number(selected.radiusMiles)}
                    onMove={() => {}}
                  />
                ) : (
                  <div className="p-4 text-sm opacity-70">No map preview available for this location.</div>
                )}
              </div>
              {/* Additional location details */}
              {selected && (
                <div className="space-y-2">
                  {Array.isArray(selected.akas) && selected.akas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selected.akas.map((aka: string, idx: number) => (
                        <span key={idx} className="badge badge-outline">
                          {aka}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  try {
                    if (selected?.id) {
                      const data = {
                        id: String(selected.id),
                        name: selected?.name ?? null,
                        lat: selected?.lat ?? null,
                        lng: selected?.lng ?? null,
                        radiusMiles: selected?.radiusMiles ?? null,
                        savedAt: Date.now(),
                      };
                      localStorage.setItem("marketplace.defaultLocationData", JSON.stringify(data));
                    }
                  } catch {}
                  const checkbox = document.getElementById("location-preview-modal") as HTMLInputElement | null;
                  if (checkbox) checkbox.checked = false;
                  router.push(`/location/${String(selected?.id || "")}`);
                }}
                disabled={!selected}
              >
                Select this location
              </button>
            </div>
          </label>
        </label>
      </div>
    </>
  );
};

export default Home;
