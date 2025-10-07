"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const LocationSelector = () => {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("marketplace.locations");
      if (stored) setRecent(JSON.parse(stored));
    } catch {}
  }, []);

  const select = (id: string) => {
    try {
      const next = Array.from(new Set([id, ...recent])).slice(0, 5);
      localStorage.setItem("marketplace.locations", JSON.stringify(next));
    } catch {}
    router.push(`/location/${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-2">
      <div className="join w-full">
        <input
          className="input input-bordered join-item w-full"
          placeholder="Search or create a location (e.g., NYC, ETH NYC 2025)"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button className="btn btn-primary join-item" onClick={() => input && select(input)}>
          Go
        </button>
        <button className="btn join-item" onClick={() => router.push("/location/new")}>
          Create location
        </button>
      </div>
      {recent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recent.map(r => (
            <button key={r} className="btn btn-xs" onClick={() => select(r)}>
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
