import { describe, it, expect } from "vitest";
import {
  countNotesPerTag,
  withCounts,
  groupTagsByNote,
  noteIdsForTag,
  type NoteTag,
} from "@/lib/notes/tags";

const claude: NoteTag = { id: "t-claude", name: "Claude", color: "#cdac65" };
const idea: NoteTag = { id: "t-idea", name: "ไอเดีย", color: "#6aab8e" };
const tagsById = new Map<string, NoteTag>([
  [claude.id, claude],
  [idea.id, idea],
]);

const pairs = [
  { note_id: "n1", tag_id: "t-claude" },
  { note_id: "n2", tag_id: "t-claude" },
  { note_id: "n2", tag_id: "t-idea" },
];

describe("countNotesPerTag", () => {
  it("counts one note per junction row", () => {
    const counts = countNotesPerTag(pairs);
    expect(counts.get("t-claude")).toBe(2);
    expect(counts.get("t-idea")).toBe(1);
  });

  it("returns an empty map for no pairs", () => {
    expect(countNotesPerTag([]).size).toBe(0);
  });
});

describe("withCounts", () => {
  it("attaches counts and preserves tag order", () => {
    const result = withCounts([claude, idea], pairs);
    expect(result).toEqual([
      { ...claude, count: 2 },
      { ...idea, count: 1 },
    ]);
  });

  it("gives 0 to a tag with no linked notes", () => {
    const orphan: NoteTag = { id: "t-x", name: "ว่าง", color: "#000000" };
    expect(withCounts([orphan], pairs)[0].count).toBe(0);
  });
});

describe("groupTagsByNote", () => {
  it("maps each note id to its tags", () => {
    const byNote = groupTagsByNote(pairs, tagsById);
    expect(byNote.get("n1")).toEqual([claude]);
    // order is name-sorted (collation-dependent); assert membership only
    expect(byNote.get("n2")?.map((t) => t.id).sort()).toEqual([
      "t-claude",
      "t-idea",
    ]);
  });

  it("drops links whose tag is unknown (e.g. RLS-filtered)", () => {
    const orphanPair = [{ note_id: "n9", tag_id: "missing" }];
    expect(groupTagsByNote(orphanPair, tagsById).has("n9")).toBe(false);
  });

  it("sorts a note's tags by name (Thai-aware)", () => {
    const byNote = groupTagsByNote(
      [
        { note_id: "n2", tag_id: "t-idea" },
        { note_id: "n2", tag_id: "t-claude" },
      ],
      tagsById,
    );
    const names = byNote.get("n2")?.map((t) => t.name) ?? [];
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "th")));
  });
});

describe("noteIdsForTag", () => {
  it("returns note ids carrying the given tag", () => {
    expect(noteIdsForTag(pairs, "t-claude")).toEqual(["n1", "n2"]);
    expect(noteIdsForTag(pairs, "t-idea")).toEqual(["n2"]);
  });

  it("returns [] for an unknown tag", () => {
    expect(noteIdsForTag(pairs, "nope")).toEqual([]);
  });
});
