import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface Listing {
  id: string;
  title: string;
  image: string | null;
  tags: string[];
  priceWei: string | null;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  isOptimistic?: boolean;
}

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map(t => String(t)).filter(Boolean);
  }
  if (typeof tags === "string" && tags) {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.map(t => String(t)).filter(Boolean);
      }
    } catch {
      return tags.trim() ? [tags.trim()] : [];
    }
  }
  return [];
}

function transformListingItem(item: any): Listing {
  return {
    id: item.id,
    title: item?.title ?? item.id,
    image: item?.image ?? null,
    tags: parseTags(item?.tags),
    priceWei: item?.priceWei ?? null,
    tokenSymbol: item?.tokenSymbol ?? null,
    tokenDecimals: item?.tokenDecimals ?? null,
    isOptimistic: false,
  };
}

async function fetchListingsByLocation(locationId: string): Promise<Listing[]> {
  const ponderUrl = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql";

  const res = await fetch(ponderUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `
        query ListingsByLocation($loc: String!) {
          listingss(
            where: { locationId: $loc, active: true }
            orderBy: "createdBlockNumber"
            orderDirection: "desc"
            limit: 100
          ) {
            items {
              id
              title
              image
              tags
              priceWei
              tokenSymbol
              tokenDecimals
            }
          }
        }
      `,
      variables: { loc: locationId },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch listings: ${res.statusText}`);
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  const items = (json?.data?.listingss?.items || []).map(transformListingItem);
  return items;
}

function mergeListings(fetched: Listing[], optimistic: Listing[]): Listing[] {
  const fetchedIds = new Set(fetched.map(l => l.id));
  const pending = optimistic.filter(l => l.isOptimistic && !fetchedIds.has(l.id));
  return [...pending, ...fetched];
}

export function useListingsByLocation(locationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["listings", "location", locationId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!locationId) throw new Error("Location ID is required");
      const cached = queryClient.getQueryData<Listing[]>(queryKey);
      const optimistic = cached?.filter(l => l.isOptimistic) ?? [];
      const fetched = await fetchListingsByLocation(locationId);

      return mergeListings(fetched, optimistic);
    },
    enabled: !!locationId,
    staleTime: 1000,
    refetchInterval: query => (query.state.data?.some(l => l.isOptimistic) ? 2000 : false),
  });
}
