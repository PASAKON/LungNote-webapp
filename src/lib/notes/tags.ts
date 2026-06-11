import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

/** Minimal tag shape rendered as a Gmail-style label chip. */
export type NoteTag = Pick<
  Database["public"]["Tables"]["lungnote_tags"]["Row"],
  "id" | "name" | "color"
>;

/** A tag plus how many of the user's notes carry it (filter-bar counts). */
export type TagWithCount = NoteTag & { count: number };

type NoteTagPair = Pick<
  Database["public"]["Tables"]["lungnote_notes_tags"]["Row"],
  "note_id" | "tag_id"
>;

// ---------------------------------------------------------------------------
// Queries
//
// The generated database.types.ts declares empty `Relationships: []` for both
// lungnote_tags and lungnote_notes_tags, so PostgREST resource-embedding
// (`select("*, lungnote_tags(*)")`) does not type-check. We fetch the junction
// and the tags separately and join in JS. Every query is RLS-scoped to the
// signed-in user (select-own on lungnote_tags, all-own on lungnote_notes_tags),
// so no explicit user_id filter is needed here.
// ---------------------------------------------------------------------------

/** All of the signed-in user's tags, ordered by name (Thai-aware). */
export async function getUserTags(sb: DB): Promise<NoteTag[]> {
  const { data } = await sb
    .from("lungnote_tags")
    .select("id, name, color")
    .order("name", { ascending: true });
  return data ?? [];
}

/**
 * Every note↔tag link the user owns. Small per-user set — one round-trip feeds
 * both the per-note chips (joined by note id) and the filter-bar counts.
 */
export async function getAllNoteTagPairs(sb: DB): Promise<NoteTagPair[]> {
  const { data } = await sb
    .from("lungnote_notes_tags")
    .select("note_id, tag_id");
  return data ?? [];
}

/** Tags attached to a single note, ordered by name. Used on the note detail page. */
export async function getTagsForNote(sb: DB, noteId: string): Promise<NoteTag[]> {
  const { data: pairs } = await sb
    .from("lungnote_notes_tags")
    .select("tag_id")
    .eq("note_id", noteId);

  const tagIds = (pairs ?? []).map((p) => p.tag_id);
  if (tagIds.length === 0) return [];

  const { data: tags } = await sb
    .from("lungnote_tags")
    .select("id, name, color")
    .in("id", tagIds);

  return sortTagsByName(tags ?? []);
}

// ---------------------------------------------------------------------------
// Pure transforms (unit-tested — no DB)
// ---------------------------------------------------------------------------

/** Count distinct notes per tag id from junction pairs (composite PK ⇒ 1 row = 1 note). */
export function countNotesPerTag(
  pairs: Pick<NoteTagPair, "tag_id">[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { tag_id } of pairs) {
    counts.set(tag_id, (counts.get(tag_id) ?? 0) + 1);
  }
  return counts;
}

/** Attach per-tag note counts, preserving the incoming tag order. */
export function withCounts(
  tags: NoteTag[],
  pairs: Pick<NoteTagPair, "tag_id">[],
): TagWithCount[] {
  const counts = countNotesPerTag(pairs);
  return tags.map((t) => ({ ...t, count: counts.get(t.id) ?? 0 }));
}

/** Map note id → its tags, dropping links whose tag is unknown. Tags sorted by name. */
export function groupTagsByNote(
  pairs: NoteTagPair[],
  tagsById: Map<string, NoteTag>,
): Map<string, NoteTag[]> {
  const byNote = new Map<string, NoteTag[]>();
  for (const { note_id, tag_id } of pairs) {
    const tag = tagsById.get(tag_id);
    if (!tag) continue;
    const list = byNote.get(note_id);
    if (list) list.push(tag);
    else byNote.set(note_id, [tag]);
  }
  for (const list of byNote.values()) sortTagsByNameInPlace(list);
  return byNote;
}

/** Note ids carrying a given tag (drives the ?tag= filter). */
export function noteIdsForTag(pairs: NoteTagPair[], tagId: string): string[] {
  return pairs.filter((p) => p.tag_id === tagId).map((p) => p.note_id);
}

function sortTagsByName(tags: NoteTag[]): NoteTag[] {
  return [...tags].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

function sortTagsByNameInPlace(tags: NoteTag[]): void {
  tags.sort((a, b) => a.name.localeCompare(b.name, "th"));
}
