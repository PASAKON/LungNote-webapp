import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncForUser } from "@/lib/gmail/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/gmail/pubsub
 *
 * Google Pub/Sub push subscription endpoint — ADR-0017 §"Sync Trigger (v1)".
 *
 * Flow:
 *   1. Verify Authorization Bearer = Google-signed JWT (tokeninfo endpoint
 *      for MVP; switch to local JWKs verify when scaling).
 *   2. Parse Pub/Sub envelope → decode message.data → {emailAddress, historyId}.
 *   3. Lookup user_id by email in lungnote_gmail_connections.
 *   4. Run sync inline (10s budget; reconcile cron catches any drops).
 *   5. Ack 200 — even on internal errors, to avoid retry storm. The next
 *      reconcile run will recover. Critical auth failures → 401 so
 *      Google stops retrying that token.
 */

const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

export async function POST(req: NextRequest) {
  // 1. Verify Pub/Sub auth token
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return new NextResponse("missing_bearer", { status: 401 });
  }
  const token = auth.slice("Bearer ".length).trim();

  const verifyOk = await verifyPubsubToken(token);
  if (!verifyOk) {
    return new NextResponse("invalid_token", { status: 401 });
  }

  // 2. Parse envelope
  let envelope: PubsubEnvelope;
  try {
    envelope = (await req.json()) as PubsubEnvelope;
  } catch {
    return new NextResponse("bad_json", { status: 400 });
  }

  const dataB64 = envelope.message?.data;
  if (!dataB64) {
    return NextResponse.json({ ok: true, noop: true });
  }

  let payload: GmailPushPayload;
  try {
    payload = JSON.parse(
      Buffer.from(dataB64, "base64").toString("utf8"),
    ) as GmailPushPayload;
  } catch {
    return new NextResponse("bad_payload", { status: 400 });
  }

  if (!payload.emailAddress) {
    return NextResponse.json({ ok: true, noop: true });
  }

  // 3. Lookup user
  const sb = createAdminClient();
  const { data: conn } = await sb
    .from("lungnote_gmail_connections")
    .select("user_id")
    .eq("email", payload.emailAddress)
    .eq("status", "active")
    .maybeSingle();
  if (!conn) {
    // Unknown user — likely a disconnected account that hasn't been
    // unwatched yet. Ack so Pub/Sub stops retrying.
    return NextResponse.json({ ok: true, noop: "no_connection" });
  }

  // 4. Run sync
  try {
    const result = await syncForUser(conn.user_id);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error(
      JSON.stringify({
        tag: "gmail_pubsub",
        ts: Date.now(),
        user_id: conn.user_id,
        msg: err instanceof Error ? err.message : String(err),
      }),
    );
    return NextResponse.json({ ok: true, error: "sync_failed" });
  }
}

async function verifyPubsubToken(token: string): Promise<boolean> {
  const expectedEmail = process.env.PUBSUB_PUSH_SERVICE_ACCOUNT;
  const expectedAud = process.env.PUBSUB_AUDIENCE;
  if (!expectedEmail || !expectedAud) {
    console.error(
      JSON.stringify({
        tag: "gmail_pubsub",
        step: "verify",
        msg: "PUBSUB_PUSH_SERVICE_ACCOUNT or PUBSUB_AUDIENCE missing",
      }),
    );
    return false;
  }

  try {
    const res = await fetch(
      `${TOKENINFO_URL}?id_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(5_000), cache: "no-store" },
    );
    if (!res.ok) return false;
    const claims = (await res.json()) as {
      iss?: string;
      email?: string;
      email_verified?: string | boolean;
      aud?: string;
      exp?: string;
    };
    if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") {
      return false;
    }
    if (claims.email !== expectedEmail) return false;
    if (claims.email_verified !== true && claims.email_verified !== "true") {
      return false;
    }
    if (claims.aud !== expectedAud) return false;
    return true;
  } catch {
    return false;
  }
}

type PubsubEnvelope = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};

type GmailPushPayload = {
  emailAddress: string;
  historyId: string;
};
