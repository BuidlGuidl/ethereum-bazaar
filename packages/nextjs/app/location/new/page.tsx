"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MapRadius = dynamic(() => import("~~/components/marketplace/MapRadiusGL"), { ssr: false });

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  akas?: string[];
};

export default function NewLocationPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [radius, setRadius] = useState<number>(5);
  const [radiusText, setRadiusText] = useState<string>("5");
  const [creating, setCreating] = useState(false);
  const [overlaps, setOverlaps] = useState<any[] | null>(null);
  const [overlapPrompt, setOverlapPrompt] = useState<boolean>(false);
  const [akas, setAkas] = useState<string[]>([]);
  const [akaInput, setAkaInput] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [selectedCanonicalName, setSelectedCanonicalName] = useState<string>("");
  const [initialDisplayName, setInitialDisplayName] = useState<string>("");
  const [showMap, setShowMap] = useState(true);
  const [stage, setStage] = useState<"search" | "form">("search");
  const [loading, setLoading] = useState<boolean>(false);

  // const selected = useMemo(() => ({ lat, lng, radius }), [lat, lng, radius]);

  useEffect(() => {
    const run = async () => {
      const q = query.trim();
      if (q.length < 3) {
        setResults([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const json = await res.json();
          console.log("json", json);
          setResults(json.results || []);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    const q = query.trim();
    if (q.length >= 3) {
      setLoading(true);
    }
    const id = setTimeout(run, 400);
    return () => clearTimeout(id);
  }, [query]);

  const createLocation = async (opts?: { force?: boolean }) => {
    if (!lat || !lng) return;
    setCreating(true);
    try {
      const pending = akaInput.trim();
      const merged = pending ? [...akas, pending] : akas;
      const withCanonical = selectedCanonicalName ? [...merged, selectedCanonicalName] : merged;
      const finalAkas = Array.from(new Set(withCanonical.filter(Boolean)));
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: displayName || query,
          lat,
          lng,
          radiusMiles: radius,
          temporary: false,
          akas: finalAkas,
          force: Boolean(opts?.force),
        }),
      });
      const json = await res.json();
      if (res.status === 409 && json?.promptExisting) {
        setOverlapPrompt(true);
        setOverlaps(Array.isArray(json?.existing) ? json.existing.filter(Boolean) : []);
        return;
      }
      if (res.ok) {
        setOverlapPrompt(false);
        // store recent
        try {
          const stored = localStorage.getItem("marketplace.locations");
          const arr = stored ? (JSON.parse(stored) as string[]) : [];
          const next = Array.from(new Set([json.id, ...arr])).slice(0, 5);
          localStorage.setItem("marketplace.locations", JSON.stringify(next));
        } catch {}
        window.history.back();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {stage === "form" && (
        <button
          className="btn btn-ghost btn-sm w-fit"
          onClick={() => {
            setStage("search");
          }}
        >
          ← Back to search
        </button>
      )}
      <h1 className="text-2xl font-semibold">Create Location</h1>

      {stage === "search" && (
        <div className="space-y-2">
          <input
            className="input input-bordered w-full"
            placeholder="Search place (e.g., NYC, NY)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {loading && (
            <div className="mt-2 flex items-center gap-2">
              <span className="loading loading-spinner loading-md" />
              <span className="opacity-70 text-sm">Searching…</span>
            </div>
          )}
          {!loading && query.trim().length >= 3 && results.length === 0 && (
            <div className="mt-2 opacity-70 text-sm">no locations found for that search.</div>
          )}
          {results.length > 0 && (
            <div className="rounded-xl border bg-base-100 max-h-60 overflow-y-auto divide-y divide-base-200">
              {results.map(r => (
                <button
                  key={`${r.lat},${r.lon}`}
                  className="btn btn-ghost btn-sm w-full justify-start h-10 normal-case"
                  onClick={() => {
                    setShowMap(false);
                    setLat(parseFloat(r.lat));
                    setLng(parseFloat(r.lon));
                    setDisplayName(r.display_name);
                    setSelectedCanonicalName(r.display_name);
                    setInitialDisplayName(r.display_name);
                    // Prefill AKAs from search result
                    try {
                      const dn = (r.display_name || "").trim().toLowerCase();
                      const aliases = Array.isArray(r.akas)
                        ? r.akas.map(a => (a || "").trim()).filter(a => Boolean(a) && a.toLowerCase() !== dn)
                        : [];
                      if (aliases.length > 0) {
                        setAkas(prev => Array.from(new Set([...(prev || []), ...aliases])));
                      }
                    } catch {}
                    setTimeout(() => setShowMap(true), 0);
                    setStage("form");
                  }}
                >
                  <div className="flex-1 truncate text-left">{r.display_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {stage === "form" && (
        <>
          <div className="space-y-2">
            <label className="label">
              <span className="label-text">Display name</span>
            </label>
            <input
              className="input input-bordered w-full"
              placeholder="e.g., Richmond, VA downtown"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onBlur={() => {
                const trimmedInitial = (initialDisplayName || "").trim();
                if (!trimmedInitial) return;
                const trimmedCurrent = (displayName || "").trim();
                if (trimmedCurrent.toLowerCase() !== trimmedInitial.toLowerCase()) {
                  setAkas(prev => {
                    const arr = Array.isArray(prev) ? prev : [];
                    const has = arr.some(a => (a || "").trim().toLowerCase() === trimmedInitial.toLowerCase());
                    return has ? arr : [...arr, trimmedInitial];
                  });
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="label">
              <span className="label-text">Radius (miles)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={radiusText}
              min={1}
              step={0.5}
              onChange={e => {
                const v = e.target.value;
                setRadiusText(v);
                const n = parseFloat(v);
                if (Number.isFinite(n)) setRadius(n);
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="label">
              <span className="label-text">Also known as</span>
            </label>
            {akas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {akas.map((a, idx) => (
                  <div key={`${a}-${idx}`} className="badge gap-1">
                    <span className="truncate max-w-[180px]">{a}</span>
                    <button
                      type="button"
                      className="ml-1 opacity-70 hover:opacity-100"
                      onClick={() => setAkas(prev => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              className="input input-bordered w-full"
              placeholder="Add an alias, e.g., Richmond, VA"
              value={akaInput}
              onChange={e => setAkaInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = akaInput.trim();
                  if (v) {
                    setAkas(prev => Array.from(new Set([...(prev || []), v])));
                    setAkaInput("");
                  }
                }
              }}
            />
          </div>

          <div className="rounded-xl bg-base-200 p-0 overflow-hidden">
            {lat && lng && showMap ? (
              <MapRadius
                lat={lat}
                lng={lng}
                radiusMiles={radius}
                onMove={(la: number, ln: number) => {
                  setLat(la);
                  setLng(ln);
                }}
              />
            ) : (
              <div className="p-4 text-sm opacity-70">Select a place to preview</div>
            )}
          </div>

          {!overlapPrompt && (
            <button
              className="btn btn-primary w-full"
              disabled={!lat || !lng || creating}
              onClick={() => createLocation()}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          )}

          {overlapPrompt && (
            <div className="space-y-2">
              <div className="alert alert-warning">Existing locations found nearby. Use one?</div>
              {Array.isArray(overlaps) && overlaps.length > 0 && (
                <div className="space-y-1">
                  {overlaps.filter(Boolean).map(l => (
                    <button
                      key={(l && l.id) || Math.random().toString(36)}
                      className="btn btn-sm w-full justify-start"
                      onClick={() => {
                        try {
                          const stored = localStorage.getItem("marketplace.locations");
                          const arr = stored ? (JSON.parse(stored) as string[]) : [];
                          const idToStore = (l && l.id) || "";
                          const next = Array.from(new Set([idToStore, ...arr])).slice(0, 5);
                          localStorage.setItem("marketplace.locations", JSON.stringify(next));
                        } catch {}
                        window.history.back();
                      }}
                    >
                      <div className="truncate text-left">
                        <div className="font-medium">{(l && (l.name || l.id)) || "Unknown"}</div>
                        <div className="text-xs opacity-70">{l && l.id}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="text-sm opacity-70">Or continue to create a new one if you prefer.</div>
              <button
                className="btn btn-primary w-full"
                disabled={creating}
                onClick={() => createLocation({ force: true })}
              >
                Create anyway
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
