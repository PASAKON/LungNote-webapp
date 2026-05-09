import { vi } from "vitest";

/**
 * In-memory Supabase mock for the agent QA harness.
 *
 * Wraps just the surface area the agent + its tools touch:
 *   - lungnote_profiles (auth)
 *   - lungnote_todos (memory CRUD)
 *   - lungnote_notes (Inbox lazy-create)
 *   - lungnote_conversation_memory (rolling 5+5)
 *   - lungnote_chat_traces (observability sink)
 *   - lungnote_auth_link_tokens (mint URL)
 *
 * The goal: fast, deterministic scenarios where only the LLM behavior is
 * the variable under test. We don't model RLS — service-role only.
 */

export type MockTodo = {
  id: string;
  user_id: string;
  note_id: string;
  text: string;
  done: boolean;
  position: number;
  due_at: string | null;
  due_text: string | null;
  source: "chat" | "web" | "liff";
  created_at: string;
  updated_at: string;
};

export type MockProfile = {
  id: string; // auth.users.id (uuid)
  line_user_id: string;
  line_display_name: string | null;
  line_picture_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MockState = {
  profiles: MockProfile[];
  todos: MockTodo[];
  notes: { id: string; user_id: string; title: string; body: string }[];
  conversationMemory: Map<string, unknown[]>;
  traces: Record<string, unknown>[];
  links: Record<string, unknown>[];
};

export function createMockState(initial?: Partial<MockState>): MockState {
  return {
    profiles: initial?.profiles ?? [],
    todos: initial?.todos ?? [],
    notes: initial?.notes ?? [],
    conversationMemory: initial?.conversationMemory ?? new Map(),
    traces: initial?.traces ?? [],
    links: initial?.links ?? [],
  };
}

let _state: MockState = createMockState();
export function setMockState(state: MockState): void {
  _state = state;
}
export function getMockState(): MockState {
  return _state;
}

function uid(): string {
  // Deterministic-ish UUID for test traces — random enough for uniqueness
  return crypto.randomUUID();
}

/**
 * Fluent query builder that mimics enough of supabase-js to satisfy our
 * code paths. NOT a complete impl — just what tools/list/save/mutate use.
 */
function buildClient() {
  const fromTable = (table: string) => {
    const rows: Record<string, unknown>[] = collectionFor(table);
    let pendingInsert: Record<string, unknown> | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    let pendingDelete = false;
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let orderField: string | null = null;
    let orderAsc = false;
    let rangeFrom = 0;
    let rangeTo = -1;
    let limitN: number | null = null;
    let selectFields: string | null = null;
    let countMode: "exact" | null = null;
    let headOnly = false;
    let returningSingle = false;
    let returningMaybeSingle = false;

    const exec = async () => {
      let result = rows;

      if (pendingInsert) {
        const inserted = applyDefaults(table, pendingInsert);
        addRow(table, inserted);
        if (selectFields || returningSingle || returningMaybeSingle) {
          return wrap(returningSingle || returningMaybeSingle ? inserted : [inserted]);
        }
        return wrap(null);
      }

      // Apply filters
      for (const f of filters) {
        result = result.filter(f);
      }

      if (pendingDelete) {
        for (const r of result) removeRow(table, r);
        if (selectFields) return wrap(result);
        return wrap(null);
      }

      if (pendingUpdate) {
        for (const r of result) {
          Object.assign(r, pendingUpdate, { updated_at: new Date().toISOString() });
        }
        if (selectFields || returningSingle || returningMaybeSingle) {
          if (returningSingle || returningMaybeSingle) {
            return wrap(result[0] ?? null);
          }
          return wrap(result);
        }
        return wrap(null);
      }

      // SELECT
      if (orderField) {
        result = [...result].sort((a, b) => {
          const av = (a[orderField!] ?? "") as string | number;
          const bv = (b[orderField!] ?? "") as string | number;
          if (av < bv) return orderAsc ? -1 : 1;
          if (av > bv) return orderAsc ? 1 : -1;
          return 0;
        });
      }

      if (rangeTo >= 0) {
        result = result.slice(rangeFrom, rangeTo + 1);
      } else if (limitN) {
        result = result.slice(0, limitN);
      }

      if (countMode === "exact" && headOnly) {
        return { data: null, error: null, count: result.length };
      }

      if (returningSingle) return wrap(result[0] ?? null);
      if (returningMaybeSingle) return wrap(result[0] ?? null);
      return wrap(result);
    };

    const builder = {
      select(fields?: string, opts?: { count?: "exact"; head?: boolean }) {
        selectFields = fields ?? "*";
        if (opts?.count === "exact") countMode = "exact";
        if (opts?.head) headOnly = true;
        return builder;
      },
      insert(row: Record<string, unknown>) {
        pendingInsert = row;
        return builder;
      },
      update(row: Record<string, unknown>) {
        pendingUpdate = row;
        return builder;
      },
      delete() {
        pendingDelete = true;
        return builder;
      },
      upsert(row: Record<string, unknown>, opts?: { onConflict?: string }) {
        const key = opts?.onConflict ?? "id";
        const existing = collectionFor(table).find(
          (r) => r[key] === (row as Record<string, unknown>)[key],
        );
        if (existing) {
          Object.assign(existing, row);
        } else {
          addRow(table, applyDefaults(table, row));
        }
        return builder;
      },
      eq(field: string, value: unknown) {
        filters.push((r) => r[field] === value);
        return builder;
      },
      not(field: string, op: string, value: unknown) {
        filters.push((r) => {
          if (op === "is" && value === null) return r[field] !== null;
          return true;
        });
        return builder;
      },
      is(field: string, value: unknown) {
        filters.push((r) => r[field] === value);
        return builder;
      },
      ilike(field: string, pattern: string) {
        const p = pattern.replace(/%/g, "").toLowerCase();
        filters.push((r) =>
          String(r[field] ?? "").toLowerCase().includes(p),
        );
        return builder;
      },
      gte(field: string, value: unknown) {
        filters.push((r) => (r[field] ?? "") >= (value as string | number));
        return builder;
      },
      order(field: string, opts?: { ascending?: boolean }) {
        orderField = field;
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      range(from: number, to: number) {
        rangeFrom = from;
        rangeTo = to;
        return builder;
      },
      limit(n: number) {
        limitN = n;
        return builder;
      },
      single: () => {
        returningSingle = true;
        return exec();
      },
      maybeSingle: () => {
        returningMaybeSingle = true;
        return exec();
      },
      then: (
        onFulfilled?: (
          value: { data: unknown; error: null; count?: number },
        ) => unknown,
      ) => exec().then(onFulfilled),
    };
    return builder;
  };
  return {
    from: fromTable,
    auth: {
      admin: {
        createUser: vi.fn(async ({ email }: { email: string }) => ({
          data: { user: { id: uid(), email } },
          error: null,
        })),
        generateLink: vi.fn(async () => ({
          data: { properties: { email_otp: "123456", hashed_token: "h" } },
          error: null,
        })),
      },
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  };
}

function wrap<T>(data: T) {
  return { data, error: null, count: undefined };
}

function collectionFor(table: string): Record<string, unknown>[] {
  switch (table) {
    case "lungnote_profiles":
      return _state.profiles as unknown as Record<string, unknown>[];
    case "lungnote_todos":
      return _state.todos as unknown as Record<string, unknown>[];
    case "lungnote_notes":
      return _state.notes as unknown as Record<string, unknown>[];
    case "lungnote_chat_traces":
      return _state.traces;
    case "lungnote_auth_link_tokens":
      return _state.links;
    case "lungnote_conversation_memory":
      // map → array fake
      return Array.from(_state.conversationMemory.entries()).map(
        ([line_user_id, messages]) => ({ line_user_id, messages }),
      );
    default:
      return [];
  }
}

function addRow(table: string, row: Record<string, unknown>): void {
  switch (table) {
    case "lungnote_profiles":
      _state.profiles.push(row as unknown as MockProfile);
      break;
    case "lungnote_todos":
      _state.todos.push(row as unknown as MockTodo);
      break;
    case "lungnote_notes":
      _state.notes.push(
        row as unknown as { id: string; user_id: string; title: string; body: string },
      );
      break;
    case "lungnote_chat_traces":
      _state.traces.push(row);
      break;
    case "lungnote_auth_link_tokens":
      _state.links.push(row);
      break;
    case "lungnote_conversation_memory": {
      const r = row as { line_user_id: string; messages: unknown[] };
      _state.conversationMemory.set(r.line_user_id, r.messages ?? []);
      break;
    }
  }
}

function removeRow(table: string, row: Record<string, unknown>): void {
  switch (table) {
    case "lungnote_todos":
      _state.todos = _state.todos.filter((r) => r.id !== row.id);
      break;
    case "lungnote_chat_traces":
      _state.traces = _state.traces.filter((r) => r.id !== row.id);
      break;
  }
}

function applyDefaults(
  table: string,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const now = new Date().toISOString();
  if (table === "lungnote_todos") {
    return {
      id: row.id ?? uid(),
      done: false,
      position: 0,
      due_at: null,
      due_text: null,
      source: "chat",
      created_at: now,
      updated_at: now,
      ...row,
    };
  }
  if (table === "lungnote_notes") {
    return { id: row.id ?? uid(), body: "", ...row };
  }
  if (table === "lungnote_profiles") {
    return { id: row.id ?? uid(), created_at: now, updated_at: now, ...row };
  }
  return { id: row.id ?? uid(), created_at: now, ...row };
}

export const mockSupabaseClient = buildClient;
