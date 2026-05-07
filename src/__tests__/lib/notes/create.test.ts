import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/admin");
vi.mock("@/lib/ai/note-extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/note-extract")>();
  return { ...actual, extractTitleBody: vi.fn() };
});

import { createNoteFromLine } from "@/lib/notes/create";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTitleBody } from "@/lib/ai/note-extract";

const mockedAdmin = vi.mocked(createAdminClient);
const mockedExtract = vi.mocked(extractTitleBody);

function makeQuery(profile: { id: string } | null, profErr: unknown = null) {
  const select = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: profErr });
  const insert = vi.fn().mockReturnThis();
  const insertSelect = vi.fn().mockReturnThis();
  const single = vi.fn().mockResolvedValue({ data: { id: "note-1" }, error: null });

  const profileQuery = { select, eq, maybeSingle };
  const noteQuery = { insert, select: insertSelect, single };

  const from = vi.fn((table: string) => {
    if (table === "lungnote_profiles") return profileQuery;
    if (table === "lungnote_notes") return noteQuery;
    throw new Error(`unexpected table ${table}`);
  });

  return { from, profileQuery, noteQuery };
}

beforeEach(() => {
  mockedAdmin.mockReset();
  mockedExtract.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("createNoteFromLine", () => {
  it("returns not_linked when profile lookup yields no row", async () => {
    const q = makeQuery(null);
    mockedAdmin.mockReturnValue({ from: q.from } as never);

    const out = await createNoteFromLine("U-noprofile", "ซื้อนม");

    expect(out).toEqual({ ok: false, reason: "not_linked" });
    expect(mockedExtract).not.toHaveBeenCalled();
  });

  it("returns db_error when profile query errors", async () => {
    const q = makeQuery(null, { message: "connection refused" });
    mockedAdmin.mockReturnValue({ from: q.from } as never);

    const out = await createNoteFromLine("U-fail", "ซื้อนม");

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("db_error");
      expect(out.error).toBe("connection refused");
    }
  });

  it("creates a note when profile exists and extract succeeds", async () => {
    const q = makeQuery({ id: "user-uuid-1" });
    mockedAdmin.mockReturnValue({ from: q.from } as never);
    mockedExtract.mockResolvedValue({ title: "ซื้อของ", body: "นม\nไข่" });

    const out = await createNoteFromLine("U-ok", "ซื้อของ\nนม\nไข่");

    expect(out).toEqual({ ok: true, noteId: "note-1", title: "ซื้อของ" });
    expect(q.noteQuery.insert).toHaveBeenCalledWith({
      user_id: "user-uuid-1",
      title: "ซื้อของ",
      body: "นม\nไข่",
    });
  });

  it("returns db_error when insert fails", async () => {
    const q = makeQuery({ id: "user-uuid-2" });
    q.noteQuery.single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "constraint violation" },
    });
    mockedAdmin.mockReturnValue({ from: q.from } as never);
    mockedExtract.mockResolvedValue({ title: "T", body: "B" });

    const out = await createNoteFromLine("U-2", "anything");

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe("db_error");
    }
  });
});
