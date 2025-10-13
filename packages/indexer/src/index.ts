import { ponder } from "ponder:registry";
import { eq } from "drizzle-orm";
import { listings, listing_created, listing_prebuy, listing_sold, listing_closed, simple_buffer, reviews } from "ponder:schema";
import { createPublicClient, http, zeroAddress, decodeAbiParameters, Hex } from "viem";
import easConfig from "./easConfig.json" assert { type: "json" };
import { easGetAttestationAbi } from "../abis/EASAbi";

// Minimal ERC-20 ABI for metadata reads
const erc20MetadataAbi = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

// Reuse one public client for reads
const publicClient = createPublicClient({
  transport: http(process.env.PONDER_RPC_URL_31337 ?? "http://127.0.0.1:8545"),
});

async function fetchTokenMetadata(address: `0x${string}`): Promise<{ tokenName: string | null; tokenSymbol: string | null; tokenDecimals: number | null }> {
  if (!address || address.toLowerCase() === zeroAddress) {
    return { tokenName: "Ether", tokenSymbol: "ETH", tokenDecimals: 18 };
  }
  try {
    const [name, symbol, decimals] = await Promise.all([
      publicClient.readContract({ address, abi: erc20MetadataAbi, functionName: "name" }).catch(() => null),
      publicClient.readContract({ address, abi: erc20MetadataAbi, functionName: "symbol" }).catch(() => null),
      publicClient.readContract({ address, abi: erc20MetadataAbi, functionName: "decimals" }).catch(() => null),
    ]);
    return {
      tokenName: typeof name === "string" ? name : null,
      tokenSymbol: typeof symbol === "string" ? symbol : null,
      tokenDecimals: typeof decimals === "number" ? decimals : (typeof decimals === "bigint" ? Number(decimals) : null),
    };
  } catch {
    return { tokenName: null, tokenSymbol: null, tokenDecimals: null };
  }
}

// --- IPFS helpers (resilient multi-gateway JSON fetch) ---
const PREFERRED_GATEWAY = process.env.PONDER_IPFS_GATEWAY || "https://ipfs.io/ipfs/";

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

ponder.on("Marketplace:ListingCreated", async ({ event, context }) => {
  const { db } = context;
  const id = event.args.id.toString();
  const creator = event.args.creator.toLowerCase();
  const listingType = event.args.listingType.toLowerCase();
  const listingInnerId = event.args.listingId.toString();

  await db.insert(listings).values({
    id,
    creator,
    listingType,
    listingInnerId,
    createdBlockNumber: event.block.number.toString(),
    createdBlockTimestamp: event.block.timestamp.toString(),
    createdTxHash: event.transaction.hash,
  });

  // If SimpleListings data was buffered first, merge it now
  const bufId = `${listingType}:${listingInnerId}`;
  const buf = await db.find(simple_buffer, { id: bufId });
  if (buf) {
    await db.sql
      .update(listings)
      .set({
        paymentToken: buf.paymentToken,
        priceWei: buf.priceWei,
        ipfsCid: buf.ipfsCid,
        active: true,
        tokenName: buf.tokenName ?? null,
        tokenSymbol: buf.tokenSymbol ?? null,
        tokenDecimals: buf.tokenDecimals ?? null,
      })
      .where(eq(listings.id, id));

    // If token metadata wasn't present in buffer, fetch now
    if (!buf.tokenName || !buf.tokenSymbol || buf.tokenDecimals == null) {
      try {
        const meta = await fetchTokenMetadata(buf.paymentToken as `0x${string}`);
        await db.sql
          .update(listings)
          .set({ tokenName: meta.tokenName, tokenSymbol: meta.tokenSymbol, tokenDecimals: meta.tokenDecimals })
          .where(eq(listings.id, id));
      } catch {}
    }

    try {
      if (buf.ipfsCid && typeof buf.ipfsCid === "string") {
        const json: any | null = await fetchIpfsJson(buf.ipfsCid);
        if (json) {
          await db.sql
            .update(listings)
            .set({
              title: typeof json?.title === "string" ? json.title : null,
              description: typeof json?.description === "string" ? json.description : null,
              category: typeof json?.category === "string" ? json.category : null,
              image: typeof json?.image === "string" ? json.image : null,
              locationId: typeof json?.locationId === "string" ? json.locationId : null,
            })
            .where(eq(listings.id, id));
        }
      }
    } catch {}
  }

  await db.insert(listing_created).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    listingId: id,
    creator,
    listingType,
    listingInnerId,
    blockNumber: event.block.number.toString(),
    txHash: event.transaction.hash,
  });
});

