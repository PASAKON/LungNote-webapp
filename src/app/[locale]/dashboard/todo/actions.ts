"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateInboxNoteId } from "@/lib/notes/inbox";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createTodo(text: string): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "ใส่ข้อความก่อน" };
  if (trimmed.length > 2000) return { ok: false, error: "ยาวเกิน 2000 ตัวอักษร" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ไม่พบ session" };

  const noteId = await getOrCreateInboxNoteId();
  if (!noteId) return { ok: false, error: "สร้าง Inbox note ไม่ได้" };

  const { data: maxRow } = await supabase
    .from("lungnote_todos")
    .select("position")
    .eq("note_id", noteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase.from("lungnote_todos").insert({
    user_id: user.id,
    note_id: noteId,
    text: trimmed,
    done: false,
    position: nextPos,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/todo");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleTodoDone(
  id: string,
  done: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lungnote_todos")
    .update({ done })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/todo");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTodoText(
  id: string,
  text: string,
): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "ใส่ข้อความก่อน" };
  if (trimmed.length > 2000) return { ok: false, error: "ยาวเกิน 2000 ตัวอักษร" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lungnote_todos")
    .update({ text: trimmed })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/todo");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lungnote_todos")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/todo");
  revalidatePath("/dashboard");
  return { ok: true };
}
