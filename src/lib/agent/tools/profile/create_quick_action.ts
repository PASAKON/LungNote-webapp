import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSupabaseUserIdFromLine } from "@/lib/gmail/agent-helpers";
import type { AgentTool } from "../../tool";

const args = z.object({
  action: z
    .enum(["create", "list", "delete"])
    .describe("'create' a reusable reply button, 'list' all, or 'delete' by id."),
  label: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .describe("create: button text, e.g. '✓ อนุมัติ' / 'รับงาน'."),
  body: z
    .string()
    .min(1)
    .max(2000)
    .optional()
    .describe("create: the reply that gets sent when tapped."),
  intent: z
    .enum(["approve", "reject", "ask", "ack", "other"])
    .optional()
    .describe("create: semantic intent. Default 'other'."),
  scope: z
    .enum(["global", "category"])
    .optional()
    .describe("create: 'global' shows on every email todo; 'category' only when match_category fits. Default 'global'."),
  match_category: z
    .string()
    .max(40)
    .optional()
    .describe("create: required when scope='category', e.g. 'approval'."),
  need_reason: z
    .boolean()
    .optional()
    .describe("create: true if tapping should prompt the user for a reason before sending (e.g. reject)."),
  emoji: z.string().max(8).optional().describe("create: optional leading emoji."),
  id: z.string().uuid().optional().describe("delete: the quick-action id to remove."),
});

export const createQuickActionTool: AgentTool<z.infer<typeof args>> = {
  name: "create_quick_action",
  category: "profile",
  description:
    "Manage the user's reusable quick-reply BUTTONS for email todos. Call action='create' when the user asks to make a shortcut button ('สร้างปุ่ม...ตอบว่า...', 'ทำปุ่มลัด'). Call action='list' when they ask what buttons exist, action='delete' to remove one. These buttons appear as one-tap chips on Gmail-sourced todos.",
  schema: args,
  requires: ["linked"],
  async execute(input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    const userId = await resolveSupabaseUserIdFromLine(ctx.lineUserId);
    if (!userId) return { ok: false, reason: "not_linked" };
    const sb = createAdminClient();

    if (input.action === "list") {
      const { data, error } = await sb
        .from("lungnote_quick_actions")
        .select("id, label, intent, scope, match_category, need_reason, enabled")
        .eq("user_id", userId)
        .order("position", { ascending: true });
      if (error) return { ok: false, reason: "db_error", error: error.message };
      return { ok: true, action: "list", actions: data ?? [], count: data?.length ?? 0 };
    }

    if (input.action === "delete") {
      if (!input.id) return { ok: false, reason: "id_required" };
      const { error } = await sb
        .from("lungnote_quick_actions")
        .delete()
        .eq("id", input.id)
        .eq("user_id", userId);
      if (error) return { ok: false, reason: "db_error", error: error.message };
      return { ok: true, action: "delete", id: input.id };
    }

    // create
    if (!input.label || !input.body) {
      return { ok: false, reason: "label_and_body_required" };
    }
    if (input.scope === "category" && !input.match_category) {
      return { ok: false, reason: "match_category_required_for_category_scope" };
    }
    const { data, error } = await sb
      .from("lungnote_quick_actions")
      .insert({
        user_id: userId,
        label: input.label,
        body: input.body,
        intent: input.intent ?? "other",
        scope: input.scope ?? "global",
        match_category: input.match_category ?? null,
        need_reason: input.need_reason ?? false,
        emoji: input.emoji ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, reason: "db_error", error: error?.message ?? "unknown" };
    }
    return { ok: true, action: "create", id: data.id, label: input.label };
  },
};
