import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/crm";

const PAGE_SIZE = 50;

/**
 * Paginated leads hook ordered by last_message_at desc, with cursor pagination
 * and incremental realtime updates. Suitable for the Inbox conversation list.
 *
 * - loadMore() appends the next page (older) using a cursor on last_message_at.
 * - INSERT/UPDATE patch in place; new leads always go to the top.
 * - DELETE removes from the loaded set.
 */
export function useLeadsPaginated() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null); // last_message_at of last loaded item

  const sortFn = (a: Lead, b: Lead) => {
    const ap = a.pinned_at ? 1 : 0;
    const bp = b.pinned_at ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");
  };

  const loadInitial = useCallback(async () => {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(PAGE_SIZE);
    const arr = (data ?? []) as Lead[];
    setLeads(arr.slice().sort(sortFn));
    cursorRef.current = arr[arr.length - 1]?.last_message_at ?? null;
    setHasMore(arr.length === PAGE_SIZE);
    setLoaded(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    let q = supabase
      .from("leads")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(PAGE_SIZE);
    if (cursorRef.current) q = q.lt("last_message_at", cursorRef.current);
    else q = q.is("last_message_at", null); // tail (no-message leads)
    const { data } = await q;
    const arr = (data ?? []) as Lead[];
    if (arr.length > 0) {
      setLeads((prev) => {
        const map = new Map(prev.map((l) => [l.id, l]));
        arr.forEach((l) => map.set(l.id, l));
        return Array.from(map.values()).sort(sortFn);
      });
      cursorRef.current = arr[arr.length - 1]?.last_message_at ?? cursorRef.current;
    }
    setHasMore(arr.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore]);

  useEffect(() => {
    let active = true;
    (async () => { if (active) await loadInitial(); })();

    const ch = supabase
      .channel(`leads-pg-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (p) => {
        const row = p.new as Lead;
        setLeads((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev].sort(sortFn)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (p) => {
        const row = p.new as Lead;
        setLeads((prev) => {
          const idx = prev.findIndex((x) => x.id === row.id);
          if (idx === -1) return prev; // outside loaded window
          const copy = prev.slice();
          copy[idx] = { ...prev[idx], ...row };
          return copy.sort(sortFn);
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads" }, (p) => {
        const old = p.old as Lead;
        setLeads((prev) => prev.filter((x) => x.id !== old.id));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, [loadInitial]);

  return { leads, setLeads, loaded, hasMore, loadingMore, loadMore };
}
