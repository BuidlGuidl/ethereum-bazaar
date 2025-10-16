import { resolveIpfsUrl } from "../../../services/ipfs/fetch";

type HeadProps = {
  params: { id: string };
};

export default async function Head({ params }: HeadProps) {
  const id = params?.id;

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
      // Let this run on the server only
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
  const embed = {
    version: "1",
    imageUrl: imageUrl || process.env.NEXT_PUBLIC_IMAGE_URL || fallbackImage,
    button: {
      title: `${process.env.NEXT_PUBLIC_APP_NAME || "View Listing"}`,
      action: {
        type: "launch_miniapp",
        url: `${baseUrl}/listing/${id}`,
      },
    },
  };

  return (
    <>
      <title>{title} | Ethereum Bazaar</title>
      <meta property="fc:miniapp" content={JSON.stringify(embed)} />
      <meta property="fc:frame" content={JSON.stringify(embed)} />
      <meta property="og:title" content={`${title} | Ethereum Bazaar`} />
      <meta property="og:image" content={imageUrl || fallbackImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={`${title} | Ethereum Bazaar`} />
      <meta name="twitter:image" content={imageUrl || fallbackImage} />
    </>
  );
}
