import { NextRequest } from "next/server";
import { getAdminSessionAddress, getRecentEvents } from "../../../../services/store/redis";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;
  if (!token) return new Response(JSON.stringify({ ok: false, error: "missing_token" }), { status: 401 });

  const address = await getAdminSessionAddress(token);
  if (!address) return new Response(JSON.stringify({ ok: false, error: "invalid_session" }), { status: 401 });

  const { sinceMs, untilMs, type, limit } = (await req.json().catch(() => ({}))) as {
    sinceMs?: number;
    untilMs?: number;
    type?: "miniapp_added" | "miniapp_removed" | "notifications_enabled" | "notifications_disabled";
    limit?: number;
  };

  const domain = process.env.NEXT_PUBLIC_URL ? new URL(process.env.NEXT_PUBLIC_URL).hostname : "";
  const events = await getRecentEvents(domain, { limit: limit ?? 200 });

  const filtered = events.filter(ev => {
    if (sinceMs && ev.at < sinceMs) return false;
    if (untilMs && ev.at > untilMs) return false;
    if (type) {
      // payload is under ev.data.payload?.event
      const evType = (ev as any)?.data?.payload?.event as string | undefined;
      if (evType !== type) return false;
    }
    return true;
  });

  return Response.json({ ok: true, events: filtered });
}
