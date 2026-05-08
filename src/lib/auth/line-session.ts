import "server-only";
import type { LineIdTokenClaims } from "@/lib/auth/liff-verify";
import { syntheticEmailFromLineUserId } from "@/lib/auth/synthetic-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export type SessionResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * Upsert auth.users + lungnote_profiles for a verified LINE OIDC user, then
 * mint a magic link and verify it on the cookie-aware ssr client so the auth
 * cookies land on the current response.
 *
 * Used by all three auth paths (account-linking, LIFF, web OAuth) so the
 * user/session shape stays identical regardless of how the user signed in.
 */
export async function upsertLineUserAndSetSession(
  claims: Pick<LineIdTokenClaims, "sub" | "name" | "picture">,
): Promise<SessionResult> {
  const lineUserId = claims.sub;
  const email = syntheticEmailFromLineUserId(lineUserId);
  const displayName = claims.name ?? null;
  const pictureUrl = claims.picture ?? null;

  const admin = createAdminClient();

  const { data: profileRow } = await admin
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  let userId: string;
  if (profileRow?.id) {
    userId = profileRow.id;
    if (displayName || pictureUrl) {
      await admin
        .from("lungnote_profiles")
        .update({
          line_display_name: displayName,
          line_picture_url: pictureUrl,
        })
        .eq("id", userId);
    }
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        provider: "line",
        line_user_id: lineUserId,
        display_name: displayName,
      },
    });
    if (createErr || !created.user) {
      return { ok: false, error: "create_user_failed" };
    }
    userId = created.user.id;

    await admin.from("lungnote_profiles").insert({
      id: userId,
      line_user_id: lineUserId,
      line_display_name: displayName,
      line_picture_url: pictureUrl,
    });
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData.properties?.hashed_token) {
    return { ok: false, error: "magic_link_failed" };
  }

  const supabase = await createServerClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr) {
    return { ok: false, error: "session_set_failed" };
  }

  return { ok: true, userId };
}
