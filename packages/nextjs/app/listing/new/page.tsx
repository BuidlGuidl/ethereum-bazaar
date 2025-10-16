"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { encodeAbiParameters, isAddress, parseEther, parseUnits, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { IPFSUploader } from "~~/components/marketplace/IPFSUploader";
import { TagsInput } from "~~/components/marketplace/TagsInput";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { uploadJSON } from "~~/services/ipfs/upload";
import TOKENS_JSON from "~~/tokens.json";

// Minimal ERC20 ABI to read decimals
const ERC20_DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const KNOWN_TOKENS = TOKENS_JSON as Record<string, `0x${string}`>;

const NewListingPageInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("ETH");
  const [tokenAddress, setTokenAddress] = useState("");
  const [decimalsOverride, setDecimalsOverride] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Array<{ type: string; key?: string; value: string }>>([]);
  const [locationId, setLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageCid, setImageCid] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const { writeContractAsync: writeMarketplace } = useScaffoldWriteContract({ contractName: "Marketplace" });
  const { data: simpleListings } = useDeployedContractInfo({ contractName: "SimpleListings" });

  const isCustomToken = currency === "TOKEN";
  const isKnownToken = currency !== "ETH" && currency !== "TOKEN" && Boolean(KNOWN_TOKENS[currency]);
  const isTokenAddressValid = useMemo(() => isAddress(tokenAddress || "0x"), [tokenAddress]);

  const { data: tokenDecimalsData, isFetching: loadingDecimals } = useReadContract({
    address:
      isCustomToken && isTokenAddressValid
        ? (tokenAddress as `0x${string}`)
        : isKnownToken
          ? (KNOWN_TOKENS[currency] as `0x${string}`)
          : undefined,
    abi: ERC20_DECIMALS_ABI,
    functionName: "decimals",
    query: {
      enabled: (isCustomToken && isTokenAddressValid) || isKnownToken,
      retry: false,
    },
  });

  useEffect(() => {
    if (!(isCustomToken || isKnownToken)) {
      setDecimalsOverride(null);
      return;
    }
    if (tokenDecimalsData !== undefined) {
      try {
        const n = Number(tokenDecimalsData as unknown as number);
        if (Number.isFinite(n) && n >= 0 && n <= 255) setDecimalsOverride(n);
      } catch {
        // ignore
      }
    } else {
      setDecimalsOverride(null);
    }
  }, [tokenDecimalsData, isCustomToken, isKnownToken]);

  const hasAtLeastOneContact = useMemo(() => {
    return contacts.some(c => (c.value || "").trim().length > 0);
  }, [contacts]);

  const isNonZeroPrice = useMemo(() => {
    const trimmed = (price || "").trim();
    if (!trimmed) return false;
    try {
      if (isCustomToken || isKnownToken) {
        if (decimalsOverride === null) return false;
        const v = parseUnits(trimmed, (decimalsOverride ?? 18) as number);
        return v > 0n;
      }
      const v = parseEther(trimmed);
      return v > 0n;
    } catch {
      return false;
    }
  }, [price, isCustomToken, isKnownToken, decimalsOverride]);

  const canSubmit = useMemo(() => {
    if (!locationId) return false;
    if (!(title || "").trim()) return false;
    if (!isNonZeroPrice) return false;
    if (!hasAtLeastOneContact) return false;
    if (isCustomToken) return isTokenAddressValid && decimalsOverride !== null && !loadingDecimals;
    if (isKnownToken) return decimalsOverride !== null && !loadingDecimals;
    return true;
  }, [
    locationId,
    title,
    isNonZeroPrice,
    hasAtLeastOneContact,
    isCustomToken,
    isKnownToken,
    isTokenAddressValid,
    decimalsOverride,
    loadingDecimals,
  ]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!locationId) {
        setSubmitting(false);
        return;
      }
      if (!contacts.some(c => (c.value || "").trim().length > 0)) {
        setSubmitting(false);
        return;
      }
      // If a file is selected but not uploaded yet, upload it now
      if (!imageCid && selectedImage) {
        try {
          // Lazy-import to avoid circulars when rendering server
          const { uploadFile } = await import("~~/services/ipfs/upload");
          const uploaded = await uploadFile(selectedImage);
          setImageCid(uploaded);
          // Use local variable to avoid race with state update
          const localImageCid = uploaded;
          const contactObject = Object.fromEntries(
            contacts
              .filter(c => (c.value || "").trim())
              .map(c => [(c.type === "other" ? c.key || "other" : c.type).trim(), c.value.trim()]),
          );

          const metadata = {
            title,
            description,
            category,
            tags,
            price,
            currency,
            contact: Object.keys(contactObject).length ? contactObject : undefined,
            image: localImageCid,
            locationId,
          };
          const cid = await uploadJSON(metadata);

          const paymentToken: `0x${string}` = isCustomToken
            ? (tokenAddress as `0x${string}`)
            : isKnownToken
              ? (KNOWN_TOKENS[currency] as `0x${string}`)
              : zeroAddress;
          const priceWei = !(isCustomToken || isKnownToken)
            ? parseEther(price || "0")
            : parseUnits(price || "0", (decimalsOverride ?? 18) as number);

          const encoded = encodeAbiParameters(
            [
              { name: "paymentToken", type: "address" },
              { name: "price", type: "uint256" },
            ],
            [paymentToken, priceWei],
          );

          await writeMarketplace({
            functionName: "createListing",
            args: [simpleListings?.address as `0x${string}`, cid, encoded],
          });
          router.push(`/location/${encodeURIComponent(locationId)}`);
          return;
        } catch {}
      }

      const contactObject = Object.fromEntries(
        contacts
          .filter(c => (c.value || "").trim())
          .map(c => [(c.type === "other" ? c.key || "other" : c.type).trim(), c.value.trim()]),
      );

      const metadata = {
        title,
        description,
        category,
        tags,
        price,
        currency,
        contact: Object.keys(contactObject).length ? contactObject : undefined,
        image: imageCid || null,
        locationId,
      };
      const cid = await uploadJSON(metadata);

      const paymentToken: `0x${string}` = isCustomToken
        ? (tokenAddress as `0x${string}`)
        : isKnownToken
          ? (KNOWN_TOKENS[currency] as `0x${string}`)
          : zeroAddress;
      const priceWei = !(isCustomToken || isKnownToken)
        ? parseEther(price || "0")
        : parseUnits(price || "0", decimalsOverride ?? 18);

      // use viem to encode the data
      const encoded = encodeAbiParameters(
        [
          { name: "paymentToken", type: "address" },
          { name: "price", type: "uint256" },
        ],
        [paymentToken, priceWei],
      );

      await writeMarketplace({
        functionName: "createListing",
        args: [simpleListings?.address as `0x${string}`, cid, encoded],
      });
      router.push(`/location/${encodeURIComponent(locationId)}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Initialize selected location preferring query param (?loc=)
  useEffect(() => {
    try {
      const viaQuery = searchParams?.get("loc");
      if (viaQuery) {
        const decoded = decodeURIComponent(viaQuery);
        setLocationId(decoded);
        // persist into recents for consistency
        try {
          const stored = localStorage.getItem("marketplace.locations");
          const prev: string[] = stored ? JSON.parse(stored) : [];
          const next = Array.from(new Set([decoded, ...prev])).slice(0, 5);
          localStorage.setItem("marketplace.locations", JSON.stringify(next));
        } catch {}
        return;
      }
      const stored = localStorage.getItem("marketplace.locations");
      if (stored) {
        const arr: string[] = JSON.parse(stored);
        if (arr[0]) setLocationId(arr[0]);
      }
    } catch {}
  }, [searchParams]);

  // No location picker UI on this page; we rely on the selected location from storage

  return (
    <>
      <form
        aria-busy={submitting}
        className={`p-4 space-y-3 ${submitting ? "opacity-60 pointer-events-none" : ""}`}
        onSubmit={onSubmit}
      >
        <h1 className="text-2xl font-semibold">Create Listing</h1>
        <input
          className="input input-bordered w-full"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className="textarea textarea-bordered w-full"
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <div className="space-y-1">
          <label className="text-sm opacity-80">Category</label>
          <select
            className="select select-bordered w-full"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">Select a category</option>
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
        </div>

        <div className="space-y-1">
          <label className="text-sm opacity-80">Tags (commas separated)</label>
          <TagsInput value={tags} onChange={setTags} placeholder="e.g. iphone, mint, boxed" />
        </div>
        <div className="flex gap-2 items-center">
          <input
            className="input input-bordered basis-2/3 min-w-0"
            placeholder="Price"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
          <select
            className="select select-bordered basis-1/3 min-w-0"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
          >
            <option value="ETH">ETH</option>
            {Object.keys(KNOWN_TOKENS)
              .sort()
              .map(sym => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            <option value="TOKEN">Custom token</option>
          </select>
        </div>
        {isCustomToken ? (
          <div className="space-y-1">
            <input
              className="input input-bordered w-full"
              placeholder="ERC20 token address (0x...)"
              value={tokenAddress}
              onChange={e => setTokenAddress(e.target.value)}
            />
            <div className="text-xs opacity-70">
              {tokenAddress && !isTokenAddressValid ? "Enter a valid token address" : null}
              {isTokenAddressValid && loadingDecimals ? "Loading token decimals…" : null}
              {isTokenAddressValid && !loadingDecimals && decimalsOverride !== null
                ? `Token decimals: ${decimalsOverride}`
                : null}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="font-medium">Contact methods</div>
          {contacts.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 min-w-0">
              <select
                className="select select-bordered select-sm basis-1/3 min-w-0"
                value={c.type}
                onChange={e => {
                  const next = [...contacts];
                  next[idx] = { ...next[idx], type: e.target.value };
                  if (e.target.value !== "other") delete next[idx].key;
                  setContacts(next);
                }}
              >
                <option value="farcaster">Farcaster</option>
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
                <option value="text">Text</option>
                <option value="phone">Phone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="other">Other</option>
              </select>
              <div className="flex items-center gap-2 basis-2/3 min-w-0">
                {c.type === "other" ? (
                  <input
                    className="input input-bordered input-sm w-20 shrink-0"
                    placeholder="Label"
                    value={c.key || ""}
                    onChange={e => {
                      const next = [...contacts];
                      next[idx] = { ...next[idx], key: e.target.value };
                      setContacts(next);
                    }}
                  />
                ) : null}
                <input
                  className="input input-bordered input-sm flex-1 min-w-0"
                  placeholder="Contact detail (e.g. @handle, email, number)"
                  value={c.value}
                  onChange={e => {
                    const next = [...contacts];
                    next[idx] = { ...next[idx], value: e.target.value };
                    setContacts(next);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  aria-label="Remove contact method"
                  onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setContacts([...contacts, { type: "farcaster", value: "" }])}
          >
            + Add contact method
          </button>
        </div>
        <IPFSUploader onSelected={setSelectedImage} />
        <button className="btn btn-primary w-full" disabled={submitting || !canSubmit}>
          {submitting ? "Creating..." : "Create"}
        </button>
      </form>
    </>
  );
};

export default function NewListingPage() {
  return (
    <Suspense fallback={null}>
      <NewListingPageInner />
    </Suspense>
  );
}
