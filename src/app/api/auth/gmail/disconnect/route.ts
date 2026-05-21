import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/gmail/crypto";
import { revokeToken } from "@/lib/gmail/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/auth/gmail/disconnect
 *
 * Revokes the user's stored Gmail refresh_token at Google (best-effort) and
 * deletes the connection row. lungnote_gmail_synced_messages cascade-delete
 * via FK. Already-extracted lungnote_todos are kept (read-only history per
 * ADR-0017).
 */
export async function DELETE(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data: conn } = await supabase
    .from("lungnote_gmail_connections")
    .select("id, refresh_token_enc")
    .eq("user_id", user.id)
    .maybeSingle();

  if (conn?.refresh_token_enc) {
    try {
      // Stored as base64 string in TEXT column (per migration
      // 20260521090000_lungnote_gmail_token_columns_text).
      const refresh = decryptToken(
        conn.refresh_token_enc,
        `lungnote_gmail_connections:${conn.id}`,
      );
      await revokeToken(refresh);
    } catch {
      // best-effort; continue with row delete
    }
  }

  const { error: delErr } = await supabase
    .from("lungnote_gmail_connections")
    .delete()
    .eq("user_id", user.id);

  if (delErr) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
