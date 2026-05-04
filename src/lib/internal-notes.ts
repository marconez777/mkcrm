// Internal notes per lead — persisted in Supabase (lead_internal_notes table).
// Sync getNotes() returns the in-memory cache; subscribeNotes() subscribes to
// realtime DB changes and triggers an initial fetch.
import { supabase } from "@/integrations/supabase/client";

export type InternalNote = {
  id: string;
  text: string;
  created_at: string; // ISO
  author?: string | null;
};

const cache = new Map<string, InternalNote[]>();
const listeners = new Map<string, Set<() => void>>();
const channels = new Map<string, ReturnType<typeof supabase.channel>>();
const fetched = new Set<string>();

function notify(leadId: string) {
  listeners.get(leadId)?.forEach((cb) => cb());
}

function rowToNote(r: any): InternalNote {
  return {
    id: r.id,
    text: r.text,
    created_at: r.created_at,
    author: r.author_name ?? null,
  };
}

async function fetchInitial(leadId: string) {
  if (fetched.has(leadId)) return;
  fetched.add(leadId);
  const { data } = await supabase
    .from("lead_internal_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  cache.set(leadId, ((data ?? []) as any[]).map(rowToNote));
  notify(leadId);
}

function ensureChannel(leadId: string) {
  if (channels.has(leadId)) return;
  const ch = supabase
    .channel(`notes-${leadId}-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lead_internal_notes", filter: `lead_id=eq.${leadId}` },
      (p) => {
        const cur = cache.get(leadId) ?? [];
        if (p.eventType === "INSERT") {
          const n = rowToNote(p.new);
          if (cur.some((x) => x.id === n.id)) return;
          cache.set(leadId, [...cur, n].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        } else if (p.eventType === "DELETE") {
          cache.set(leadId, cur.filter((x) => x.id !== (p.old as any).id));
        } else if (p.eventType === "UPDATE") {
          const n = rowToNote(p.new);
          cache.set(leadId, cur.map((x) => (x.id === n.id ? n : x)));
        }
        notify(leadId);
      },
    )
    .subscribe();
  channels.set(leadId, ch);
}

export function getNotes(leadId: string): InternalNote[] {
  return cache.get(leadId) ?? [];
}

export async function addNote(leadId: string, text: string, author?: string | null): Promise<void> {
  const { data, error } = await supabase
    .from("lead_internal_notes")
    .insert({ lead_id: leadId, text, author_name: author ?? null })
    .select("*")
    .single();
  if (error) throw error;
  // Optimistic local insert (realtime will dedupe)
  const cur = cache.get(leadId) ?? [];
  if (data && !cur.some((n) => n.id === (data as any).id)) {
    cache.set(leadId, [...cur, rowToNote(data)].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    notify(leadId);
  }
}

export async function removeNote(leadId: string, noteId: string): Promise<void> {
  // Optimistic
  const cur = cache.get(leadId) ?? [];
  cache.set(leadId, cur.filter((n) => n.id !== noteId));
  notify(leadId);
  await supabase.from("lead_internal_notes").delete().eq("id", noteId);
}

/** Subscribe to changes for a specific lead. Returns unsubscribe fn. */
export function subscribeNotes(leadId: string, cb: () => void): () => void {
  let set = listeners.get(leadId);
  if (!set) {
    set = new Set();
    listeners.set(leadId, set);
  }
  set.add(cb);
  ensureChannel(leadId);
  fetchInitial(leadId);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) {
      listeners.delete(leadId);
      const ch = channels.get(leadId);
      if (ch) {
        supabase.removeChannel(ch);
        channels.delete(leadId);
      }
      fetched.delete(leadId);
    }
  };
}
