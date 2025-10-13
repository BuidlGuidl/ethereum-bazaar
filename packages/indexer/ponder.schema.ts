import { onchainTable } from "ponder";

export const listings = onchainTable("listings", (t) => ({
  id: t.text().primaryKey(), // Marketplace listing id (uint256 as string)
  creator: t.text(),
  listingType: t.text(),
  listingInnerId: t.text(),
  // Sale details
  buyer: t.text(),
  // SimpleListings enrichment
  paymentToken: t.text(),
  priceWei: t.text(),
  ipfsCid: t.text(),
  active: t.boolean(),
  // Review status flags
  buyerReviewed: t.boolean(),
  sellerReviewed: t.boolean(),
  // Token metadata enrichment (for ERC-20s; null for native ETH)
  tokenName: t.text(),
  tokenSymbol: t.text(),
  tokenDecimals: t.integer(),
  // IPFS metadata
  title: t.text(),
  description: t.text(),
  category: t.text(),
  image: t.text(),
  locationId: t.text(),
  createdBlockNumber: t.text(),
  createdBlockTimestamp: t.text(),
  createdTxHash: t.text(),
}));

// Buffer table to handle ordering between SimpleListings and Marketplace events
export const simple_buffer = onchainTable("simple_buffer", (t) => ({
  id: t.text().primaryKey(), // `${listingType}:${listingInnerId}`
  listingType: t.text(),
  listingInnerId: t.text(),
  paymentToken: t.text(),
  priceWei: t.text(),
  ipfsCid: t.text(),
  // Token metadata enrichment (buffered until Marketplace row exists)
  tokenName: t.text(),
  tokenSymbol: t.text(),
  tokenDecimals: t.integer(),
}));

export const listing_created = onchainTable("listing_created", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  listingId: t.text(),
  creator: t.text(),
  listingType: t.text(),
  listingInnerId: t.text(),
  blockNumber: t.text(),
  txHash: t.text(),
}));

export const listing_prebuy = onchainTable("listing_prebuy", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  listingId: t.text(),
  buyer: t.text(),
  blockNumber: t.text(),
  txHash: t.text(),
}));

export const listing_sold = onchainTable("listing_sold", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  listingId: t.text(),
  buyer: t.text(),
  buyerReviewed: t.boolean(),
  sellerReviewed: t.boolean(),
  blockNumber: t.text(),
  txHash: t.text(),
}));

export const listing_closed = onchainTable("listing_closed", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  listingId: t.text(),
  caller: t.text(),
  blockNumber: t.text(),
  txHash: t.text(),
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
