import "server-only";
import { z } from "zod";
import { TurnContext } from "../../context";
import {
  ERROR_INLINE_VARIANTS,
  FLEX_TEMPLATE_NAMES,
  buildFlexMessage,
  type FlexTemplateName,
  type MultiSaveItem,
  type TodoListItem,
} from "../../flex/templates";
import type { AgentTool } from "../../tool";

/**
 * Reply with a Designer-built Flex Message instead of plain text.
 *
 * AI picks a template by name + supplies typed vars; the tool loads
 * the Designer JSON server-side, substitutes vars, and queues the
 * Flex bubble in the TurnContext reply buffer. Counts toward the
 * 5-bubble cap (shared with send_text_reply).
 *
 * Phase 3a templates (8): todo_saved, todo_deleted, todo_updated,
 * todo_completed, todo_list, todo_empty, error_inline,
 * multi_save_summary. liff_id is auto-injected from env so the AI
 * never has to pass it.
 */

const todoListItem = z.object({
  idx: z.number().int().min(1),
  text: z.string().min(1),
  due_short: z.string().optional(),
  urgency_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  folder: z.string().optional(),
});

const multiSaveItem = z.object({
  text: z.string().min(1),
  date: z.string().optional(),
  folder: z.string().optional(),
});

const args = z
  .object({
    template: z.enum(FLEX_TEMPLATE_NAMES),
    alt_text: z.string().min(1).max(200).optional(),
    vars: z.record(z.string(), z.unknown()),
  })
  .strict();

type Args = z.infer<typeof args>;

export const sendFlexReplyTool: AgentTool<Args> = {
  name: "send_flex_reply",
  category: "reply",
  description:
    "Reply with a Designer-built Flex card. Templates: todo_saved, note_saved, todo_deleted, todo_updated, todo_completed, todo_list, todo_empty, error_inline, multi_save_summary. liff_id is filled by the server. Skip when one plain text bubble is enough.",
  schema: args,
  async execute(input, ctx) {
    const validation = validateVars(input.template, input.vars);
    if (!validation.ok) {
      return {
        ok: false,
        reason: "invalid_vars",
        message: validation.error,
      };
    }

    let flex;
    try {
      flex = buildFlexMessage(
        input.template,
        validation.vars,
        input.alt_text,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: "template_error", message: msg };
    }

    const r = ctx.pushReplyFlex(flex);
    if (!r.ok) {
      return {
        ok: false,
        reason: r.reason ?? "push_failed",
        message: `Bubble limit ${TurnContext.MAX_BUBBLES} reached. Stop calling reply tools.`,
      };
    }
    return {
      ok: true,
      template: input.template,
      bubble_index: ctx.getReplyBubbles().length,
      remaining: TurnContext.MAX_BUBBLES - ctx.getReplyBubbles().length,
    };
  },
};

// ── per-template var validation ─────────────────────────────────────

type ValidationResult =
  | { ok: true; vars: Parameters<typeof buildFlexMessage>[1] }
  | { ok: false; error: string };

