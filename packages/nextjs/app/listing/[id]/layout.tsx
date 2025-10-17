import { resolveIpfsUrl } from "../../../services/ipfs/fetch";
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
        const resolved = resolveIpfsUrl(listing.image) || listing.image;
        if (resolved && typeof resolved === "string") imageUrl = resolved;
      }
    }
  } catch {}

  const fallbackImage = `${baseUrl}/thumbnail.jpg`;

  const embedMiniapp = {
    version: "1",
    imageUrl: imageUrl || process.env.NEXT_PUBLIC_IMAGE_URL || fallbackImage,
    button: {
      title: "View Listing",
      action: {
        name: title,
        type: "launch_miniapp",
        url: `${baseUrl}/listing/${id}`,
        splashImageUrl: `${baseUrl}/EBicon.png`,
        splashBackgroundColor: "#f8f5f0",
      },
    },
  };

  return {
    title: `${title} | View Listing`,
    openGraph: {
      title: `${title} | View Listing`,
      images: [imageUrl || fallbackImage],
    },
    other: {
      "fc:miniapp": JSON.stringify(embedMiniapp),
      "fc:frame": JSON.stringify(embedMiniapp),
    },
  };
}

export default function ListingLayout({ children }: LayoutProps) {
  return children;
}
