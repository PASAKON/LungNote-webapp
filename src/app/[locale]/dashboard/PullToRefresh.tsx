"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

const PULL_THRESHOLD = 70; // px the user must drag past before release triggers refresh
const PULL_RESISTANCE = 0.45; // dampen the drag so it feels rubber-bandy
const PULL_MAX = 120; // visual cap on the indicator
const REFRESH_LATCH_MS = 700; // keep the spinner up briefly after router.refresh() so the user sees it

/**
 * Mobile pull-to-refresh wrapper.
 *
 * Wraps the dynamic body region of a dashboard page. When the user is scrolled
 * to the top and drags down past PULL_THRESHOLD, releasing triggers
 * router.refresh() and shows a small shimmer bar under the Topbar.
 *
 * Listens on window scroll position so it only activates at the top — pulling
 * mid-scroll never engages. Desktop wheel scrolling is unaffected; touch only.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0); // current drag distance (0..PULL_MAX)
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging.current || startY.current === null) return;
      // Re-anchor if the user scrolled away mid-gesture.
      if (window.scrollY > 0) {
        startY.current = null;
        dragging.current = false;
        setPull(0);
        return;
      }
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      setPull(Math.min(PULL_MAX, delta * PULL_RESISTANCE));
    },
    [],
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return;
    const trigger = pull >= PULL_THRESHOLD;
    dragging.current = false;
    startY.current = null;

    if (trigger && !refreshing) {
      setRefreshing(true);
      router.refresh();
      window.setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, REFRESH_LATCH_MS);
    } else {
      setPull(0);
    }
  }, [pull, refreshing, router]);

  // Cancel an in-flight drag if the page is hidden (e.g. user backgrounded the tab).
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        dragging.current = false;
        startY.current = null;
        setPull(0);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Indicator height: while refreshing it stays at a fixed thin bar; while
  // pulling it grows with the drag.
  const indicatorHeight = refreshing ? 3 : Math.min(3, pull / 24);
  const indicatorOpacity =
    refreshing ? 1 : pull > 8 ? Math.min(1, pull / PULL_THRESHOLD) : 0;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        // Slight visual offset while pulling so the user gets feedback on the
        // body too, not just the indicator. Caps small to avoid layout shift.
        transform: pull > 0 && !refreshing ? `translateY(${Math.min(pull / 4, 16)}px)` : undefined,
        transition: refreshing || pull === 0 ? "transform 0.18s ease" : undefined,
      }}
    >
      <div
        className={`ptr-indicator${refreshing ? " refreshing" : ""}${pull >= PULL_THRESHOLD && !refreshing ? " ready" : ""}`}
        aria-hidden={!refreshing && pull === 0}
        style={{
          height: refreshing ? 3 : Math.max(0, indicatorHeight),
          opacity: indicatorOpacity,
        }}
      >
        <div className="ptr-shimmer" />
      </div>
      {children}
    </div>
  );
}
