import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type LayoutProps = {
  children: React.ReactNode;
};

export async function generateMetadata(props: any): Promise<Metadata> {
  const p = props?.params ? await props.params : undefined;
  const id = (p?.id ?? props?.params?.id) as string | undefined;

  const baseUrl = process.env.NEXT_PUBLIC_URL || `http://localhost:${process.env.NEXT_PUBLIC_PORT || 3000}`;

  const ponderUrl = process.env.NEXT_PUBLIC_PONDER_URL || "http://localhost:42069/graphql";

  let title = `Listing ${id}`;
  let imageUrl: string | undefined;

  try {
    const res = await fetch(ponderUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `
          query ListingById($id: String!) {
            listings(id: $id) {
              id
              title
              description
              image
            }
          }
        `,
        variables: { id },
      }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const listing = json?.data?.listings ?? null;
      if (listing) {
        title = listing.title || title;
        // Resolve IPFS-ish images to gateway URL if needed
        try {
          const val: string | undefined = (() => {
            const raw = String(listing.image || "").trim();
            if (!raw) return undefined;
            if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
            const path = raw.startsWith("ipfs://") ? raw.slice("ipfs://".length) : raw;
            const gw = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://ipfs.io/ipfs/";
            const base = gw.endsWith("/") ? gw : `${gw}/`;
            return `${base}${path}`;
          })();
          imageUrl = val;
        } catch {}
      }
    }
  } catch {}

  const fallbackImage = `${baseUrl}/thumbnail.jpg`;

  const titleTruncated = (process.env.NEXT_PUBLIC_APP_NAME || "View Listing").slice(0, 32);
  const embedMiniapp = {
    version: "1",
    imageUrl: imageUrl || process.env.NEXT_PUBLIC_IMAGE_URL || fallbackImage,
    button: {
      title: titleTruncated,
      action: {
        type: "launch_miniapp",
        url: `${baseUrl}/listing/${id}`,
      },
    },
  };
  const embedFrame = {
    ...embedMiniapp,
    button: {
      ...embedMiniapp.button,
      action: {
        ...embedMiniapp.button.action,
        type: "launch_frame",
      },
    },
  };

  return {
    title: `${title} | Ethereum Bazaar`,
    openGraph: {
      title: `${title} | Ethereum Bazaar`,
      images: [imageUrl || fallbackImage],
    },
    other: {
      "fc:miniapp": JSON.stringify(embedMiniapp),
      "fc:frame": JSON.stringify(embedFrame),
    },
  };
}

export default function ListingLayout({ children }: LayoutProps) {
  return children;
}
