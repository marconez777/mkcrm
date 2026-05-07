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
    lastX: number;
    lastT: number;
    velocity: number; // px/ms
    previousScrollBehavior?: string;
  } | null>(null);

  // unified rAF animator for wheel smoothing & inertia
  const anim = useRef<{
    rafId: number | null;
    target: number;
    current: number;
    velocity: number; // px/frame for inertia
    mode: "wheel" | "inertia" | null;
  }>({ rafId: null, target: 0, current: 0, velocity: 0, mode: null });

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

    const cancelAnim = () => {
      if (anim.current.rafId != null) {
        cancelAnimationFrame(anim.current.rafId);
        anim.current.rafId = null;
      }
      anim.current.mode = null;
      anim.current.velocity = 0;
    };

    const clamp = (v: number) => Math.max(0, Math.min(v, el.scrollWidth - el.clientWidth));

    const stepWheel = () => {
      const a = anim.current;
      const diff = a.target - a.current;
      if (Math.abs(diff) < 0.5) {
        a.current = a.target;
        el.scrollLeft = a.current;
        a.rafId = null;
        a.mode = null;
        return;
      }
      a.current += diff * 0.22;
      el.scrollLeft = a.current;
      a.rafId = requestAnimationFrame(stepWheel);
    };

    const stepInertia = () => {
      const a = anim.current;
      a.current = clamp(a.current + a.velocity);
      el.scrollLeft = a.current;
      a.velocity *= 0.94;
      if (Math.abs(a.velocity) < 0.05 || a.current === 0 || a.current === el.scrollWidth - el.clientWidth) {
        a.rafId = null;
        a.mode = null;
        return;
      }
      a.rafId = requestAnimationFrame(stepInertia);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const target = e.target as HTMLElement;
      const col = target.closest("[data-kanban-column-body]") as HTMLElement | null;
      if (col && col.scrollHeight > col.clientHeight) return;
      e.preventDefault();

      // any new wheel cancels inertia
      if (anim.current.mode === "inertia") cancelAnim();

      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      const delta = e.deltaY * factor;

      if (anim.current.mode !== "wheel") {
        anim.current.current = el.scrollLeft;
        anim.current.target = el.scrollLeft;
        anim.current.mode = "wheel";
      }
      anim.current.target = clamp(anim.current.target + delta);
      if (anim.current.rafId == null) {
        anim.current.rafId = requestAnimationFrame(stepWheel);
      }
    };

    const isBlockedTarget = (target: HTMLElement) => {
      return !!target.closest(
        "[data-kanban-card], button, a, input, textarea, select, option, label, summary, [role='button'], [role='menuitem'], [contenteditable='true']",
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as HTMLElement;
      if (isBlockedTarget(target)) return;

      // new drag cancels any running animation
      cancelAnim();

      dragState.current = {
        startX: e.clientX,
        startScroll: el.scrollLeft,
        pointerId: e.pointerId,
        active: true,
        moved: false,
        lastX: e.clientX,
        lastT: performance.now(),
        velocity: 0,
        previousScrollBehavior: el.style.scrollBehavior,
      };
      el.style.scrollBehavior = "auto";
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
      window.getSelection()?.removeAllRanges();
      el.scrollLeft = s.startScroll - dx;

      // velocity sample (px/ms); positive when content moves right (scrollLeft increases)
      const now = performance.now();
      const dt = now - s.lastT;
      if (dt > 0) {
        const instV = -(e.clientX - s.lastX) / dt; // matches scrollLeft delta direction
        // smooth
        s.velocity = s.velocity * 0.6 + instV * 0.4;
      }
      s.lastX = e.clientX;
      s.lastT = now;
    };

    const endDrag = (e: PointerEvent) => {
      const s = dragState.current;
      if (!s) return;
      if (s.pointerId !== e.pointerId) return;
      try { el.releasePointerCapture(s.pointerId); } catch {}
      el.style.scrollBehavior = s.previousScrollBehavior ?? "";
      const wasMoved = s.moved;
      const v = s.velocity; // px/ms
      dragState.current = null;
      el.classList.remove("kanban-grabbing");

      // Start inertia if velocity is meaningful (~ > 0.15 px/ms)
      if (wasMoved && Math.abs(v) > 0.15) {
        // convert px/ms -> px/frame (~16.67ms per frame)
        anim.current.current = el.scrollLeft;
        anim.current.velocity = v * 16.67;
        anim.current.mode = "inertia";
        if (anim.current.rafId == null) {
          anim.current.rafId = requestAnimationFrame(stepInertia);
        }
      }
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
      cancelAnim();
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
