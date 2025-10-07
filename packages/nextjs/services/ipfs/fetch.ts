const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

function toPath(cidOrUrl: string): string {
  if (!cidOrUrl) return "";
  const lower = cidOrUrl.trim();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const url = new URL(lower);
      const ix = url.href.indexOf("/ipfs/");
      if (ix >= 0) return url.href.substring(ix + "/ipfs/".length);
      // Otherwise, assume the whole href is a gateway URL already
      return lower;
    } catch {
      return lower;
    }
  }
  if (lower.startsWith("ipfs://")) return lower.substring("ipfs://".length);
  return lower;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 7000, ...rest } = init || {};
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchJsonFromCid(cidOrUrl: string): Promise<any> {
  const path = toPath(cidOrUrl);
  const candidates: string[] = [];
  if (path.startsWith("http://") || path.startsWith("https://")) {
    candidates.push(path);
  } else if (path) {
    candidates.push(
      `${PINATA_GATEWAY}${path}`,
      `https://ipfs.io/ipfs/${path}`,
      `https://cloudflare-ipfs.com/ipfs/${path}`,
      `https://w3s.link/ipfs/${path}`,
      `https://nftstorage.link/ipfs/${path}`,
    );
  }

  let lastError: any;
  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, { timeoutMs: 8000 });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await res.json();
      }
      // Attempt JSON parse even if header is missing
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        // not JSON, skip
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Failed to fetch JSON from IPFS for ${cidOrUrl}${lastError ? `: ${String(lastError)}` : ""}`);
}
