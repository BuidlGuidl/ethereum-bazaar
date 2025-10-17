import { NextRequest } from "next/server";
import {
  JsonFarcasterSignature,
  MiniAppEventPayload,
  appendEventLog,
  base64UrlToString,
  setNotificationState,
} from "../../../services/store/redis";
import { createPublicClient, http } from "viem";
import { optimism } from "viem/chains";

const KEY_REGISTRY_ADDRESS = "0x00000000Fc1237824fb747aBDE0FF18990E59b7e" as const;

const KEY_REGISTRY_ABI = [
  {
    inputs: [
      { name: "fid", type: "uint256" },
      { name: "key", type: "bytes" },
    ],
    name: "keyDataOf",
    outputs: [
      {
        components: [
          { name: "state", type: "uint8" },
          { name: "keyType", type: "uint32" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function verifyFidOwnership(fid: number, appKey: `0x${string}`) {
  const client = createPublicClient({ chain: optimism, transport: http() });
  try {
    const result = await client.readContract({
      address: KEY_REGISTRY_ADDRESS,
      abi: KEY_REGISTRY_ABI,
      functionName: "keyDataOf",
      args: [BigInt(fid), appKey],
    });
    // active = 1, app key type = 1
    return (result as any).state === 1 && (result as any).keyType === 1;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const domain = process.env.NEXT_PUBLIC_URL ? new URL(process.env.NEXT_PUBLIC_URL).hostname : "unknown";

  let body: JsonFarcasterSignature;
  try {
    body = (await req.json()) as JsonFarcasterSignature;
    if (!body || typeof body !== "object") throw new Error("Invalid body");
    if (!body.header || !body.payload || !body.signature) throw new Error("Missing fields");
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: "invalid_request" }), { status: 400 });
  }

  // Decode header and payload (base64url)
  let decodedHeader: unknown;
  let decodedPayload: MiniAppEventPayload | undefined;
  try {
    decodedHeader = JSON.parse(base64UrlToString(body.header));
  } catch {}

  try {
    decodedPayload = JSON.parse(base64UrlToString(body.payload)) as MiniAppEventPayload;
  } catch {}

  // Verify the app key ownership against the fid using Key Registry
  const fid = typeof (decodedHeader as any)?.fid === "number" ? ((decodedHeader as any).fid as number) : undefined;
  const appKey =
    typeof (decodedHeader as any)?.key === "string" ? ((decodedHeader as any).key as `0x${string}`) : undefined;

  if (!fid || !appKey) {
    await appendEventLog(domain, {
      envelope: body,
      header: decodedHeader,
      payload: decodedPayload,
      error: "missing_fid_or_key",
    });
    return new Response(JSON.stringify({ ok: false, error: "missing_fid_or_key" }), { status: 400 });
  }

  const valid = await verifyFidOwnership(fid, appKey);
  if (!valid) {
    await appendEventLog(domain, {
      envelope: body,
      header: decodedHeader,
      payload: decodedPayload,
      error: "invalid_fid_ownership",
    });
    return new Response(JSON.stringify({ ok: false, error: "invalid_fid_ownership" }), { status: 401 });
  }

  // Persist raw envelope and decoded payload
  await appendEventLog(domain, { envelope: body, header: decodedHeader, payload: decodedPayload });

  // Handle token lifecycle when we have enough info
  try {
    if (decodedPayload && fid) {
      switch (decodedPayload.event) {
        case "miniapp_added":
          if (decodedPayload.notificationDetails) {
            await setNotificationState(domain, fid, decodedPayload.notificationDetails);
          }
          break;
        case "notifications_enabled":
          await setNotificationState(domain, fid, decodedPayload.notificationDetails);
          break;
        case "miniapp_removed":
        case "notifications_disabled":
          await setNotificationState(domain, fid, undefined);
          break;
      }
    }
  } catch {}

  return Response.json({ ok: true });
}

export async function GET() {
  return new Response("OK", { status: 200 });
}
