import "server-only";
import { z } from "zod";
import { TurnContext } from "../../context";
import {
  FLEX_TEMPLATE_NAMES,
  buildFlexMessage,
  type FlexTemplateName,
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
 * Why a tool not a string: Designer iterates on JSON without code
 * changes, AI doesn't burn tokens emitting Flex JSON, and we type-check
 * required vars per template at the schema layer.
 */

const todoListItem = z.object({
  idx: z.number().int().min(1),
  text: z.string().min(1),
  due_short: z.string().optional(),
  urgency_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  subline: z.string().optional(),
});

const args = z
  .object({
    template: z.enum(FLEX_TEMPLATE_NAMES),
    alt_text: z.string().min(1).max(200).optional(),
    /**
     * Vars depend on template. We accept a loose record at the Zod
     * layer and validate per-template inside execute() so the model
     * sees one schema. Each template's required keys:
     *   todo_saved:     text, open_url; opt due_at_pretty, folder_name
     *   todo_deleted:   text, remaining_count, open_url
     *   todo_updated:   text, change_summary, open_url
     *   todo_completed: text, pending_count_left, open_url
     *   todo_list:      count, date_pretty, items[], open_url
     */
    vars: z.record(z.string(), z.unknown()),
  })
  .strict();

type Args = z.infer<typeof args>;

export const sendFlexReplyTool: AgentTool<Args> = {
  name: "send_flex_reply",
  category: "reply",
  description:
    "Reply with a Designer-built Flex Message bubble. Use after a successful mutation tool (save/delete/update/complete) or list_pending. Templates: todo_saved, todo_deleted, todo_updated, todo_completed, todo_list. Counts toward the 5-bubble cap. Skip when one plain text bubble is enough.",
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

// ── per-template var validation (runtime, since Zod record is loose) ──

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
          // LINE Flex rejects empty text nodes — use asNonEmpty to apply
          // the default whenever the AI sends "" / null / missing.
          due_text: asNonEmpty(raw.due_text) ?? "ไม่มีกำหนด",
          folder_name: asNonEmpty(raw.folder_name) ?? "Inbox",
        },
      };
    }
    case "todo_deleted": {
      const text = asNonEmpty(raw.text);
      const open_url = asNonEmpty(raw.open_url);
      const remaining_count = asInt(raw.remaining_count);
      if (!text || !open_url || remaining_count === null) {
        return {
          ok: false,
          error: "todo_deleted requires text + remaining_count + open_url",
        };
      }
      return {
        ok: true,
        vars: {
          text,
          open_url,
          remaining_count,
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
          // Diff bar text nodes — never empty, fall back to em-dash.
          old_value: asNonEmpty(raw.old_value) ?? "—",
          new_value: asNonEmpty(raw.new_value) ?? "—",
        },
      };
    }
    case "todo_completed": {
      const text = asNonEmpty(raw.text);
      const open_url = asNonEmpty(raw.open_url);
      const pending_count_left = asInt(raw.pending_count_left);
      if (!text || !open_url || pending_count_left === null) {
        return {
          ok: false,
          error:
            "todo_completed requires text + pending_count_left + open_url",
        };
      }
      return {
        ok: true,
        vars: {
          text,
          open_url,
          pending_count_left,
          // Streak row visible whether streak or not — em-dash default keeps
          // the bubble valid; AI fills with real streak text when applicable.
          streak_msg: asNonEmpty(raw.streak_msg) ?? "—",
          undo_postback_data:
            asNonEmpty(raw.undo_postback_data) ?? "action=noop",
        },
      };
    }
    case "todo_list": {
      const count = asInt(raw.count);
      const date_display = asNonEmpty(raw.date_display);
      const open_url = asNonEmpty(raw.open_url);
      const itemsRaw = raw.items;
      if (
        count === null ||
        !date_display ||
        !open_url ||
        !Array.isArray(itemsRaw)
      ) {
        return {
          ok: false,
          error:
            "todo_list requires count + date_display + items[] + open_url",
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
      return {
        ok: true,
        vars: { count, date_display, items: parsedItems, open_url },
      };
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
