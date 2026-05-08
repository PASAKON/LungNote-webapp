import "server-only";
import { createClient } from "@/lib/supabase/server";

const INBOX_TITLE = "📥 Inbox";

/**
 * Returns the user's Inbox note id (lazy-creates on first call). Used as the
 * default container for chat-captured / standalone todos that don't belong
 * to a specific note yet.
 */
export async function getOrCreateInboxNoteId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("lungnote_notes")
    .select("id")
    .eq("user_id", user.id)
    .eq("title", INBOX_TITLE)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("lungnote_notes")
    .insert({
      user_id: user.id,
      title: INBOX_TITLE,
      body: "",
    })
    .select("id")
    .single();

  if (error) return null;
  return created.id;
}
