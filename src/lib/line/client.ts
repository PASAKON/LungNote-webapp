import "server-only";

const LINE_API = "https://api.line.me/v2/bot";

export type TextMessage = { type: "text"; text: string };
export type LineMessage = TextMessage;

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
