import { NextRequest } from "next/server";
import { getAdminSessionAddress } from "../../../../services/store/redis";
import { sendMiniAppNotification } from "../../../../services/webhooks/notifications";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;
  if (!token) return new Response(JSON.stringify({ ok: false, error: "missing_token" }), { status: 401 });

  const address = await getAdminSessionAddress(token);
  if (!address) return new Response(JSON.stringify({ ok: false, error: "invalid_session" }), { status: 401 });

  const { fid, title, body } = (await req.json()) as { fid: number; title: string; body: string };
  if (!fid || !title || !body)
    return new Response(JSON.stringify({ ok: false, error: "invalid_request" }), { status: 400 });

  const res = await sendMiniAppNotification({ fid, title, body });
  return Response.json({ ok: res.state === "success", result: res });
}
