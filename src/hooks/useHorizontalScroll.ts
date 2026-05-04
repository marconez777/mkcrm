import { useEffect, useRef, useState, useCallback } from "react";

export function useHorizontalScroll() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [scrollX, setScrollX] = useState(0);
  const [viewportW, setViewportW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const dragState = useRef<{
    startX: number;
    startScroll: number;
    pointerId: number;
    active: boolean;
    moved: boolean;
  } | null>(null);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setScrollX(el.scrollLeft);
    setViewportW(el.clientWidth);
    setContentW(el.scrollWidth);
    setOverflow({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();

    // wheel: convert vertical to horizontal when no shift, only if not over a scrollable child
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const target = e.target as HTMLElement;
      const col = target.closest("[data-kanban-column-body]") as HTMLElement | null;
      if (col && col.scrollHeight > col.clientHeight) {
        return;
      }
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    // drag-to-pan on empty board area — uses pointer capture so it wins over dnd-kit
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as HTMLElement;
      // ignore interactive children (cards, buttons, inputs, dnd handles)
      if (
        target.closest(
          "[data-kanban-card], button, a, input, textarea, select, [role='button'], [role='menuitem']",
        )
      ) {
        return;
      }
      dragState.current = {
        startX: e.clientX,
        startScroll: el.scrollLeft,
        pointerId: e.pointerId,
        active: true,
        moved: false,
      };
      try { el.setPointerCapture(e.pointerId); } catch {}
    };
    const onPointerMove = (e: PointerEvent) => {
      const s = dragState.current;
      if (!s?.active || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      if (!s.moved && Math.abs(dx) < 4) return;
      if (!s.moved) {
        s.moved = true;
        el.classList.add("kanban-grabbing");
      }
      e.preventDefault();
      el.scrollLeft = s.startScroll - dx;
    };
    const endDrag = (e: PointerEvent) => {
      const s = dragState.current;
      if (!s) return;
      if (s.pointerId !== e.pointerId) return;
      try { el.releasePointerCapture(s.pointerId); } catch {}
      dragState.current = null;
      el.classList.remove("kanban-grabbing");
    };

    const onScroll = () => update();
    const ro = new ResizeObserver(update);
    ro.observe(el);

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("lostpointercapture", endDrag);
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel as any);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("lostpointercapture", endDrag);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [update]);

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }, []);

  const scrollToEnd = useCallback((side: "start" | "end") => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: side === "start" ? 0 : el.scrollWidth, behavior: "smooth" });
  }, []);

  const scrollToColumn = useCallback((id: string) => {
    const el = ref.current;
    if (!el) return;
    const col = el.querySelector(`[data-column-id="${id}"]`) as HTMLElement | null;
    if (!col) return;
    el.scrollTo({ left: col.offsetLeft - 16, behavior: "smooth" });
  }, []);

  return { ref, overflow, scrollByPage, scrollToEnd, scrollToColumn, scrollX, viewportW, contentW };
}
