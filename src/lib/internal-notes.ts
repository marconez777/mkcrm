// Notas internas por lead persistidas em localStorage.
// Substituível depois por uma coluna messages.is_internal sem mudar a UI.

export type InternalNote = {
  id: string;
  text: string;
  created_at: string; // ISO
  author?: string | null;
};

const KEY_PREFIX = "internal-notes:";

function read(leadId: string): InternalNote[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + leadId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(leadId: string, notes: InternalNote[]) {
  try {
    localStorage.setItem(KEY_PREFIX + leadId, JSON.stringify(notes));
    window.dispatchEvent(new CustomEvent("internal-notes-changed", { detail: { leadId } }));
  } catch {}
}

export function getNotes(leadId: string): InternalNote[] {
  return read(leadId);
}

export function addNote(leadId: string, text: string, author?: string | null): InternalNote {
  const note: InternalNote = {
    id: (crypto as any).randomUUID?.() ?? `n-${Date.now()}`,
    text,
    created_at: new Date().toISOString(),
    author: author ?? null,
  };
  const next = [...read(leadId), note];
  write(leadId, next);
  return note;
}

export function removeNote(leadId: string, noteId: string) {
  const next = read(leadId).filter((n) => n.id !== noteId);
  write(leadId, next);
}

/** Subscribe to changes for a specific lead. Returns unsubscribe fn. */
export function subscribeNotes(leadId: string, cb: () => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { leadId: string } | undefined;
    if (!detail || detail.leadId === leadId) cb();
  };
  window.addEventListener("internal-notes-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("internal-notes-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
