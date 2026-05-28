import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressRadialProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100. If undefined, renders an indeterminate spinning arc. */
  value?: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  indicatorClassName?: string;
  children?: React.ReactNode;
}

/**
 * Circular progress indicator. Uses semantic tokens (text-primary / text-muted)
 * so it follows the active theme. If `value` is omitted, animates indeterminately.
 */
export function ProgressRadial({
  value,
  size = 120,
  strokeWidth = 8,
  trackClassName,
  indicatorClassName,
  children,
  className,
  ...props
}: ProgressRadialProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const indeterminate = value === undefined || value === null;
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn(indeterminate && "animate-spin [animation-duration:1.4s]")}
        style={{ transform: indeterminate ? undefined : "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className={cn("text-muted", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={indeterminate ? circumference * 0.75 : offset}
          className={cn(
            "text-primary",
            !indeterminate && "transition-[stroke-dashoffset] duration-300 ease-out",
            indicatorClassName,
          )}
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
