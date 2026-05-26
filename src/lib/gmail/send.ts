import "server-only";
import { getMessageMetadata, findHeader } from "./client";

/**
 * Send a threaded reply to an existing Gmail message (ADR-0021/0022).
 *
 * Requires a token with gmail.send (or modify/full). Fetches the original
 * message's From / Subject / Message-ID so the reply lands in the same thread
 * (In-Reply-To + References + threadId). The deny-list (no trash/delete) is
 * irrelevant here — send is its own narrow capability.
 */

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

/** RFC 2047 encode a header value so non-ASCII (Thai) subjects stay valid. */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Pull the bare address out of a "Name <addr@x>" From header. */
function extractEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

function toBase64Url(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export type SentReply = { id: string; threadId: string; to: string };

export async function sendThreadReply(
  accessToken: string,
  opts: { originalMessageId: string; threadId: string; body: string },
): Promise<SentReply> {
  const meta = await getMessageMetadata(accessToken, opts.originalMessageId);
  const headers = meta.payload.headers;
  const fromRaw = findHeader(headers, "From") ?? "";
  const subjectRaw = findHeader(headers, "Subject") ?? "";
  const origMsgId =
    findHeader(headers, "Message-ID") ?? findHeader(headers, "Message-Id") ?? "";

  const to = extractEmail(fromRaw);
  if (!to || !to.includes("@")) {
    throw new Error("cannot resolve recipient from original message");
  }
  const subject = /^re:/i.test(subjectRaw.trim())
    ? subjectRaw
    : `Re: ${subjectRaw}`;

  const mimeHeaders = [`To: ${to}`, `Subject: ${encodeHeader(subject)}`];
  if (origMsgId) {
    mimeHeaders.push(`In-Reply-To: ${origMsgId}`);
    mimeHeaders.push(`References: ${origMsgId}`);
  }
  mimeHeaders.push("MIME-Version: 1.0");
  mimeHeaders.push('Content-Type: text/plain; charset="UTF-8"');

  const mime = mimeHeaders.join("\r\n") + "\r\n\r\n" + opts.body;
  const raw = toBase64Url(mime);

  const res = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw, threadId: opts.threadId }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gmail send failed ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id: string; threadId: string };
  return { id: data.id, threadId: data.threadId, to };
}
