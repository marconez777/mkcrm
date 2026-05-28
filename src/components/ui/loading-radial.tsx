import * as React from "react";
import { cn } from "@/lib/utils";
import { ProgressRadial } from "./progress-radial";

interface LoadingRadialProps {
  /** 0-100. Omit for indeterminate animation. */
  value?: number;
  /** Main label below the percentage. Defaults to "Carregando". */
  label?: string;
  /** Smaller caption below the label (e.g. "Contatos"). */
  caption?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** Centered radial loader with "Carregando" label. */
export function LoadingRadial({
  value,
  label = "Carregando",
  caption,
  size = 120,
  strokeWidth = 8,
  className,
}: LoadingRadialProps) {
  const showPct = typeof value === "number";
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <ProgressRadial value={value} size={size} strokeWidth={strokeWidth}>
        <div className="flex flex-col items-center leading-tight">
          {showPct && (
            <span className="text-xl font-semibold text-foreground tabular-nums">
              {Math.round(value!)}%
            </span>
          )}
          <span className={cn("text-sm text-muted-foreground", showPct && "mt-0.5")}>
            {label}
          </span>
        </div>
      </ProgressRadial>
      {caption && (
        <span className="text-sm text-muted-foreground">{caption}</span>
      )}
    </div>
  );
}

/** Full-card overlay variant with backdrop blur. */
export function LoadingRadialOverlay(props: LoadingRadialProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-[inherit]">
      <LoadingRadial {...props} />
    </div>
  );
}
