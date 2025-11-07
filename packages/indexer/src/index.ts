import { ponder } from "ponder:registry";
import { eq } from "drizzle-orm";
import { listings, listing_actions, reviews } from "ponder:schema";
import { createPublicClient, http, decodeAbiParameters, Hex, keccak256, stringToHex, zeroAddress } from "viem";
import easConfig from "./easConfig.json" assert { type: "json" };
import { easGetAttestationAbi } from "../abis/EASAbi";

// Reuse one public client for reads
const rpcUrl =
  process.env[`PONDER_RPC_URL_${process.env.PONDER_CHAIN_ID}`] ??
  "https://base.llamarpc.com";
const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

// --- IPFS helpers (resilient multi-gateway JSON fetch) ---
const PREFERRED_GATEWAY =
  process.env.PONDER_IPFS_GATEWAY || "https://ipfs.io/ipfs/";

function toIpfsPath(cidOrUrl: string | null | undefined): string {
  if (!cidOrUrl) return "";
  const input = cidOrUrl.trim();
  if (!input) return "";
  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const u = new URL(input);
      const idx = u.href.indexOf("/ipfs/");
      if (idx >= 0) return u.href.substring(idx + "/ipfs/".length);
      return input; // already a raw URL
    } catch {
      return input;
    }
  }
  if (input.startsWith("ipfs://")) return input.substring("ipfs://".length);
  return input;
}

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchIpfsJson(cidOrUrl: string): Promise<any | null> {
  const path = toIpfsPath(cidOrUrl);
  if (!path) return null;
  const bases = [
    PREFERRED_GATEWAY,
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://w3s.link/ipfs/",
    "https://nftstorage.link/ipfs/",
  ];
  const candidates = path.startsWith("http") ? [path] : bases.map(b => (b.endsWith("/") ? `${b}${path}` : `${b}/${path}`));
  const maxPasses = 3;
  for (let pass = 1; pass <= maxPasses; pass++) {
    for (const url of candidates) {
      try {
        const res = await fetchWithTimeout(url, 2000);
        if (!res.ok) continue;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          return await res.json();
        }
        // attempt JSON parse even if header missing
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {}
      } catch (e) {
        console.log(`Failed to fetch IPFS JSON (pass ${pass}) from ${url}`);
        console.log(e);
      }
    }
  }
  return null;
}

// Minimal ABI to read listing pointer + data from Marketplace
const marketplaceGetListingAbi = [
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "listingType", type: "address" },
      { name: "contenthash", type: "bytes32" },
      { name: "active", type: "bool" },
      { name: "listingData", type: "bytes" },
    ],
  },
] as const;

function signatureToSelector(signature: string): `0x${string}` {
  const hash = keccak256(stringToHex(signature));
  return (`0x${hash.slice(2, 10)}`) as `0x${string}`;
}

