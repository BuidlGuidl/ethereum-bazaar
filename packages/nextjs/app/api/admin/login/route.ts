import { NextRequest } from "next/server";
import { consumeAdminNonce, createAdminSession } from "../../../../services/store/redis";
import { recoverMessageAddress } from "viem";

function isAllowed(address: string): boolean {
  const csv = process.env.ADMIN_ADDRESSES || "";
  const set = new Set(
    csv
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(s => s.toLowerCase()),
  );
  return set.has(address.toLowerCase());
}

export async function POST(req: NextRequest) {
  const { address, nonce, signature } = (await req.json()) as {
    address: string;
    nonce: string;
    signature: `0x${string}`;
  };

  if (!address || !nonce || !signature) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_request" }), { status: 400 });
  }

  const ok = await consumeAdminNonce(nonce);
  if (!ok) return new Response(JSON.stringify({ ok: false, error: "invalid_nonce" }), { status: 400 });

  try {
    const recovered = await recoverMessageAddress({ message: nonce, signature });
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(JSON.stringify({ ok: false, error: "bad_signature" }), { status: 401 });
    }
    if (!isAllowed(address)) {
      return new Response(JSON.stringify({ ok: false, error: "not_authorized" }), { status: 403 });
    }
    const token = await createAdminSession(address);
    if (!token) return new Response(JSON.stringify({ ok: false, error: "session_error" }), { status: 500 });
    return Response.json({ ok: true, token });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: "recover_failed" }), { status: 400 });
  }
}
