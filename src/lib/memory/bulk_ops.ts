import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BulkOpKind } from "@/lib/agent/bulk_guard";

export type { BulkOpKind };

export type BulkOpRecord = {
  id: string;
  user_id: string;
  op_kind: BulkOpKind;
  todo_ids: string[];
  created_at: string;
};

async function resolveUserId(lineUserId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("lungnote_profiles")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Record a batch of bulk ops so the user can undo them later. */
export async function recordBulkOp(
  lineUserId: string,
  opKind: BulkOpKind,
  todoIds: string[],
): Promise<{ ok: boolean; id?: string }> {
  const userId = await resolveUserId(lineUserId);
  if (!userId) return { ok: false };

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("lungnote_bulk_ops")
    .insert({ user_id: userId, op_kind: opKind, todo_ids: todoIds })
    .select("id")
    .single();

  if (error || !data) return { ok: false };
  return { ok: true, id: (data as { id: string }).id };
}

/** Fetch the most recent bulk op within the last 10 minutes. */
export async function getLastBulkOp(
  lineUserId: string,
): Promise<BulkOpRecord | null> {
  const userId = await resolveUserId(lineUserId);
  if (!userId) return null;

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const sb = createAdminClient();
  const { data } = await sb
    .from("lungnote_bulk_ops")
    .select("id, user_id, op_kind, todo_ids, created_at")
    .eq("user_id", userId)
    .gte("created_at", tenMinAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return data as unknown as BulkOpRecord;
}

/** Delete the bulk op record after a successful undo. */
export async function clearLastBulkOp(
  lineUserId: string,
  opId: string,
): Promise<void> {
  const userId = await resolveUserId(lineUserId);
  if (!userId) return;

  const sb = createAdminClient();
  await sb
    .from("lungnote_bulk_ops")
    .delete()
    .eq("id", opId)
    .eq("user_id", userId);
}