ponder.on("Marketplace:ListingPreBuy", async ({ event, context }) => {
  const { db } = context;
  await db.insert(listing_prebuy).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    listingId: event.args.id.toString(),
    buyer: event.args.buyer.toLowerCase(),
    blockNumber: event.block.number.toString(),
    txHash: event.transaction.hash,
  });
});

ponder.on("Marketplace:ListingSold", async ({ event, context }) => {
  const { db } = context;
  await db.insert(listing_sold).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    listingId: event.args.id.toString(),
    buyer: event.args.buyer.toLowerCase(),
    blockNumber: event.block.number.toString(),
    txHash: event.transaction.hash,
  });

  // Persist buyer on the listing row for downstream joins (reviews)
  await db.sql
    .update(listings)
    .set({ buyer: event.args.buyer.toLowerCase(), active: false })
    .where(eq(listings.id, event.args.id.toString()));
});

ponder.on("Marketplace:ListingClosed", async ({ event, context }) => {
  const { db } = context;
  await db.insert(listing_closed).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    listingId: event.args.id.toString(),
    caller: event.args.caller.toLowerCase(),
    blockNumber: event.block.number.toString(),
    txHash: event.transaction.hash,
  });
});

ponder.on("SimpleListings:SimpleListingCreated", async ({ event, context }) => {
  const { db } = context;
  const listingInnerId = event.args.listingId.toString();
  const paymentToken = event.args.paymentToken.toLowerCase();
  const priceWei = event.args.price.toString();
  const ipfsCid = event.args.ipfsHash;
  const listingType = (event.log.address || "").toLowerCase();

  // Enrich with token metadata
  let meta: { tokenName: string | null; tokenSymbol: string | null; tokenDecimals: number | null } | null = null;
  try {
    meta = await fetchTokenMetadata(paymentToken as `0x${string}`);
  } catch {
    meta = null;
  }

  // Try to update if Marketplace row already exists
  const updated = await db.sql
    .update(listings)
    .set({
      paymentToken,
      priceWei,
      ipfsCid,
      active: true,
      tokenName: meta?.tokenName ?? null,
      tokenSymbol: meta?.tokenSymbol ?? null,
      tokenDecimals: meta?.tokenDecimals ?? null,
    })
    .where(eq(listings.listingInnerId, listingInnerId));
  // If not present, buffer it so Marketplace handler can merge later
  if (!updated || (Array.isArray(updated) && updated.length === 0)) {
    await db
      .insert(simple_buffer)
      .values({
        id: `${listingType}:${listingInnerId}`,
        listingType,
        listingInnerId,
        paymentToken,
        priceWei,
        ipfsCid,
        tokenName: meta?.tokenName ?? null,
        tokenSymbol: meta?.tokenSymbol ?? null,
        tokenDecimals: meta?.tokenDecimals ?? null,
      })
      .onConflictDoUpdate({
        paymentToken,
        priceWei,
        ipfsCid,
        tokenName: meta?.tokenName ?? null,
        tokenSymbol: meta?.tokenSymbol ?? null,
        tokenDecimals: meta?.tokenDecimals ?? null,
      });
  }

  try {
    if (ipfsCid && typeof ipfsCid === "string") {
      const json: any | null = await fetchIpfsJson(ipfsCid);
      if (json) {
        await db.sql
          .update(listings)
          .set({
            title: typeof json?.title === "string" ? json.title : null,
            description: typeof json?.description === "string" ? json.description : null,
            category: typeof json?.category === "string" ? json.category : null,
            image: typeof json?.image === "string" ? json.image : null,
            locationId: typeof json?.locationId === "string" ? json.locationId : null,
          })
          .where(eq(listings.listingInnerId, listingInnerId));
      }
    }
  } catch {}
});

ponder.on("SimpleListings:SimpleListingSold", async ({ event, context }) => {
  const { db } = context;
  await db.sql
    .update(listings)
    .set({ active: false })
    .where(eq(listings.listingInnerId, event.args.listingId.toString()));
});

ponder.on("SimpleListings:SimpleListingClosed", async ({ event, context }) => {
  const { db } = context;
  await db.sql
    .update(listings)
    .set({ active: false })
    .where(eq(listings.listingInnerId, event.args.listingId.toString()));
});

// --- EAS Reviews indexing ---
const REVIEW_SCHEMA_UID = easConfig.reviewSchemaUid as string | undefined;

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
      address: easConfig.eas as `0x${string}`,
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
      await db.sql.update(listing_sold).set({ buyerReviewed: true }).where(eq(listing_sold.listingId, listingIdStr));
    }
    if (sellerReviewedFlag) {
      await db.sql.update(listings).set({ sellerReviewed: true }).where(eq(listings.id, listingIdStr));
      await db.sql.update(listing_sold).set({ sellerReviewed: true }).where(eq(listing_sold.listingId, listingIdStr));
    }
  }
});
