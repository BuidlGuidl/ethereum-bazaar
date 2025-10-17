import { Redis } from "@upstash/redis";

let redis: Redis | undefined;

export function getRedis(): Redis | undefined {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  redis = new Redis({ url, token });
  return redis;
}

export type MiniAppNotificationDetails = {
  url: string;
  token: string;
};

export type MiniAppEventPayload =
  | { event: "miniapp_added"; notificationDetails?: MiniAppNotificationDetails }
  | { event: "miniapp_removed" }
  | { event: "notifications_disabled" }
  | { event: "notifications_enabled"; notificationDetails: MiniAppNotificationDetails };

export type JsonFarcasterSignature = {
  header: string;
  payload: string;
  signature: string;
};

export function base64UrlToString(input: string): string {
  // atob expects standard base64; convert base64url to base64 and decode using Buffer in Node
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

export async function appendEventLog(domain: string, data: unknown) {
  const r = getRedis();
  if (!r) return;
  const key = `miniapp:webhook:events:${domain}`;
  const entry = { at: Date.now(), data };
  try {
    await r.lpush(key, JSON.stringify(entry));
    await r.ltrim(key, 0, 999); // keep last 1000
  } catch {
    // ignore
  }
}

export async function setNotificationState(domain: string, fid: number, details?: MiniAppNotificationDetails) {
  const r = getRedis();
  if (!r) return;
  const key = `miniapp:notifications:${domain}:${fid}`;
  if (details) {
    await r.hset(key, { url: details.url, token: details.token, updatedAt: Date.now().toString() });
  } else {
    await r.del(key);
  }
}

export async function getNotificationState(domain: string, fid: number): Promise<MiniAppNotificationDetails | null> {
  const r = getRedis();
  if (!r) return null;
  const key = `miniapp:notifications:${domain}:${fid}`;
  const res = await r.hgetall<{ url?: string; token?: string }>(key);
  if (!res || !res.url || !res.token) return null;
  return { url: res.url, token: res.token };
}

// Admin auth helpers (nonce + session tokens)
export async function storeAdminNonce(nonce: string) {
  const r = getRedis();
  if (!r) return;
  await r.set(`miniapp:admin:nonce:${nonce}`, "1", { ex: 300 });
}

export async function consumeAdminNonce(nonce: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const key = `miniapp:admin:nonce:${nonce}`;
  const exists = await r.get<string>(key);
  if (!exists) return false;
  await r.del(key);
  return true;
}

export async function createAdminSession(address: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const token = crypto.randomUUID();
  await r.set(`miniapp:admin:session:${token}`, address.toLowerCase(), { ex: 60 * 60 * 24 });
  return token;
}

export async function getAdminSessionAddress(token: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  const addr = await r.get<string>(`miniapp:admin:session:${token}`);
  return addr ?? null;
}

export type StoredEvent = { at: number; data: unknown };

export async function getRecentEvents(domain: string, opts?: { limit?: number }): Promise<StoredEvent[]> {
  const r = getRedis();
  if (!r) return [];
  const key = `miniapp:webhook:events:${domain}`;
  const n = Math.max(1, Math.min(1000, opts?.limit ?? 100));
  const raw = await r.lrange<string>(key, 0, n - 1);
  return raw
    .map(x => {
      try {
        return JSON.parse(x) as StoredEvent;
      } catch {
        return null;
      }
    })
    .filter((x): x is StoredEvent => !!x);
}
