function withValidProperties(properties: Record<string, undefined | string | string[]>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return !!value;
    }),
  );
}

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  return Response.json({
    accountAssociation: {
      header: process.env.FARCASTER_HEADER,
      payload: process.env.FARCASTER_PAYLOAD,
      signature: process.env.FARCASTER_SIGNATURE,
    },
    miniapp: withValidProperties({
      version: "1",
      name: "Ethereum Bazaar",
      subtitle: "A peer to peer marketplace",
      description: "This local-first marketplace lets you buy and sell anything",
      screenshotUrls: [],
      iconUrl: `${URL}/EBicon.png`,
      splashImageUrl: `${URL}/EBIcon.png`,
      splashBackgroundColor: "#f8f5f0",
      homeUrl: URL,
      webhookUrl: `${URL}/api/webhook`,
      primaryCategory: "shopping",
      tags: ["p2p", "marketplace", "buy", "sell", "local"],
      heroImageUrl: `${URL}/HeroImage.png`,
      tagline: "Buy and sell anything",
      ogTitle: "Ethereum Bazaar",
      ogDescription: "This local-first marketplace lets you buy and sell anything",
      ogImageUrl: process.env.NEXT_PUBLIC_APP_OG_IMAGE,
    }),
  });
}
