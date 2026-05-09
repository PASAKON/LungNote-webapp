import "server-only";
import type { FlexMessage, LineMessage } from "@/lib/line/client";

import todoSavedTpl from "@/lib/line/flex-templates/todo-saved.json";
import todoDeletedTpl from "@/lib/line/flex-templates/todo-deleted.json";
import todoUpdatedTpl from "@/lib/line/flex-templates/todo-updated.json";
import todoCompletedTpl from "@/lib/line/flex-templates/todo-completed.json";
import todoListShellTpl from "@/lib/line/flex-templates/todo-list-shell.json";
import todoListRowTpl from "@/lib/line/flex-templates/todo-list-row.json";

/**
 * Flex Message templates the agent can pick via `send_flex_reply`.
 *
 * Designer ships JSON in src/lib/line/flex-templates/. Each template
 * uses {{placeholder}} markers; substituteText() does the rewriting at
 * runtime. URLs are resolved against the user's LIFF link via
 * rewriteUriActions(). The list template is special — it uses
 * shell+row pieces to build a variable-length items array.
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

export type TodoListItem = {
  /** 1-based position the user sees in chat. */
  idx: number;
  /** Item text. */
  text: string;
  /** Short due-date phrase, e.g. "พรุ่งนี้" / "อีก 3 วัน" / "เลย 2 วัน" / "". */
  due_short?: string;
  /** Hex color for the due chip. Defaults to muted. */
  urgency_color?: string;
  /** Optional second line, e.g. folder / category. */
  subline?: string;
};

export type FlexBuildVars = {
  todo_saved: {
    text: string;
    due_at_pretty?: string;
    folder_name?: string;
    open_url: string;
  };
  todo_deleted: {
    text: string;
    remaining_count: number;
    open_url: string;
  };
  todo_updated: {
    text: string;
    change_summary: string;
    open_url: string;
  };
  todo_completed: {
    text: string;
    pending_count_left: number;
    open_url: string;
  };
  todo_list: {
    count: number;
    date_pretty: string;
    items: TodoListItem[];
    open_url: string;
  };
};

/**
 * Build a Flex Message from a template + caller-supplied vars.
 * Throws if any required placeholder remains unsubstituted (defensive
 * against missing template variables).
 */
export function buildFlexMessage<K extends FlexTemplateName>(
  template: K,
  vars: FlexBuildVars[K],
  altText?: string,
): LineMessage {
  if (template === "todo_list") {
    return buildTodoList(vars as FlexBuildVars["todo_list"], altText);
  }
  const tpl = clone(SINGLE_TEMPLATES[template as Exclude<FlexTemplateName, "todo_list">]);
  applyVars(tpl, vars as Record<string, unknown>);
  if (altText) tpl.altText = altText;
  assertNoUnsubstituted(tpl, template);
  return tpl;
}

function buildTodoList(
  vars: FlexBuildVars["todo_list"],
  altText?: string,
): LineMessage {
  const shell = clone(todoListShellTpl as unknown as FlexMessage);
  const rowTemplate = todoListRowTpl as unknown as Record<string, unknown>;

  // Build per-item rows by cloning the row template + substituting.
  const rows: unknown[] = [];
  for (const item of vars.items) {
    if (rows.length > 0) {
      rows.push({ type: "separator", color: "#d4c4a0" });
    }
    const row = clone(rowTemplate);
    applyVars(row, {
      idx: String(item.idx),
      text: item.text,
      due_short: item.due_short ?? "",
      urgency_color: item.urgency_color ?? "#a08050",
      subline: item.subline ?? "",
    });
    rows.push(row);
  }

  // Splice rows into the body.contents array where the "{{ROWS}}" sentinel sits.
  const body = (shell.contents as Record<string, unknown>).body as
    | { contents: unknown[] }
    | undefined;
  if (body && Array.isArray(body.contents)) {
    body.contents = body.contents.flatMap((node) =>
      typeof node === "string" && node === "{{ROWS}}" ? rows : [node],
    );
  }

  // Fill shell-level vars (count, date_pretty, open_url) on the cloned tree.
  applyVars(shell, {
    count: String(vars.count),
    date_pretty: vars.date_pretty,
    open_url: vars.open_url,
  });
  if (altText) shell.altText = altText;
  assertNoUnsubstituted(shell, "todo_list");
  return shell;
}

// ── helpers ─────────────────────────────────────────────────────────

function applyVars(node: unknown, vars: Record<string, unknown>): void {
  // String→string substitution for {{key}} markers in any "text", "uri",
  // "color" (if templated), and altText fields.
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

function substituteString(s: string, vars: Record<string, unknown>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (m, key: string) => {
    if (!(key in vars)) return m; // leave unknown markers; assertNoUnsubstituted catches.
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

function assertNoUnsubstituted(node: unknown, template: string): void {
  // Walk + check no "{{...}}" remains. ROWS is consumed at splice time.
  const json = JSON.stringify(node);
  const leftover = json.match(/\{\{(\w+)\}\}/g);
  if (leftover && leftover.length > 0) {
    throw new Error(
      `flex template ${template} has unsubstituted markers: ${leftover.join(", ")}`,
    );
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