function validateVars(
  template: FlexTemplateName,
  raw: Record<string, unknown>,
): ValidationResult {
  switch (template) {
    case "todo_saved": {
      const text = asNonEmpty(raw.text);
      const open_url = asNonEmpty(raw.open_url);
      if (!text || !open_url) {
        return { ok: false, error: "todo_saved requires text + open_url" };
      }
      return {
        ok: true,
        vars: {
          text,
          open_url,
          due_text: asNonEmpty(raw.due_text) ?? "ไม่มีกำหนด",
          folder_name: asNonEmpty(raw.folder_name) ?? "Inbox",
          id: asNonEmpty(raw.id) ?? "",
        },
      };
    }
    case "note_saved": {
      const text = asNonEmpty(raw.text);
      const open_url = asNonEmpty(raw.open_url);
      if (!text || !open_url) {
        return { ok: false, error: "note_saved requires text + open_url" };
      }
      return {
        ok: true,
        vars: {
          text,
          open_url,
          body_text:
            asNonEmpty(raw.body_text) ?? "แตะปุ่มข้างล่างเพื่อจัดการในเว็บ",
        },
      };
    }
    case "todo_deleted": {
      const text = asNonEmpty(raw.text);
      const remaining_count = asInt(raw.remaining_count);
      if (!text || remaining_count === null) {
        return {
          ok: false,
          error: "todo_deleted requires text + remaining_count",
        };
      }
      return {
        ok: true,
        vars: {
          text,
          remaining_count,
          folder_name: asNonEmpty(raw.folder_name) ?? "Inbox",
          undo_postback_data:
            asNonEmpty(raw.undo_postback_data) ?? "action=noop",
        },
      };
    }
    case "todo_updated": {
      const text = asNonEmpty(raw.text);
      const change_summary = asNonEmpty(raw.change_summary);
      const open_url = asNonEmpty(raw.open_url);
      if (!text || !change_summary || !open_url) {
        return {
          ok: false,
          error: "todo_updated requires text + change_summary + open_url",
        };
      }
      return {
        ok: true,
        vars: {
          text,
          change_summary,
          open_url,
          folder_name: asNonEmpty(raw.folder_name) ?? "Inbox",
          old_value: asNonEmpty(raw.old_value) ?? "—",
          new_value: asNonEmpty(raw.new_value) ?? "—",
        },
      };
    }
    case "todo_completed": {
      const text = asNonEmpty(raw.text);
      const pending_count_left = asInt(raw.pending_count_left);
      if (!text || pending_count_left === null) {
        return {
          ok: false,
          error: "todo_completed requires text + pending_count_left",
        };
      }
      return {
        ok: true,
        vars: {
          text,
          pending_count_left,
          folder_name: asNonEmpty(raw.folder_name) ?? "Inbox",
          streak_msg: asNonEmpty(raw.streak_msg) ?? "—",
          undo_postback_data:
            asNonEmpty(raw.undo_postback_data) ?? "action=noop",
        },
      };
    }
    case "todo_list": {
      const count = asInt(raw.count);
      const date_thai = asNonEmpty(raw.date_thai);
      const itemsRaw = raw.items;
      if (count === null || !date_thai || !Array.isArray(itemsRaw)) {
        return {
          ok: false,
          error: "todo_list requires count + date_thai + items[]",
        };
      }
      const parsedItems: TodoListItem[] = [];
      for (const it of itemsRaw) {
        const parsed = todoListItem.safeParse(it);
        if (!parsed.success) {
          return {
            ok: false,
            error: `todo_list item invalid: ${parsed.error.message}`,
          };
        }
        parsedItems.push(parsed.data);
      }
      return { ok: true, vars: { count, date_thai, items: parsedItems } };
    }
    case "todo_empty": {
      return {
        ok: true,
        vars: {
          completed_this_week: asInt(raw.completed_this_week) ?? 0,
          streak_days: asInt(raw.streak_days) ?? 0,
        },
      };
    }
    case "error_inline": {
      const variant = raw.variant;
      if (
        typeof variant !== "string" ||
        !(variant in ERROR_INLINE_VARIANTS)
      ) {
        return {
          ok: false,
          error: `error_inline variant must be one of: ${Object.keys(ERROR_INLINE_VARIANTS).join(", ")}`,
        };
      }
      return {
        ok: true,
        vars: {
          variant: variant as keyof typeof ERROR_INLINE_VARIANTS,
          max_position: asInt(raw.max_position) ?? 0,
        },
      };
    }
    case "multi_save_summary": {
      const count = asInt(raw.count);
      const itemsRaw = raw.items;
      if (count === null || !Array.isArray(itemsRaw)) {
        return {
          ok: false,
          error: "multi_save_summary requires count + items[]",
        };
      }
      const parsedItems: MultiSaveItem[] = [];
      for (const it of itemsRaw) {
        const parsed = multiSaveItem.safeParse(it);
        if (!parsed.success) {
          return {
            ok: false,
            error: `multi_save_summary item invalid: ${parsed.error.message}`,
          };
        }
        parsedItems.push(parsed.data);
      }
      return { ok: true, vars: { count, items: parsedItems } };
    }
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNonEmpty(v: unknown): string | undefined {
  const s = asString(v);
  return s && s.length > 0 ? s : undefined;
}
function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  return null;
}
