const PONDER_URL = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql";

export interface ListingData {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[] | string | null;
  price: string;
  currency: string;
  image: string | null;
  contact: Record<string, string> | null;
  locationId: string;
  paymentToken: string | null;
  tokenDecimals: number | null;
  initialQuantity?: number | null;
  remainingQuantity?: number | null;
  unlimited?: boolean | null;
}

export async function fetchListingById(id: string): Promise<ListingData | null> {
  const res = await fetch(PONDER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `
        query ListingById($id: String!) {
          listings(id: $id) {
            id
            title
            description
            category
            tags
            price
            currency
            image
            contact
            locationId
            paymentToken
            tokenDecimals
            initialQuantity
            remainingQuantity
            unlimited
          }
        }
      `,
      variables: { id },
    }),
  });

  const json = await res.json();
  const item = json?.data?.listings || null;
  return item;
}
