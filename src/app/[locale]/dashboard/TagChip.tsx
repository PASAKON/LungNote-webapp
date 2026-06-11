import type { CSSProperties } from "react";
import type { NoteTag } from "@/lib/notes/tags";

/**
 * Gmail-label-style tag pill: soft tag-color background + a solid colored dot,
 * with the label text tinted toward the foreground for contrast in both themes.
 * Purely presentational — safe to render inside a Server Component.
 */
export function TagChip({ tag }: { tag: NoteTag }) {
  return (
    <span
      className="tag-chip"
      style={{ "--tag-color": tag.color } as CSSProperties}
      title={tag.name}
    >
      <span className="tag-chip-dot" aria-hidden="true" />
      <span className="tag-chip-name">{tag.name}</span>
    </span>
  );
}

/** Wrapping row of chips under a note row / heading. Renders nothing when empty. */
export function TagChips({ tags }: { tags: NoteTag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="note-tags">
      {tags.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
    </div>
  );
}
