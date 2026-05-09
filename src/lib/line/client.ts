import "server-only";

const LINE_API = "https://api.line.me/v2/bot";

export type TextMessage = { type: "text"; text: string };

export type FlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

export type LineMessage = TextMessage | FlexMessage;

export async function replyMessage(
  replyToken: string,
  messages: LineMessage[],
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 0, detail: "missing token" };

  const res = await fetch(`${LINE_API}/message/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  return {
    ok: res.ok,
    status: res.status,
    detail: res.ok ? undefined : await res.text(),
  };
}

/**
 * Show the "..." typing indicator in the LINE chat. Auto-clears as soon as
 * the bot sends its real reply, or after `loadingSeconds` expires (max 60).
 *
 * Best-effort: fire-and-forget from the webhook handler so the user sees
 * the dots even if the indicator API is slow. Failure is non-fatal.
 *
 * Docs: https://developers.line.biz/en/reference/messaging-api/#display-a-loading-indicator
 */
export async function displayLoadingAnimation(
  chatId: string,
  loadingSeconds = 20,
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 0, detail: "missing token" };

  const res = await fetch(`${LINE_API}/chat/loading/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      chatId,
      loadingSeconds: Math.max(5, Math.min(60, loadingSeconds)),
    }),
  });

  return {
    ok: res.ok,
    status: res.status,
    detail: res.ok ? undefined : await res.text(),
  };
}

export async function pushMessage(
  to: string,
  messages: LineMessage[],
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 0, detail: "missing token" };

  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  return {
    ok: res.ok,
    status: res.status,
    detail: res.ok ? undefined : await res.text(),
  };
}
