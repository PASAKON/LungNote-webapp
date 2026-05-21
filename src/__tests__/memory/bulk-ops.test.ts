import { describe, it, expect, vi, beforeEach } from "vitest";

// --- inline mock of createAdminClient ---
const mockBulkOpsRows: Record<string, unknown>[] = [];
const mockProfiles: Record<string, unknown>[] = [
  { id: "user-uuid-1", line_user_id: "U123" },
];

function buildMockClient() {
  const fromTable = (table: string) => {
    const getRows = (): Record<string, unknown>[] => {
      if (table === "lungnote_profiles") return mockProfiles;
      if (table === "lungnote_bulk_ops") return mockBulkOpsRows;
      return [];
    };

    let pendingInsert: Record<string, unknown> | null = null;
    let pendingDelete = false;
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let orderAsc = true;
    let limitN: number | null = null;
    let selectMode: "all" | "single" | "maybe" = "all";
    let gteFilter: { field: string; value: string } | null = null;

    const exec = async () => {
      const rows = getRows();

      if (pendingInsert) {
        const row = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...pendingInsert,
        };
        mockBulkOpsRows.push(row);
        if (selectMode !== "all") return { data: row, error: null };
        return { data: null, error: null };
      }

      let result = rows.filter((r) => filters.every((f) => f(r)));

      if (gteFilter) {
        result = result.filter(
          (r) => (r[gteFilter!.field] as string) >= gteFilter!.value,
        );
      }

      if (pendingDelete) {
        const ids = new Set(result.map((r) => r.id));
        for (let i = getRows().length - 1; i >= 0; i--) {
          if (ids.has(getRows()[i].id)) getRows().splice(i, 1);
        }
        return { data: result, error: null };
      }

      result = [...result].sort((a, b) => {
        const av = (a.created_at as string) ?? "";
        const bv = (b.created_at as string) ?? "";
        return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });

      if (limitN !== null) result = result.slice(0, limitN);

      if (selectMode === "single" || selectMode === "maybe") {
        return { data: result[0] ?? null, error: null };
      }
      return { data: result, error: null };
    };

    const builder = {
      select: (_f?: string) => builder,
      insert: (row: Record<string, unknown>) => {
        pendingInsert = row;
        return builder;
      },
      delete: () => {
        pendingDelete = true;
        return builder;
      },
      eq: (f: string, v: unknown) => {
        filters.push((r) => r[f] === v);
        return builder;
      },
      gte: (f: string, v: unknown) => {
        gteFilter = { field: f, value: v as string };
        return builder;
      },
      order: (_f: string, opts?: { ascending?: boolean }) => {
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      limit: (n: number) => {
        limitN = n;
        return builder;
      },
      single: () => {
        selectMode = "single";
        return exec();
      },
      maybeSingle: () => {
        selectMode = "maybe";
        return exec();
      },
      then: (fn?: (v: unknown) => unknown) => exec().then(fn),
    };
    return builder;
  };
  return { from: fromTable };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => buildMockClient(),
}));

const { recordBulkOp, getLastBulkOp, clearLastBulkOp } = await import(
  "@/lib/memory/bulk_ops"
);

describe("recordBulkOp", () => {
  beforeEach(() => {
    mockBulkOpsRows.length = 0;
  });

  it("inserts a row and returns ok:true with an id", async () => {
    const result = await recordBulkOp("U123", "complete", ["todo-1", "todo-2"]);
    expect(result.ok).toBe(true);
    expect(result.id).toBeTruthy();
    expect(mockBulkOpsRows).toHaveLength(1);
    const row = mockBulkOpsRows[0];
    expect(row.op_kind).toBe("complete");
    expect(row.todo_ids).toEqual(["todo-1", "todo-2"]);
    expect(row.user_id).toBe("user-uuid-1");
  });

  it("returns ok:false for unlinked user", async () => {
    const result = await recordBulkOp("UNKNOWN_USER", "complete", ["x"]);
    expect(result.ok).toBe(false);
    expect(mockBulkOpsRows).toHaveLength(0);
  });
});

describe("getLastBulkOp", () => {
  beforeEach(() => {
    mockBulkOpsRows.length = 0;
  });

  it("returns null when no rows exist", async () => {
    const result = await getLastBulkOp("U123");
    expect(result).toBeNull();
  });

  it("returns the most recent row within 10 min", async () => {
    const recentTs = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    mockBulkOpsRows.push({
      id: "op-1",
      user_id: "user-uuid-1",
      op_kind: "complete",
      todo_ids: ["a", "b"],
      created_at: recentTs,
    });
    const result = await getLastBulkOp("U123");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("op-1");
    expect(result?.op_kind).toBe("complete");
    expect(result?.todo_ids).toEqual(["a", "b"]);
  });

  it("returns null for rows older than 10 min", async () => {
    const oldTs = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    mockBulkOpsRows.push({
      id: "op-old",
      user_id: "user-uuid-1",
      op_kind: "delete",
      todo_ids: ["c"],
      created_at: oldTs,
    });
    const result = await getLastBulkOp("U123");
    expect(result).toBeNull();
  });

  it("returns null for unknown user", async () => {
    mockBulkOpsRows.push({
      id: "op-x",
      user_id: "user-uuid-1",
      op_kind: "complete",
      todo_ids: ["d"],
      created_at: new Date().toISOString(),
    });
    const result = await getLastBulkOp("UNKNOWN");
    expect(result).toBeNull();
  });
});

describe("clearLastBulkOp", () => {
  beforeEach(() => {
    mockBulkOpsRows.length = 0;
  });

  it("deletes the specified op row", async () => {
    mockBulkOpsRows.push({
      id: "op-to-clear",
      user_id: "user-uuid-1",
      op_kind: "uncomplete",
      todo_ids: ["d"],
      created_at: new Date().toISOString(),
    });
    expect(mockBulkOpsRows).toHaveLength(1);
    await clearLastBulkOp("U123", "op-to-clear");
    expect(mockBulkOpsRows).toHaveLength(0);
  });

  it("does not delete rows belonging to different user", async () => {
    mockBulkOpsRows.push({
      id: "op-safe",
      user_id: "user-uuid-1",
      op_kind: "complete",
      todo_ids: ["e"],
      created_at: new Date().toISOString(),
    });
    await clearLastBulkOp("UNKNOWN", "op-safe");
    expect(mockBulkOpsRows).toHaveLength(1);
  });
});
