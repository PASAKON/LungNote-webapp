import "server-only";
import type { FlexMessage, LineMessage } from "@/lib/line/client";

import todoSavedTpl from "@/lib/line/flex-templates/todo-saved.json";
import todoDeletedTpl from "@/lib/line/flex-templates/todo-deleted.json";
import todoUpdatedTpl from "@/lib/line/flex-templates/todo-updated.json";
import todoCompletedTpl from "@/lib/line/flex-templates/todo-completed.json";
import todoListSingleTpl from "@/lib/line/flex-templates/todo-list-single.json";
import todoEmptyTpl from "@/lib/line/flex-templates/todo-empty.json";
import errorInlineTpl from "@/lib/line/flex-templates/error-inline.json";
import multiSaveSummaryTpl from "@/lib/line/flex-templates/multi-save-summary.json";

/**
 * Designer-built Flex Message templates the agent picks via
 * `send_flex_reply`. v2 schema: each template uses {{key}} markers; the
 * list/multi-save templates also use {{item_N_field}} for per-item
 * substitution (capped slots, unused rows pruned).
 *
 * `liff_id` is injected automatically from
 * `NEXT_PUBLIC_LINE_LIFF_ID` env so the AI never has to know it.
 *
 * Phase 3a wires 8 templates: 5 refreshed + 3 new (empty, error_inline,
 * multi_save_summary). Phase 3b will add carousel + push templates
 * (dashboard_link_v2 / daily_digest / weekly_report).
 */
export const FLEX_TEMPLATE_NAMES = [
  "todo_saved",
  "todo_deleted",
  "todo_updated",
  "todo_completed",
  "todo_list",
  "todo_empty",
  "error_inline",
  "multi_save_summary",
] as const;
export type FlexTemplateName = (typeof FLEX_TEMPLATE_NAMES)[number];

/** Hardcoded slot counts in designer's templates. */
const LIST_SINGLE_SLOTS = 4;
const MULTI_SAVE_SLOTS = 2;

/** Fallback when NEXT_PUBLIC_LINE_LIFF_ID is missing (dev / preview). */
const LIFF_FALLBACK = "YOUR_LIFF_ID";
function getLiffId(): string {
  return (process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? LIFF_FALLBACK).trim();
}

export type TodoListItem = {
  /** 1-based position the user sees in chat. */
  idx: number;
  text: string;
  due_short?: string;
  urgency_color?: string;
  folder?: string;
};

export type MultiSaveItem = {
  text: string;
  date?: string;
  folder?: string;
};

/** Predefined error variants — AI picks a name; code fills the visuals. */
export const ERROR_INLINE_VARIANTS = {
  not_linked: {
    error_title: "ต้อง login ก่อน",
    error_description: "พิมพ์ 'dashboard' รับลิงก์เปิดเว็บเพื่อ login",
    error_icon: "🔒",
    error_bg_color: "#f0e4c4",
    action_label: "เปิด Dashboard",
    action_uri: "https://liff.line.me/{{liff_id}}",
    action_data: "",
    action_style: "primary",
    action_color: "#c9a040",
    action_type: "uri",
  },
  out_of_range: {
    error_title: "ตำแหน่งไม่ถูกต้อง",
    error_description:
      "เห็นแค่ {{max_position}} รายการในลิสต์ — เลือกเลขในช่วงนี้",
    error_icon: "⚠️",
    error_bg_color: "#f0e4c4",
    action_label: "ดูลิสต์ใหม่",
    action_uri: "",
    action_data: "action=refresh_list",
    action_style: "primary",
    action_color: "#c9a040",
    action_type: "postback",
  },
  ai_timeout: {
    error_title: "ระบบช้าเกินไป",
    error_description: "ลองส่งข้อความอีกครั้งใน 1-2 นาที",
    error_icon: "⏳",
    error_bg_color: "#f0d8d0",
    action_label: "ลองใหม่",
    action_uri: "",
    action_data: "action=retry",
    action_style: "primary",
    action_color: "#c9a040",
    action_type: "postback",
  },
  generic: {
    error_title: "ขอโทษ ระบบขัดข้อง",
    error_description: "ลองอีกครั้งภายหลังนะ",
    error_icon: "❌",
    error_bg_color: "#f0d8d0",
    action_label: "ดู Dashboard",
    action_uri: "https://liff.line.me/{{liff_id}}",
    action_data: "",
    action_style: "primary",
    action_color: "#c9a040",
    action_type: "uri",
  },
} as const;
export type ErrorVariant = keyof typeof ERROR_INLINE_VARIANTS;

