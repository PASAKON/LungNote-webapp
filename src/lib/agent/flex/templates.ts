import "server-only";
import type { FlexMessage, LineMessage } from "@/lib/line/client";

import todoSavedTpl from "@/lib/line/flex-templates/todo-saved.json";
import todoDeletedTpl from "@/lib/line/flex-templates/todo-deleted.json";
import todoUpdatedTpl from "@/lib/line/flex-templates/todo-updated.json";
import todoCompletedTpl from "@/lib/line/flex-templates/todo-completed.json";
import todoListSingleTpl from "@/lib/line/flex-templates/todo-list-single.json";

/**
 * Flex Message templates the agent picks via `send_flex_reply`.
 *
 * Designer ships JSON in src/lib/line/flex-templates/. Each template
 * uses {{key}} markers; we substitute at runtime. The list template
 * has 4 hardcoded item rows (items[0..3]); we substitute filled rows
 * + prune any unused rows (and their bracketing separators).
 *
 * Phase 1 ships single bubble only (≤4 items shown, footer points to
 * Dashboard for the rest). Carousel = future when item counts justify.
 */

export const FLEX_TEMPLATE_NAMES = [
  "todo_saved",
  "todo_deleted",
  "todo_updated",
  "todo_completed",
  "todo_list",
] as const;
export type FlexTemplateName = (typeof FLEX_TEMPLATE_NAMES)[number];

const SINGLE_TEMPLATES: Record<
  Exclude<FlexTemplateName, "todo_list">,
  FlexMessage
> = {
  todo_saved: todoSavedTpl as unknown as FlexMessage,
  todo_deleted: todoDeletedTpl as unknown as FlexMessage,
  todo_updated: todoUpdatedTpl as unknown as FlexMessage,
  todo_completed: todoCompletedTpl as unknown as FlexMessage,
};

/** Hardcoded slot count in todo-list-single.json — designer-defined. */
const LIST_SINGLE_SLOTS = 4;

export type TodoListItem = {
  /** 1-based position the user sees in chat. */
  idx: number;
  text: string;
  due_short?: string;
  urgency_color?: string;
};

export type FlexBuildVars = {
  todo_saved: {
    text: string;
    due_text?: string;
    folder_name?: string;
    open_url: string;
  };
  todo_deleted: {
    text: string;
    remaining_count: number;
    open_url: string;
    /** LINE postback data for the Undo button. */
    undo_postback_data?: string;
  };
  todo_updated: {
    text: string;
    old_value?: string;
    new_value?: string;
    change_summary: string;
    open_url: string;
  };
  todo_completed: {
    text: string;
    pending_count_left: number;
    streak_msg?: string;
    open_url: string;
    undo_postback_data?: string;
  };
  todo_list: {
    count: number;
    date_display: string;
    items: TodoListItem[];
    open_url: string;
  };
};

/**
 * Build a Flex Message from a template + caller-supplied vars. Throws
 * if any required placeholder remains unsubstituted (defensive).
 */
export function buildFlexMessage<K extends FlexTemplateName>(
  template: K,
  vars: FlexBuildVars[K],
  altText?: string,
): LineMessage {
  if (template === "todo_list") {
    return buildTodoList(vars as FlexBuildVars["todo_list"], altText);
  }
  const tpl = clone(
    SINGLE_TEMPLATES[template as Exclude<FlexTemplateName, "todo_list">],
  );
  // Empty-string defaults for optional fields keep substitution from
  // leaving stray markers when caller omits them.
  const filled = withDefaults(template, vars as Record<string, unknown>);
  applyVars(tpl, filled);
  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, template);
  return tpl;
}

function withDefaults(
  template: FlexTemplateName,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  // Defensive: if a caller bypasses the tool and feeds empty / null /
  // undefined for an optional text field, force a non-empty fallback so
  // LINE doesn't reject the bubble for an empty text node.
  const filled = { ...vars };
  const fillIfEmpty = (key: string, fallback: string) => {
    const v = filled[key];
    if (typeof v !== "string" || v.length === 0) filled[key] = fallback;
  };
  if (template === "todo_saved") {
    fillIfEmpty("due_text", "ไม่มีกำหนด");
    fillIfEmpty("folder_name", "Inbox");
  } else if (template === "todo_deleted") {
    fillIfEmpty("undo_postback_data", "action=noop");
  } else if (template === "todo_updated") {
    fillIfEmpty("old_value", "—");
    fillIfEmpty("new_value", "—");
  } else if (template === "todo_completed") {
    fillIfEmpty("streak_msg", "—");
    fillIfEmpty("undo_postback_data", "action=noop");
  }
  return filled;
}

function buildTodoList(
  vars: FlexBuildVars["todo_list"],
  altText?: string,
): LineMessage {
  const tpl = clone(todoListSingleTpl as unknown as FlexMessage);

  // Designer template has 4 hardcoded item rows. Take up to that many
  // items; prune the remaining (unused) rows + their bracketing
  // separators so the bubble doesn't show empty slots.
  const itemsShown = vars.items.slice(0, LIST_SINGLE_SLOTS);

  // Substitute used items[N].field markers.
  const flatVars: Record<string, unknown> = {
    count: vars.count,
    date_display: vars.date_display,
    open_url: vars.open_url,
  };
  for (let i = 0; i < itemsShown.length; i++) {
    const item = itemsShown[i];
    flatVars[`items[${i}].idx`] = String(item.idx);
    flatVars[`items[${i}].text`] = item.text;
    // Em-dash placeholder when no due — keeps the chip text non-empty
    // (LINE Flex rejects empty text nodes).
    flatVars[`items[${i}].due_short`] =
      item.due_short && item.due_short.length > 0 ? item.due_short : "—";
    flatVars[`items[${i}].urgency_color`] = item.urgency_color ?? "#a08050";
  }
  applyVars(tpl, flatVars);

  // Prune row boxes for unused slots: they still contain `{{items[N].*}}`
  // markers after substitution. Walk the tree and remove horizontal box
  // nodes that contain unsubstituted item markers, plus any separator
  // immediately before them so we don't leave double-separators.
  pruneEmptyItemRows(tpl);

  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, "todo_list");
  return tpl;
}

// ── helpers ─────────────────────────────────────────────────────────

const ITEM_MARKER_RE = /\{\{items\[\d+\]\.\w+\}\}/;

function pruneEmptyItemRows(node: unknown): void {
  if (Array.isArray(node)) {
    // Prune in-place: drop any box containing unsubstituted items[N].*
    // markers. Collapse the separator that immediately precedes a
    // pruned row so the layout doesn't get a hanging line.
    for (let i = node.length - 1; i >= 0; i--) {
      const child = node[i] as Record<string, unknown> | unknown;
      if (
        child &&
        typeof child === "object" &&
        (child as Record<string, unknown>).type === "box" &&
        boxHasUnsubstitutedItemMarker(child)
      ) {
        node.splice(i, 1);
        // Also drop the separator immediately above (now at index i-1).
        const prev = i - 1 >= 0 ? (node[i - 1] as Record<string, unknown> | undefined) : undefined;
        if (prev && prev.type === "separator") {
          node.splice(i - 1, 1);
        }
      } else {
        pruneEmptyItemRows(child);
      }
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      pruneEmptyItemRows(v);
    }
  }
}

function boxHasUnsubstitutedItemMarker(node: unknown): boolean {
  return ITEM_MARKER_RE.test(JSON.stringify(node));
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

// Match {{key}} where key may include alphanumerics, underscores,
// brackets, and dots — supports indexed fields like items[0].text.
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
