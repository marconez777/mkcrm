import { useEffect, useState } from "react";
import { motion, type MotionValue } from "framer-motion";

export const SPRING = { stiffness: 80, damping: 22, mass: 0.5 } as const;

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

type AuroraAnim = {
  x?: number[];
  y?: number[];
  scale?: number[];
};

export function AuroraBlob({
  className,
  background,
  parallaxY,
  animate,
  duration,
  reduce,
  isMobile,
}: {
  className: string;
  background: string;
  parallaxY?: MotionValue<number>;
  animate?: AuroraAnim;
  duration: number;
  reduce: boolean;
  isMobile: boolean;
}) {
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{
        background,
        y: reduce || !parallaxY ? 0 : parallaxY,
        willChange: "transform",
      }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background, willChange: "transform, opacity" }}
        animate={
          reduce
            ? undefined
            : isMobile
              ? { opacity: [0.55, 0.78, 0.55] }
              : animate
        }
        transition={{
          duration,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "mirror",
        }}
      />
    </motion.div>
  );
}
