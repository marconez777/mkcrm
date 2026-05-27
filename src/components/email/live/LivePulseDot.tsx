export function LivePulseDot({ active = true }: { active?: boolean }) {
  if (!active) {
    return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />;
  }
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}
