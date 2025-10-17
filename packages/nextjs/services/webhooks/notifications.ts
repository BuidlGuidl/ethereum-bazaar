import { MiniAppNotificationDetails, getNotificationState } from "../store/redis";
import { type SendNotificationRequest, sendNotificationResponseSchema } from "@farcaster/miniapp-sdk";

const appUrl = process.env.NEXT_PUBLIC_URL || "";

export async function sendMiniAppNotification(args: {
  fid: number;
  title: string;
  body: string;
  notificationDetails?: MiniAppNotificationDetails | null;
  domain?: string;
}): Promise<
  { state: "error"; error: unknown } | { state: "no_token" } | { state: "rate_limit" } | { state: "success" }
> {
  const { fid, title, body } = args;
  let details = args.notificationDetails ?? null;
  const domain = args.domain || (process.env.NEXT_PUBLIC_URL ? new URL(process.env.NEXT_PUBLIC_URL).hostname : "");

  if (!details && domain) {
    details = await getNotificationState(domain, fid);
  }
  if (!details) return { state: "no_token" };

  const response = await fetch(details.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notificationId: crypto.randomUUID(),
      title,
      body,
      targetUrl: appUrl,
      tokens: [details.token],
    } satisfies SendNotificationRequest),
  });

  const responseJson = await response.json().catch(() => ({}));
  if (response.status === 200) {
    const parsed = sendNotificationResponseSchema.safeParse(responseJson);
    if (!parsed.success) return { state: "error", error: parsed.error.errors };
    if (parsed.data.result.rateLimitedTokens.length) return { state: "rate_limit" };
    return { state: "success" };
  }
  return { state: "error", error: responseJson };
}
