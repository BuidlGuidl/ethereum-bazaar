import { onchainTable } from "ponder";

// Listings table (Marketplace-only)
export const listings = onchainTable("listings", (t) => ({
  id: t.text().primaryKey(), // Marketplace listing id (uint256 as string)
  creator: t.text(),
  listingType: t.text(),
  cid: t.text(),
  // Token/payment fields parsed from listingData
  paymentToken: t.text(),
  priceWei: t.text(),
  tokenName: t.text(),
  tokenSymbol: t.text(),
  tokenDecimals: t.integer(),
  // QuantityListings fields (for unlimited, initial/remaining will be 0 and unlimited=true)
  initialQuantity: t.integer(),
  remainingQuantity: t.integer(),
  unlimited: t.boolean(),
  // Denormalized from metadata
  title: t.text(),
  description: t.text(),
  category: t.text(),
  image: t.text(),
  contact: t.json(),
  tags: t.json(),
  price: t.text(),
  currency: t.text(),
  locationId: t.text(),
  buyer: t.text(),
  active: t.boolean(),
  buyerReviewed: t.boolean(),
  sellerReviewed: t.boolean(),
  createdBlockNumber: t.text(),
  createdBlockTimestamp: t.text(),
  createdTxHash: t.text(),
}));

// Recorded actions from Marketplace
export const listing_actions = onchainTable("listing_actions", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  listingId: t.text(),
  selectorHex: t.text(),
  actionName: t.text(),
  caller: t.text(),
  blockNumber: t.text(),
  txHash: t.text(),
  // For QuantityListings: best-effort derived qty per action (may be null when unlimited)
  quantity: t.integer(),
}));

// Reviews written via EAS against the Review schema
export const reviews = onchainTable("reviews", (t) => ({
  id: t.text().primaryKey(), // uid (bytes32 as 0x string)
  listingId: t.text(),
  reviewer: t.text(),
  reviewee: t.text(),
  rating: t.integer(),
  commentIPFSHash: t.text(),
  schemaUid: t.text(),
  blockNumber: t.text(),
  time: t.text(),
  txHash: t.text(),
}));