ponder.on("Marketplace:ListingCreated" as any, async ({ event, context }) => {
  const { db } = context;
  const args = (event as any).args;
  const id = args.id.toString();
  const creator = (args.creator as string).toLowerCase();
  const listingType = (args.listingType as string).toLowerCase();
  const cid = (args.contenthash as string);

  await db.insert(listings).values({
    id,
    creator,
    listingType,
    cid, // stored as-is per app contract design
    active: true,
    createdBlockNumber: event.block.number.toString(),
    createdBlockTimestamp: event.block.timestamp.toString(),
    createdTxHash: (event as any).transaction?.hash ?? (event as any).log?.transactionHash ?? "",
  });

  // Read on-chain listingData to enrich token info and metadata
  try {
    const [/*creatorAddr*/, /*listingTypeAddr*/, /*contenthash*/, /*activeFlag*/, listingData] = (await publicClient.readContract({
      address: (event as any).log?.address as `0x${string}`,
      abi: marketplaceGetListingAbi,
      functionName: "getListing",
      args: [BigInt(id)],
    })) as unknown as any[];

    if (listingData) {
      try {
        // Try QuantityListing 4-tuple first, then fallback to SimpleListing 2-tuple
        let paymentTokenDecoded: string | null = null;
        let unitPriceWei: string | null = null;
        let initialQty: number | null = null;
        let remainingQty: number | null = null;
        try {
          const [pt, unitPrice, initQ, remainQ] = decodeAbiParameters(
            [{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
            listingData as Hex,
          );
          paymentTokenDecoded = (pt as string) || null;
          unitPriceWei = (unitPrice as bigint)?.toString?.() ?? null;
          initialQty = Number(initQ as bigint);
          remainingQty = Number(remainQ as bigint);
        } catch {
          const [pt, price] = decodeAbiParameters(
            [{ type: "address" }, { type: "uint256" }],
            listingData as Hex,
          );
          paymentTokenDecoded = (pt as string) || null;
          unitPriceWei = (price as bigint)?.toString?.() ?? null;
          initialQty = null;
          remainingQty = null;
        }

        const unlimited = initialQty === 0 ? true : (initialQty == null ? null : false);
        await db.sql.update(listings).set({
          paymentToken: paymentTokenDecoded?.toLowerCase?.() ?? null,
          priceWei: unitPriceWei,
          initialQuantity: initialQty ?? null,
          remainingQuantity: remainingQty ?? null,
          unlimited: unlimited as any,
        }).where(eq(listings.id, id));

        // Resolve token metadata (ETH defaults; ERC-20 reads)
        try {
          const pt = (paymentTokenDecoded as string)?.toLowerCase?.() ?? "";
          if (!pt || pt === zeroAddress) {
            await db.sql
              .update(listings)
              .set({ tokenName: "Ether", tokenSymbol: "ETH", tokenDecimals: 18 })
              .where(eq(listings.id, id));
          } else {
            const erc20MetaAbi = [
              { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
              { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
              { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
            ] as const;
            const [name, symbol, decimals] = await Promise.all([
              publicClient.readContract({ address: pt as `0x${string}`, abi: erc20MetaAbi, functionName: "name" }).catch(() => null),
              publicClient.readContract({ address: pt as `0x${string}`, abi: erc20MetaAbi, functionName: "symbol" }).catch(() => null),
              publicClient.readContract({ address: pt as `0x${string}`, abi: erc20MetaAbi, functionName: "decimals" }).catch(() => null),
            ]);
            await db.sql
              .update(listings)
              .set({
                tokenName: typeof name === "string" ? name : null,
                tokenSymbol: typeof symbol === "string" ? symbol : null,
                tokenDecimals: typeof decimals === "number" ? decimals : (typeof decimals === "bigint" ? Number(decimals) : null),
              })
              .where(eq(listings.id, id));
          }
        } catch {}
      } catch {}
    }
  } catch {}

  // Fetch IPFS JSON using stored hash as-is
  try {
    const json: any | null = await fetchIpfsJson(cid);
    if (json) {
      const denorm: any = {
        metadata: json,
        // Top-level denormalized fields for convenient querying & UI
        title: typeof json?.title === "string" ? json.title : null,
        description: typeof json?.description === "string" ? json.description : null,
        category: typeof json?.category === "string" ? json.category : null,
        image: typeof json?.image === "string" ? json.image : null,
        contact: typeof json?.contact === "object" ? json.contact : (typeof json?.contact === "string" ? json.contact : null),
        tags: Array.isArray(json?.tags) ? json.tags : (typeof json?.tags === "string" ? json.tags : null),
        price: typeof json?.price === "string" || typeof json?.price === "number" ? String(json.price) : null,
        currency: typeof json?.currency === "string" ? json.currency : null,
        locationId: typeof json?.locationId === "string" ? json.locationId : null,
      };
      await db.sql.update(listings).set(denorm).where(eq(listings.id, id));
    }
  } catch {}
});

ponder.on("Marketplace:ListingAction" as any, async ({ event, context }) => {
  const { db } = context;
  const args = (event as any).args;
  const listingId = args.id.toString();
  const caller = (args.caller as string).toLowerCase();
  const actionHex = (args.action as string).toLowerCase();
  const selectorHex = actionHex.slice(0, 10) as `0x${string}`; // 0x + 8 chars

  const BUY_SEL = signatureToSelector("buy(uint256,address,bool,address,bytes)");
  const CLOSE_SEL = signatureToSelector("close(uint256,address,bool,address,bytes)");
  let actionName: string | null = null;
  if (selectorHex === BUY_SEL) actionName = "buy";
  else if (selectorHex === CLOSE_SEL) actionName = "close";

  await db.insert(listing_actions).values({
    id: `${(event as any).transaction?.hash ?? (event as any).log?.transactionHash}-${(event as any).log?.logIndex ?? 0}`,
    listingId,
    selectorHex,
    actionName: actionName ?? null,
    caller,
    blockNumber: event.block.number.toString(),
    txHash: (event as any).transaction?.hash ?? (event as any).log?.transactionHash ?? "",
  });

  if (actionName === "buy") {
    // Refresh remaining quantity (best-effort) by re-reading getListing
    let newRemaining: number | null = null;
    let newInitial: number | null = null;
    try {
      const getRes = (await publicClient.readContract({
        address: (event as any).log?.address as `0x${string}`,
        abi: marketplaceGetListingAbi,
        functionName: "getListing",
        args: [BigInt(listingId)],
      })) as unknown as any[];
      const listingDataBytes = getRes?.[4] as Hex | undefined;
      if (listingDataBytes) {
        try {
          const [/*pt*/, /*unit*/, initQ, remainQ] = decodeAbiParameters(
            [{ type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
            listingDataBytes,
          );
          newInitial = Number(initQ as bigint);
          newRemaining = Number(remainQ as bigint);
        } catch {
          // simple listings don't have quantity
        }
      }
    } catch {}

    // Compute purchased quantity = prevRemaining - newRemaining (for limited listings)
    let purchasedQty: number | null = null;
    try {
      const existing = await db.find(listings, { id: listingId });
      if (existing && typeof existing.remainingQuantity === "number" && typeof newRemaining === "number") {
        const delta = existing.remainingQuantity - newRemaining;
        if (delta > 0) purchasedQty = delta;
      }
    } catch {}

    await db.sql.update(listings).set({
      buyer: caller,
      remainingQuantity: newRemaining ?? null,
      initialQuantity: newInitial ?? null,
      unlimited: (newInitial === 0) ? true : (newInitial == null ? null : false),
    }).where(eq(listings.id, listingId));

    // Update action row with derived quantity (may be null for unlimited or when undetermined)
    await db.sql.update(listing_actions).set({
      quantity: purchasedQty ?? null,
    }).where(eq(listing_actions.id, `${(event as any).transaction?.hash ?? (event as any).log?.transactionHash}-${(event as any).log?.logIndex ?? 0}`));
  }
});

ponder.on("Marketplace:ListingActivationChanged" as any, async ({ event, context }) => {
  const { db } = context;
  const args = (event as any).args;
  await db.sql
    .update(listings)
    .set({ active: args.active as boolean })
    .where(eq(listings.id, args.listingId.toString()));
});

// (No SimpleListings event handlers required)

// --- EAS Reviews indexing ---
// Read new per-chain keyed shape only
const CHAIN_ID = Number(process.env.PONDER_CHAIN_ID || 8453);
const fileEntry = (easConfig as any)[String(CHAIN_ID)] as any;
const REVIEW_SCHEMA_UID = fileEntry?.reviewSchemaUid as string | undefined;

ponder.on("EAS:Attested", async ({ event, context }) => {
  const { db } = context;
  // Only process our review schema
  const eventSchemaUid = event.args.schemaUID as string | undefined;
  if (!REVIEW_SCHEMA_UID || !eventSchemaUid || eventSchemaUid.toLowerCase() !== REVIEW_SCHEMA_UID.toLowerCase()) {
    return;
  }

  // Fetch attestation by UID and decode payload: (uint256 listingId,uint8 rating,string commentIPFSHash)
  let listingIdStr: string | null = null;
  let ratingNum: number | null = null;
  let commentCid: string | null = null;
  try {
    const uidRaw = event.args.uid as `0x${string}`;
    const attestation = await publicClient.readContract({
      address: fileEntry?.eas as `0x${string}`,
      abi: easGetAttestationAbi,
      functionName: "getAttestation",
      args: [uidRaw],
    });
    const dataBytes = attestation.data as Hex | undefined;
    if (dataBytes) {
      const [listingIdDecoded, ratingDecoded, commentDecoded] = decodeAbiParameters(
        [
          { name: "listingId", type: "uint256" },
          { name: "rating", type: "uint8" },
          { name: "commentIPFSHash", type: "string" },
        ],
        dataBytes
      );
      listingIdStr = (listingIdDecoded as bigint)?.toString();
      ratingNum = typeof ratingDecoded === "bigint" ? Number(ratingDecoded) : (ratingDecoded as number);
      commentCid = commentDecoded as string;
    }
  } catch {}

  if (!listingIdStr) return;

  const reviewer = (event.args.attester as string).toLowerCase();
  const reviewee = (event.args.recipient as string).toLowerCase();
  const uid = (event.args.uid as string).toLowerCase();

  // Upsert review row
  await db
    .insert(reviews)
    .values({
      id: uid,
      listingId: listingIdStr,
      reviewer,
      reviewee,
      rating: ratingNum ?? null,
      commentIPFSHash: commentCid ?? null,
      schemaUid: eventSchemaUid,
      blockNumber: event.block.number.toString(),
      time: event.block.timestamp.toString(),
      txHash: event.transaction.hash,
    })
    .onConflictDoNothing();

  // Determine role and set flags
  const listing = await db.find(listings, { id: listingIdStr });
  let buyerReviewedFlag: boolean | undefined;
  let sellerReviewedFlag: boolean | undefined;
  if (listing) {
    const creator = (listing.creator || "").toLowerCase();
    const buyer = (listing.buyer || "").toLowerCase();
    if (reviewer === creator) sellerReviewedFlag = true;
    if (reviewer === buyer) buyerReviewedFlag = true;

    if (buyerReviewedFlag) {
      await db.sql.update(listings).set({ buyerReviewed: true }).where(eq(listings.id, listingIdStr));
    }
    if (sellerReviewedFlag) {
      await db.sql.update(listings).set({ sellerReviewed: true }).where(eq(listings.id, listingIdStr));
    }
  }
});
