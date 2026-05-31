import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/types/crm";

const PAGE_SIZE = 50;

/**
 * Paginated leads hook ordered by last_message_at desc, with cursor pagination
 * and incremental realtime updates. Optionally scoped to a single WhatsApp instance.
 */
export function useLeadsPaginated(instanceId?: string | null) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const lastVisibleAtRef = useRef<number>(Date.now());
  const instanceIdRef = useRef<string | null | undefined>(instanceId);
  instanceIdRef.current = instanceId;

  const sortFn = (a: Lead, b: Lead) => {
    const ap = a.pinned_at ? 1 : 0;
    const bp = b.pinned_at ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "");
  };

  const matchesInstance = (row: Lead) => {
    const cur = instanceIdRef.current;
    if (!cur) return true;
    return row.whatsapp_instance_id === cur;
  };

  const loadInitial = useCallback(async () => {
    let q = supabase
      .from("leads")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(PAGE_SIZE);
    if (instanceId) q = q.eq("whatsapp_instance_id", instanceId);
    const { data } = await q;
    const arr = (data ?? []) as Lead[];
    setLeads(arr.slice().sort(sortFn));
    cursorRef.current = arr[arr.length - 1]?.last_message_at ?? null;
    setHasMore(arr.length === PAGE_SIZE);
    setLoaded(true);
  }, [instanceId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadInitial(); } finally { setRefreshing(false); }
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    let q = supabase
      .from("leads")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(PAGE_SIZE);
    if (instanceId) q = q.eq("whatsapp_instance_id", instanceId);
    if (cursorRef.current) q = q.lt("last_message_at", cursorRef.current);
    else q = q.is("last_message_at", null);
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
  }, [loadingMore, hasMore, instanceId]);

  // Reset state when the instance filter changes
  useEffect(() => {
    setLeads([]);
    setLoaded(false);
    setHasMore(true);
    cursorRef.current = null;
  }, [instanceId]);

  useEffect(() => {
    let active = true;
    (async () => { if (active) await loadInitial(); })();

    const ch = supabase
      .channel(`leads-pg-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (p) => {
        const row = p.new as Lead;
        if (!matchesInstance(row)) return;
        setLeads((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev].sort(sortFn)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (p) => {
        const row = p.new as Lead;
        setLeads((prev) => {
          const idx = prev.findIndex((x) => x.id === row.id);
          if (idx !== -1) {
            if (!matchesInstance(row)) return prev.filter((x) => x.id !== row.id);
            const copy = prev.slice();
            copy[idx] = { ...prev[idx], ...row };
            return copy.sort(sortFn);
          }
          if (!matchesInstance(row)) return prev;
          const cur = cursorRef.current;
          const bubbledIn = row.pinned_at || !cur || (row.last_message_at && row.last_message_at > cur);
          if (bubbledIn) return [row, ...prev].sort(sortFn);
          return prev;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads" }, (p) => {
        const old = p.old as Lead;
        setLeads((prev) => prev.filter((x) => x.id !== old.id));
      })
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const away = Date.now() - lastVisibleAtRef.current;
        if (away > 2 * 60 * 1000) refresh();
        lastVisibleAtRef.current = Date.now();
      } else {
        lastVisibleAtRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadInitial, refresh]);

  return { leads, setLeads, loaded, hasMore, loadingMore, loadMore, refresh, refreshing };
}
