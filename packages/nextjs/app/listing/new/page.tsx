"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { encodeAbiParameters, isAddress, keccak256, parseEther, parseUnits, stringToHex, zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { useMiniapp } from "~~/components/MiniappProvider";
import { IPFSUploader } from "~~/components/marketplace/IPFSUploader";
import { TagsInput } from "~~/components/marketplace/TagsInput";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
// import { resolveIpfsUrl } from "~~/services/ipfs/fetch";
import { uploadFile, uploadJSON } from "~~/services/ipfs/upload";
import { fetchListingById } from "~~/services/marketplace/graphql";
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

// Minimal ERC20 ABI to read symbol (for custom tokens)
const ERC20_SYMBOL_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const KNOWN_TOKENS = TOKENS_JSON as Record<string, `0x${string}`>;

const buildContactObject = (contacts: Array<{ type: string; key?: string; value: string }>) => {
  return Object.fromEntries(
    contacts
      .filter(c => (c.value || "").trim())
      .map(c => [(c.type === "other" ? c.key || "other" : c.type).trim(), c.value.trim()]),
  );
};

const parseTags = (tags: string[] | string | null): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (typeof tags === "string")
    return tags
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  return [];
};

const determineCurrencyAndToken = (paymentToken: string | null): { currency: string; tokenAddress: string } => {
  if (!paymentToken) return { currency: "ETH", tokenAddress: "" };

  const pt = paymentToken.toLowerCase();
  if (pt === zeroAddress.toLowerCase()) return { currency: "ETH", tokenAddress: "" };

  // Check if it's a known token
  const knownTokenEntry = Object.entries(KNOWN_TOKENS).find(([, addr]) => addr.toLowerCase() === pt);
  if (knownTokenEntry) return { currency: knownTokenEntry[0], tokenAddress: "" };

  // Custom token
  return { currency: "TOKEN", tokenAddress: pt };
};

const parseContactEntries = (
  contact: Record<string, string> | null,
): Array<{ type: string; key?: string; value: string }> => {
  if (!contact) return [{ type: "farcaster", value: "" }];

  const knownTypes = ["farcaster", "telegram", "email", "text", "phone", "whatsapp"];
  const entries = Object.entries(contact).map(([k, v]) => {
    const type = knownTypes.includes(k) ? k : "other";
    return { type, key: type === "other" ? k : undefined, value: v };
  });

  return entries.length ? entries : [{ type: "farcaster", value: "" }];
};

const NewListingPageInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingId = useMemo(() => {
    const v = searchParams.get("edit");
    return v ? v : null;
  }, [searchParams]);
  const { composeCast, isMiniApp } = useMiniapp();
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
  const { data: marketplaceInfo } = useDeployedContractInfo({ contractName: "Marketplace" });

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

  // Attempt to fetch symbol for custom tokens for a nicer price label
  const { data: tokenSymbolData } = useReadContract({
    address: isCustomToken && isTokenAddressValid ? (tokenAddress as `0x${string}`) : undefined,
    abi: ERC20_SYMBOL_ABI,
    functionName: "symbol",
    query: {
      enabled: isCustomToken && isTokenAddressValid,
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

  // Derive a human-friendly price label similar to listing page using in-memory values
  const priceLabel = useMemo(() => {
    const trimmed = (price || "").trim();
    if (!trimmed) return "";
    try {
      if (isCustomToken) {
        const sym = (tokenSymbolData as string | undefined) || "TOKEN";
        return `${trimmed} ${sym}`;
      }
      if (isKnownToken) {
        return `${trimmed} ${currency}`;
      }
      return `${trimmed} ETH`;
    } catch {
      return trimmed;
    }
  }, [price, isCustomToken, isKnownToken, tokenSymbolData, currency]);

  const uploadImageIfNeeded = async () => {
    if (selectedImage) {
      try {
        const uploaded = await uploadFile(selectedImage);
        setImageCid(uploaded);
        return uploaded;
      } catch {}
    }
    return imageCid;
  };

  const buildMetadata = (finalImageCid: string | null) => {
    const contactObj = buildContactObject(contacts);
    return {
      title,
      description,
      category,
      tags,
      price,
      currency,
      contact: Object.keys(contactObj).length ? contactObj : undefined,
      image: finalImageCid || null,
      locationId,
    };
  };

  const encodePaymentData = () => {
    const paymentToken: `0x${string}` = isCustomToken
      ? (tokenAddress as `0x${string}`)
      : isKnownToken
        ? (KNOWN_TOKENS[currency] as `0x${string}`)
        : zeroAddress;
    const priceWei = !(isCustomToken || isKnownToken)
      ? parseEther(price || "0")
      : parseUnits(price || "0", decimalsOverride ?? 18);

    return encodeAbiParameters(
      [
        { name: "paymentToken", type: "address" },
        { name: "price", type: "uint256" },
      ],
      [paymentToken, priceWei],
    );
  };

  const extractListingId = (receipt: any) => {
    try {
      const mpAddress = (marketplaceInfo?.address || "").toLowerCase();
      const createdLog = receipt.logs.find((l: any) => l.address?.toLowerCase() === mpAddress);
      if (createdLog && createdLog.topics && createdLog.topics.length >= 2) {
        try {
          const hex = createdLog.topics[1] as string;
          if (hex && hex.startsWith("0x")) return String(BigInt(hex));
        } catch {}
      }
    } catch {}
    return undefined;
  };

  const shareListingCast = (newId: string) => {
    if (isMiniApp) {
      try {
        const base = process.env.NEXT_PUBLIC_URL || (typeof window !== "undefined" ? window.location.origin : "");
        const url = `${base}/listing/${encodeURIComponent(newId)}`;
        const text = `Check out my new listing: ${title}\n\n${description}${priceLabel ? `\n\n${priceLabel}` : ""}`;
        const embeds: string[] = [url];
        setTimeout(() => {
          composeCast({ text, embeds }).catch(() => {});
        }, 300);
      } catch {}
    }
  };

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
      if (editingId) {
        const sigHash = keccak256(stringToHex("close(uint256,address,bool,address,bytes)"));
        const selector = `0x${sigHash.slice(2, 10)}` as `0x${string}`;
        const action = (selector + "0".repeat(64 - 8)) as `0x${string}`;
        await writeMarketplace({ functionName: "callAction", args: [BigInt(editingId), action, "0x"] });
      }

      const finalImageCid = await uploadImageIfNeeded();

      const metadata = buildMetadata(finalImageCid);
      const cid = await uploadJSON(metadata);
      const encoded = encodePaymentData();

      await writeMarketplace(
        {
          functionName: "createListing",
          args: [simpleListings?.address as `0x${string}`, cid, encoded],
        },
        {
          blockConfirmations: 1,
          onBlockConfirmation: receipt => {
            const newId = extractListingId(receipt);
            router.push(`/location/${encodeURIComponent(locationId)}`);
            if (newId) shareListingCast(newId);
          },
        },
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!editingId) return;
    const populateListingData = async () => {
      try {
        const item = await fetchListingById(editingId);
        if (!item) return;

        setTitle(item.title || "");
        setDescription(item.description || "");
        setCategory(item.category || "");
        setPrice(item.price || "");
        setImageCid(item.image);
        setLocationId(item.locationId || "");
        setTags(parseTags(item.tags));

        const { currency, tokenAddress } = determineCurrencyAndToken(item.paymentToken);
        setCurrency(currency);
        setTokenAddress(tokenAddress);

        if (typeof item.tokenDecimals === "number" && item.tokenDecimals >= 0 && item.tokenDecimals <= 255) {
          setDecimalsOverride(item.tokenDecimals);
        }

        setContacts(parseContactEntries(item.contact));
      } catch {}
    };

    populateListingData();
  }, [editingId]);

  useEffect(() => {
    if (editingId) return;
    try {
      const viaQuery = searchParams?.get("loc");
      if (viaQuery) {
        const decoded = decodeURIComponent(viaQuery);
        setLocationId(decoded);
        // persist into recents for consistency (only when not editing)
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
  }, [searchParams, editingId]);

  // No location picker UI on this page; we rely on the selected location from storage

  return (
    <>
      <form
        aria-busy={submitting}
        className={`p-4 space-y-3 ${submitting ? "opacity-60 pointer-events-none" : ""}`}
        onSubmit={onSubmit}
      >
        <h1 className="text-2xl font-semibold">{editingId ? "Edit" : "Create Listing"}</h1>
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
            <option value="experiences">Experiences</option>
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
          {editingId ? (submitting ? "Saving..." : "Save Changes") : submitting ? "Creating..." : "Create"}
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
