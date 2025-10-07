"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const LocationPage = () => {
  const params = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<any | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLocation(null);
      try {
        const id = params?.id as string;
        if (!id) return;
        const res = await fetch(`/api/locations/${id}`);
        if (res.ok) {
          const json = await res.json();
          setLocation(json.location || null);
        } else if (res.status === 404) {
          try {
            const stored = localStorage.getItem("marketplace.defaultLocation");
            if (stored === id) localStorage.removeItem("marketplace.defaultLocation");
          } catch {}
          // redirect to home if this location no longer exists
          window.location.href = "/?home=1";
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [params?.id]);

  // TODO: Replace with onchain fetch once deployedContracts updated
  useEffect(() => {
    setListings([]);
  }, [params?.id]);

  const filtered = useMemo(() => {
    if (!query) return listings;
    return listings.filter(l => (l.title || "").toLowerCase().includes(query.toLowerCase()));
  }, [listings, query]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{location?.name || params?.id}</h1>
        <Link href="/listing/new" className="btn btn-primary">
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
            <Link key={item.id} href={`/listing/${item.id}`} className="p-3 border rounded-xl">
              <div className="font-medium">{item.title}</div>
              <div className="text-sm opacity-80">{item.price}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationPage;
