"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createNote(formData: FormData): Promise<ActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");

  if (!title) return { ok: false, error: "กรุณาใส่ชื่อโน้ต" };
  if (title.length > 200)
    return { ok: false, error: "ชื่อโน้ตยาวเกิน 200 ตัวอักษร" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "session หมดอายุ" };

  const { data, error } = await supabase
    .from("lungnote_notes")
    .insert({ user_id: user.id, title, body })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  redirect(`/dashboard/notes/${data.id}`);
}

export async function updateNote(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");

  if (!title) return { ok: false, error: "กรุณาใส่ชื่อโน้ต" };
  if (title.length > 200)
    return { ok: false, error: "ชื่อโน้ตยาวเกิน 200 ตัวอักษร" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lungnote_notes")
    .update({ title, body })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/notes/${id}`);
  return { ok: true };
}

export async function deleteNote(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("lungnote_notes").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
