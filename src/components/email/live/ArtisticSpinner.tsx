/**
 * Spinner "derretente" — gradient mesh animado via background-position.
 * 100% CSS / GPU compositor, zero JS por frame, zero dependência nova.
 */
export function ArtisticSpinner({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
      style={{
        width: size,
        height: size,
        backgroundImage:
          "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary-glow, var(--primary))), hsl(var(--accent)))",
        backgroundSize: "300% 300%",
        animation: "artisticMesh 3s ease-in-out infinite",
        filter: "blur(0.2px) saturate(1.15)",
      }}
    />
  );
}
