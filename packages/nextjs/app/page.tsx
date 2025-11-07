"use client";

import { Suspense, useEffect, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"] });

const HomeInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
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
          // Navigate immediately; the location page will validate and handle 404s/cleanup.
          router.replace(`/location/${encodeURIComponent(id)}`);
        }
      }
    } catch {}
  }, [router, searchParams]);

  return (
    <>
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="px-5 w-full">
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
                    onClick={() => {
                      // Set as preferred location immediately, then navigate
                      try {
                        const data = {
                          id: String(l.id),
                          name: l?.name ?? null,
                          lat: l?.lat ?? null,
                          lng: l?.lng ?? null,
                          radiusMiles: l?.radiusMiles ?? null,
                          savedAt: Date.now(),
                        };
                        localStorage.setItem("marketplace.defaultLocationData", JSON.stringify(data));
                        // Mirror to cookie for server-side redirects (middleware)
                        try {
                          document.cookie =
                            "last_location_id=" +
                            encodeURIComponent(String(l.id)) +
                            "; Max-Age=15552000; Path=/; SameSite=Lax";
                        } catch {}
                      } catch {}
                      router.push(`/location/${encodeURIComponent(l.id)}`);
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
    </>
  );
};

export default function Home() {
  return (
    <Suspense fallback={null}>
      {/* Early redirect before hydration using localStorage (no data fetch) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var params=new URLSearchParams(window.location.search);if(params.get('home')==='1')return;var raw=localStorage.getItem('marketplace.defaultLocationData');if(!raw)return;var parsed;try{parsed=JSON.parse(raw)}catch(e){parsed=null}var id=parsed&&parsed.id;if(id){window.location.replace('/location/'+encodeURIComponent(id))}}catch(e){}})();`,
        }}
      />
      <HomeInner />
    </Suspense>
  );
}
