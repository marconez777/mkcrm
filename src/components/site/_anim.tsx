import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

// Mantido por compatibilidade — não é mais usado nas seções.
export const SPRING = { stiffness: 80, damping: 22, mass: 0.5 } as const;
export const EASE = [0.22, 1, 0.36, 1] as const;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export const viewportOnce = { once: true, margin: "-10% 0px" } as const;

/**
 * Variants para entrada once-only (fade + translateY).
 * Usar com `initial="hidden" whileInView="show" viewport={viewportOnce}`.
 */
export const fadeUp = (delay = 0, y = 24): Variants => ({
  hidden: { opacity: 0, y },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE, delay },
  },
});

/** Atalho para cascata em listas. */
export const cascade = (i: number, step = 0.08, y = 32) => fadeUp(i * step, y);

/**
 * Aurora estática com respiração de opacidade (sem parallax, sem scale/x/y).
 * - `blur-2xl` em vez de `blur-3xl` (filtro GPU muito mais barato).
 * - Loop de opacidade apenas; pausa quando `prefers-reduced-motion`.
 * - Sem `will-change: transform` (não há transform animado).
 */
export function AuroraBlob({
  className,
  background,
  duration = 22,
  opacity = 0.6,
}: {
  className: string;
  background: string;
  duration?: number;
  opacity?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-2xl ${className}`}
      style={{ background, willChange: "opacity" }}
      initial={{ opacity }}
      animate={
        reduce
          ? { opacity }
          : { opacity: [opacity * 0.75, opacity, opacity * 0.75] }
      }
      transition={
        reduce
          ? undefined
          : {
              duration,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "mirror",
            }
      }
    />
  );
}