export type FlexBuildVars = {
  todo_saved: {
    text: string;
    due_text?: string;
    folder_name?: string;
    open_url: string;
    id?: string;
  };
  todo_deleted: {
    text: string;
    folder_name?: string;
    remaining_count: number;
    undo_postback_data?: string;
  };
  todo_updated: {
    text: string;
    folder_name?: string;
    old_value?: string;
    new_value?: string;
    change_summary: string;
    open_url: string;
  };
  todo_completed: {
    text: string;
    folder_name?: string;
    pending_count_left: number;
    streak_msg?: string;
    undo_postback_data?: string;
  };
  todo_list: {
    count: number;
    date_thai: string;
    items: TodoListItem[];
  };
  todo_empty: {
    completed_this_week?: number;
    streak_days?: number;
  };
  error_inline: {
    variant: ErrorVariant;
    /** Used by `out_of_range` to render "เห็นแค่ N รายการ". */
    max_position?: number;
  };
  multi_save_summary: {
    count: number;
    items: MultiSaveItem[];
  };
};

/**
 * Build a Flex Message from a template + caller-supplied vars. Throws
 * if any required placeholder remains unsubstituted.
 */
export function buildFlexMessage<K extends FlexTemplateName>(
  template: K,
  vars: FlexBuildVars[K],
  altText?: string,
): LineMessage {
  if (template === "todo_list") {
    return buildTodoList(vars as FlexBuildVars["todo_list"], altText);
  }
  if (template === "todo_empty") {
    return buildTodoEmpty(vars as FlexBuildVars["todo_empty"], altText);
  }
  if (template === "error_inline") {
    return buildErrorInline(vars as FlexBuildVars["error_inline"], altText);
  }
  if (template === "multi_save_summary") {
    return buildMultiSave(vars as FlexBuildVars["multi_save_summary"], altText);
  }
  // Single-template path: substitute, fill defaults, inject liff_id.
  const tpl = clone(SINGLE_TEMPLATES[template as keyof typeof SINGLE_TEMPLATES]);
  const filled = withDefaults(template, vars as Record<string, unknown>);
  filled.liff_id = getLiffId();
  applyVars(tpl, filled);
  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, template);
  return tpl;
}

const SINGLE_TEMPLATES = {
  todo_saved: todoSavedTpl as unknown as FlexMessage,
  todo_deleted: todoDeletedTpl as unknown as FlexMessage,
  todo_updated: todoUpdatedTpl as unknown as FlexMessage,
  todo_completed: todoCompletedTpl as unknown as FlexMessage,
};

function withDefaults(
  template: FlexTemplateName,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  // LINE rejects empty text nodes — replace empty/missing with non-empty
  // fallbacks at every path.
  const filled = { ...vars };
  const fillIfEmpty = (key: string, fallback: string) => {
    const v = filled[key];
    if (typeof v !== "string" || v.length === 0) filled[key] = fallback;
  };
  if (template === "todo_saved") {
    fillIfEmpty("due_text", "ไม่มีกำหนด");
    fillIfEmpty("folder_name", "Inbox");
    fillIfEmpty("id", "");
  } else if (template === "todo_deleted") {
    fillIfEmpty("folder_name", "Inbox");
    fillIfEmpty("undo_postback_data", "action=noop");
  } else if (template === "todo_updated") {
    fillIfEmpty("folder_name", "Inbox");
    fillIfEmpty("old_value", "—");
    fillIfEmpty("new_value", "—");
  } else if (template === "todo_completed") {
    fillIfEmpty("folder_name", "Inbox");
    fillIfEmpty("streak_msg", "—");
    fillIfEmpty("undo_postback_data", "action=noop");
  }
  return filled;
}

// ── todo_list ───────────────────────────────────────────────────────

function buildTodoList(
  vars: FlexBuildVars["todo_list"],
  altText?: string,
): LineMessage {
  const tpl = clone(todoListSingleTpl as unknown as FlexMessage);
  const itemsShown = vars.items.slice(0, LIST_SINGLE_SLOTS);

  const flatVars: Record<string, unknown> = {
    count: vars.count,
    date_thai: vars.date_thai,
    liff_id: getLiffId(),
  };
  for (let i = 0; i < itemsShown.length; i++) {
    const slot = i + 1; // designer uses 1-based slots
    const item = itemsShown[i];
    flatVars[`item_${slot}_idx`] = String(item.idx);
    flatVars[`item_${slot}_text`] = item.text;
    flatVars[`item_${slot}_due`] =
      item.due_short && item.due_short.length > 0 ? item.due_short : "—";
    flatVars[`item_${slot}_urgency_color`] =
      item.urgency_color ?? "#a08050";
    flatVars[`item_${slot}_folder`] =
      item.folder && item.folder.length > 0 ? item.folder : "Inbox";
  }
  applyVars(tpl, flatVars);
  pruneRowsWithMarkers(tpl, /\{\{item_\d+_\w+\}\}/);
  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, "todo_list");
  return tpl;
}

