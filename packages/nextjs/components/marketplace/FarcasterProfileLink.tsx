export const FarcasterProfileLink = ({ username }: { username?: string }) => {
  if (!username) return null;
  return (
    <a href={`https://warpcast.com/${username}`} className="link" target="_blank" rel="noreferrer">
      @{username}
    </a>
  );
};
