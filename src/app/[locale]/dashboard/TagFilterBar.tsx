import Link from "next/link";
import type { CSSProperties } from "react";
import type { TagWithCount } from "@/lib/notes/tags";

type Props = {
  tags: TagWithCount[];
  /** Currently active tag id from `?tag=`, or undefined for "all". */
  activeTag?: string;
  /** Route the chips link to (locale is handled by middleware). */
  basePath: string;
};

/**
 * Gmail-labels-style horizontal filter bar. Each chip is a plain server-side
 * `<Link>` toggling `?tag=<id>`, so the filter survives refresh with zero
 * client JS. Renders nothing until the user has at least one tag.
 */
export function TagFilterBar({ tags, activeTag, basePath }: Props) {
  if (tags.length === 0) return null;
  const allActive = !activeTag;

  return (
    <nav className="tag-filter-bar" aria-label="กรองตามแท็ก">
      <Link
        href={basePath}
        className={`tag-filter-chip${allActive ? " active" : ""}`}
        aria-current={allActive ? "true" : undefined}
      >
        ทั้งหมด
      </Link>

      {tags.map((tag) => {
        const isActive = tag.id === activeTag;
        return (
          <Link
            key={tag.id}
            href={`${basePath}?tag=${encodeURIComponent(tag.id)}`}
            className={`tag-filter-chip${isActive ? " active" : ""}`}
            style={{ "--tag-color": tag.color } as CSSProperties}
            aria-current={isActive ? "true" : undefined}
          >
            <span className="tag-chip-dot" aria-hidden="true" />
            <span className="tag-filter-name">{tag.name}</span>
            <span className="tag-filter-count">{tag.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