// ── todo_empty ──────────────────────────────────────────────────────

function buildTodoEmpty(
  vars: FlexBuildVars["todo_empty"],
  altText?: string,
): LineMessage {
  const tpl = clone(todoEmptyTpl as unknown as FlexMessage);
  applyVars(tpl, {
    completed_this_week: vars.completed_this_week ?? 0,
    streak_days: vars.streak_days ?? 0,
    liff_id: getLiffId(),
  });
  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, "todo_empty");
  return tpl;
}

// ── error_inline ────────────────────────────────────────────────────

function buildErrorInline(
  vars: FlexBuildVars["error_inline"],
  altText?: string,
): LineMessage {
  const tpl = clone(errorInlineTpl as unknown as FlexMessage);
  const variant = ERROR_INLINE_VARIANTS[vars.variant];
  // Pre-resolve liff_id inside variant.action_uri before substitution
  // so {{liff_id}} nested in a variant string also gets filled.
  const liff_id = getLiffId();
  applyVars(tpl, {
    error_title: variant.error_title,
    error_description: variant.error_description.replace(
      "{{max_position}}",
      String(vars.max_position ?? 0),
    ),
    error_icon: variant.error_icon,
    error_bg_color: variant.error_bg_color,
    action_label: variant.action_label,
    action_uri: variant.action_uri.replace("{{liff_id}}", liff_id),
    action_data: variant.action_data,
    action_style: variant.action_style,
    action_color: variant.action_color,
    action_type: variant.action_type,
    liff_id,
    max_position: vars.max_position ?? 0,
  });
  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, "error_inline");
  return tpl;
}

// ── multi_save_summary ──────────────────────────────────────────────

function buildMultiSave(
  vars: FlexBuildVars["multi_save_summary"],
  altText?: string,
): LineMessage {
  const tpl = clone(multiSaveSummaryTpl as unknown as FlexMessage);
  const itemsShown = vars.items.slice(0, MULTI_SAVE_SLOTS);

  const flatVars: Record<string, unknown> = {
    count: vars.count,
    liff_id: getLiffId(),
  };
  for (let i = 0; i < itemsShown.length; i++) {
    const slot = i + 1;
    const item = itemsShown[i];
    flatVars[`item_${slot}_text`] = item.text;
    flatVars[`item_${slot}_date`] =
      item.date && item.date.length > 0 ? item.date : "—";
    flatVars[`item_${slot}_folder`] =
      item.folder && item.folder.length > 0 ? item.folder : "Inbox";
  }
  applyVars(tpl, flatVars);
  pruneRowsWithMarkers(tpl, /\{\{item_\d+_\w+\}\}/);
  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, "multi_save_summary");
  return tpl;
}

// ── helpers ─────────────────────────────────────────────────────────

function pruneRowsWithMarkers(node: unknown, re: RegExp): void {
  // Walk the tree. Drop any "box" node whose serialized form still
  // contains a placeholder matching `re` after substitution. Also drop
  // the separator immediately above a pruned box so we don't end up
  // with double separators.
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const child = node[i] as Record<string, unknown> | unknown;
      if (
        child &&
        typeof child === "object" &&
        (child as Record<string, unknown>).type === "box" &&
        re.test(JSON.stringify(child))
      ) {
        node.splice(i, 1);
        const prev = i - 1 >= 0 ? (node[i - 1] as Record<string, unknown> | undefined) : undefined;
        if (prev && prev.type === "separator") {
          node.splice(i - 1, 1);
        }
      } else {
        pruneRowsWithMarkers(child, re);
      }
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      pruneRowsWithMarkers(v, re);
    }
  }
}

function applyVars(node: unknown, vars: Record<string, unknown>): void {
  substituteAll(node, vars);
}

function substituteAll(node: unknown, vars: Record<string, unknown>): void {
  if (Array.isArray(node)) {
    for (const item of node) substituteAll(item, vars);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") {
        obj[k] = substituteString(v, vars);
      } else {
        substituteAll(v, vars);
      }
    }
  }
}

const PLACEHOLDER_RE = /\{\{([\w[\].]+)\}\}/g;

function substituteString(s: string, vars: Record<string, unknown>): string {
  return s.replace(PLACEHOLDER_RE, (m, key: string) => {
    if (!(key in vars)) return m;
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

function assertNoUnsubstituted(node: unknown, template: string): void {
  const json = JSON.stringify(node);
  const leftover = json.match(/\{\{[\w[\].]+\}\}/g);
  if (leftover && leftover.length > 0) {
    throw new Error(
      `flex template ${template} has unsubstituted markers: ${leftover.join(", ")}`,
    );
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
