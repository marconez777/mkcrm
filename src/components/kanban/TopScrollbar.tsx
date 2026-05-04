import { useEffect, useRef, type RefObject } from "react";

interface Props {
  targetRef: RefObject<HTMLElement>;
  contentW: number;
  viewportW: number;
}

/**
 * A thin horizontal scrollbar rendered ABOVE the kanban board, mirrored to the
 * real scroll container below. Useful so the user doesn't have to drag down to
 * the bottom scrollbar to navigate wide pipelines.
 */
export default function TopScrollbar({ targetRef, contentW, viewportW }: Props) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const syncing = useRef(false);

  useEffect(() => {
    const top = topRef.current;
    const main = targetRef.current;
    if (!top || !main) return;

    const onTop = () => {
      if (syncing.current) return;
      syncing.current = true;
      main.scrollLeft = top.scrollLeft;
      requestAnimationFrame(() => { syncing.current = false; });
    };
    const onMain = () => {
      if (syncing.current) return;
      syncing.current = true;
      top.scrollLeft = main.scrollLeft;
      requestAnimationFrame(() => { syncing.current = false; });
    };

    top.addEventListener("scroll", onTop, { passive: true });
    main.addEventListener("scroll", onMain, { passive: true });
    // initial sync
    top.scrollLeft = main.scrollLeft;

    return () => {
      top.removeEventListener("scroll", onTop);
      main.removeEventListener("scroll", onMain);
    };
  }, [targetRef, contentW, viewportW]);

  if (contentW <= viewportW) return null;

  return (
    <div ref={topRef} className="kanban-top-scroll" aria-hidden>
      <div style={{ width: contentW, height: 1 }} />
    </div>
  );
}
