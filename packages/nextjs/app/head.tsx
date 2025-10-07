export default function Head() {
  const miniappEmbed = {
    version: "1",
    imageUrl: "/thumbnail.jpg",
    button: {
      title: "Local Marketplace",
      action: {
        url: "/",
      },
    },
  };

  return (
    <>
      <meta property="fc:miniapp" content={JSON.stringify(miniappEmbed)} />
    </>
  );
}
