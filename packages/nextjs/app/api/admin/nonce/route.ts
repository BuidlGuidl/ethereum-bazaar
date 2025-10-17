import { NextRequest } from "next/server";
import { storeAdminNonce } from "../../../../services/store/redis";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  const nonce = crypto.randomUUID();
  await storeAdminNonce(nonce);
  return Response.json({ nonce });
}
