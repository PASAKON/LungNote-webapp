"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateInboxNoteId } from "@/lib/notes/inbox";
import { getFreshAccessToken } from "@/lib/gmail/client";
import { sendThreadReply } from "@/lib/gmail/send";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ReplyResult =
  | { ok: true; alreadySent?: boolean }
  | { ok: false; error: string };

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

/**
 * Reply to the Gmail message that produced an email-sourced todo (ADR-0022 C).
 * Idempotent: a todo with a sent reply can't be replied to again. The todo's
 * `done` state is untouched — replying and completing are independent.
 */
export async function replyToEmailTodo(
  todoId: string,
  body: string,
): Promise<ReplyResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "ใส่ข้อความก่อน" };
  if (text.length > 5000) return { ok: false, error: "ยาวเกิน 5000 ตัวอักษร" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ไม่พบ session" };

  const { data: todo } = await supabase
    .from("lungnote_todos")
    .select("id, source")
    .eq("id", todoId)
    .maybeSingle();
  if (!todo || todo.source !== "email") {
    return { ok: false, error: "งานนี้ไม่ได้มาจากอีเมล" };
  }

  const admin = createAdminClient();

  const { data: already } = await admin
    .from("lungnote_email_replies")
    .select("id")
    .eq("todo_id", todoId)
    .eq("status", "sent")
    .maybeSingle();
  if (already) return { ok: true, alreadySent: true };

  const { data: synced } = await admin
    .from("lungnote_gmail_synced_messages")
    .select("message_id, thread_id")
    .eq("todo_id", todoId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!synced?.message_id || !synced.thread_id) {
    return { ok: false, error: "ไม่พบอีเมลต้นทางของงานนี้" };
  }

  const { data: conn } = await admin
    .from("lungnote_gmail_connections")
    .select(
      "id, scope, refresh_token_enc, access_token_enc, access_token_expires_at",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!conn) return { ok: false, error: "ยังไม่ได้เชื่อม Gmail" };
  const scope = conn.scope ?? "";
  const canSend =
    scope.includes("gmail.send") ||
    scope.includes("gmail.modify") ||
    scope.includes("https://mail.google.com/");
  if (!canSend) {
    return {
      ok: false,
      error: "ยังไม่ได้เปิดสิทธิ์ตอบกลับ — ไปที่ตั้งค่า เชื่อม Gmail แบบ 'อ่าน + ตอบกลับ' ก่อน",
    };
  }

  let accessToken: string;
  try {
    const fresh = await getFreshAccessToken({
      id: conn.id,
      refresh_token_enc: conn.refresh_token_enc,
      access_token_enc: conn.access_token_enc ?? null,
      access_token_expires_at: conn.access_token_expires_at,
    });
    accessToken = fresh.accessToken;
    if (fresh.rotated && fresh.newAccessTokenEnc) {
      await admin
        .from("lungnote_gmail_connections")
        .update({
          access_token_enc: fresh.newAccessTokenEnc,
          access_token_expires_at: fresh.expiresAt.toISOString(),
        })
        .eq("id", conn.id);
    }
  } catch {
    return { ok: false, error: "ต่ออายุสิทธิ์ Gmail ไม่สำเร็จ ลองเชื่อมใหม่" };
  }

  try {
    const sent = await sendThreadReply(accessToken, {
      originalMessageId: synced.message_id,
      threadId: synced.thread_id,
      body: text,
    });
    await admin.from("lungnote_email_replies").insert({
      user_id: user.id,
      todo_id: todoId,
      thread_id: synced.thread_id,
      message_id: synced.message_id,
      body: text,
      status: "sent",
      gmail_message_id: sent.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("lungnote_email_replies").insert({
      user_id: user.id,
      todo_id: todoId,
      thread_id: synced.thread_id,
      message_id: synced.message_id,
      body: text,
      status: "failed",
      error: msg.slice(0, 500),
    });
    return { ok: false, error: "ส่งไม่สำเร็จ: " + msg.slice(0, 120) };
  }

  revalidatePath("/dashboard/todo");
  return { ok: true };
}
