"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { MiniappUserInfo } from "~~/components/MiniappUserInfo";
import { Address } from "~~/components/scaffold-eth";

const MapRadius = dynamic(() => import("~~/components/marketplace/MapRadiusGL"), { ssr: false });

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loadingSelected, setLoadingSelected] = useState(false);

  useEffect(() => {
    const run = async () => {
      const q = query.trim();
      const res = await fetch(`/api/locations?all=1&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setLocations(Array.isArray(json.locations) ? json.locations : []);
      }
    };
    const id = setTimeout(run, 300);
    return () => clearTimeout(id);
  }, [query]);

  // Redirect to user's selected default location unless explicitly on Home (?home=1)
  useEffect(() => {
    try {
      const suppress = searchParams?.get("home") === "1";
      if (suppress) return;
      const stored = localStorage.getItem("marketplace.defaultLocation");
      if (stored) {
        // verify the location still exists before redirecting
        fetch(`/api/locations/${stored}`)
          .then(async res => {
            if (res.ok) {
              router.replace(`/location/${stored}`);
            } else {
              try {
                localStorage.removeItem("marketplace.defaultLocation");
              } catch {}
              router.replace(`/?home=1`);
            }
          })
          .catch(() => {
            try {
              localStorage.removeItem("marketplace.defaultLocation");
            } catch {}
            router.replace(`/?home=1`);
          });
      }
    } catch {}
  }, [router, searchParams]);

  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5 w-full max-w-5xl">
          <div className="flex items-center justify-between">
            <h1 className="text-center flex-1">
              <span className="block text-2xl mb-2">Welcome to</span>
              <span className="block text-4xl font-bold">Scaffold-ETH 2</span>
              <span className="block text-xl font-bold">(miniapp extension)</span>
            </h1>
            <Link href="/location/new" className="btn btn-primary">
              Create location
            </Link>
          </div>
          <div className="flex justify-center items-center space-x-2 flex-col">
            <p className="my-2 font-medium">Connected Address:</p>
            <Address address={connectedAddress} />
          </div>

          {/* MiniApp User Info */}
          <MiniappUserInfo />
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
            {locations.map(l => (
              <button
                key={l.id}
                className="card bg-base-100 border border-base-300 hover:border-primary/60 transition-colors text-left"
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
            {locations.length === 0 && <div className="opacity-70">No locations found. Try a different search.</div>}
          </div>
          <p className="text-center text-lg">
            Get started by editing{" "}
            <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
              packages/nextjs/app/page.tsx
            </code>
          </p>
          <p className="text-center text-lg">
            Edit your smart contract{" "}
            <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
              YourContract.sol
            </code>{" "}
            in{" "}
            <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
              packages/hardhat/contracts
            </code>
          </p>
        </div>

        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col md:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Tinker with your smart contract using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Location Preview Modal */}
      <div>
        <input type="checkbox" id="location-preview-modal" className="modal-toggle" />
        <label htmlFor="location-preview-modal" className="modal cursor-pointer">
          <label className="modal-box relative max-w-3xl">
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
              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  try {
                    if (selected?.id) localStorage.setItem("marketplace.defaultLocation", selected.id);
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
