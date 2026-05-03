// Per-lead drafts kept in localStorage (no backend round-trip).
const KEY = "inbox-drafts-v1";

function read(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function write(map: Record<string, string>) {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {}
}

export function getDraft(leadId: string): string {
  return read()[leadId] || "";
}

export function setDraft(leadId: string, text: string) {
  const map = read();
  if (text) map[leadId] = text;
  else delete map[leadId];
  write(map);
}
