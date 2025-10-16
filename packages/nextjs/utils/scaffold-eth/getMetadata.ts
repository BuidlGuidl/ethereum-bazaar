import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_URL ?? `http://localhost:${process.env.NEXT_PUBLIC_PORT || 3000}`;
const titleTemplate = "%s | Ethereum Bazaar";

export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/thumbnail.jpg",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  const imageUrl = `${baseUrl}${imageRelativePath}`;

  const miniAppContent = JSON.stringify({
    version: "1",
    imageUrl: process.env.NEXT_PUBLIC_IMAGE_URL ?? imageUrl,
    button: {
      title: `${process.env.NEXT_PUBLIC_APP_NAME ?? title}`,
      action: {
        url: `${baseUrl}/`,
        type: "launch_miniapp",
      },
    },
  });

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    manifest: "/manifest.json",
    other: {
      "fc:miniapp": miniAppContent,
      "fc:frame": miniAppContent,
    },
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [
        {
          url: imageUrl,
        },
      ],
    },
    twitter: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [imageUrl],
    },
    icons: {
      icon: [
        {
          url: "/ethereum-bazaar-logo.svg",
          sizes: "32x32",
          type: "image/png",
        },
      ],
    },
  };
};
