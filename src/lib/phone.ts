// Helpers de telefone Brasil
export function normalizePhoneBR(raw: string): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

export function formatPhoneDisplay(p: string | null | undefined): string {
  if (!p) return "";
  const d = String(p).replace(/\D/g, "");
  if (d.length >= 12) {
    const cc = d.slice(0, 2), area = d.slice(2, 4), n = d.slice(4);
    return `+${cc} (${area}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
  }
  return p;
}
