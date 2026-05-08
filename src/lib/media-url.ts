import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "chat-attachments";
const TTL_SECONDS = 60 * 60; // 1h
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh if <5min left

type CacheEntry = { url: string; exp: number; promise?: Promise<string | null> };
const cache = new Map<string, CacheEntry>();

/** Extract storage path from a public or signed URL pointing to chat-attachments. */
export function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  // public: /storage/v1/object/public/chat-attachments/<path>
  // signed: /storage/v1/object/sign/chat-attachments/<path>?token=...
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/chat-attachments\/([^?]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

async function signPath(path: string): Promise<string | null> {
  const cached = cache.get(path);
  const now = Date.now();
  if (cached && cached.exp - now > REFRESH_BEFORE_MS) return cached.url;
  if (cached?.promise) return cached.promise;

  const promise = (async () => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS);
    if (error || !data?.signedUrl) {
      cache.delete(path);
      return null;
    }
    cache.set(path, { url: data.signedUrl, exp: now + TTL_SECONDS * 1000 });
    return data.signedUrl;
  })();

  cache.set(path, { url: cached?.url ?? "", exp: cached?.exp ?? 0, promise });
  return promise;
}

/**
 * Returns a fresh signed URL for chat-attachments media.
 * If `url` is not in the chat-attachments bucket, returns it as-is.
 */
export function useSignedMediaUrl(url: string | null | undefined): { url: string | null; loading: boolean } {
  const path = extractStoragePath(url);
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!path) return url ?? null;
    const c = cache.get(path);
    return c && c.exp - Date.now() > REFRESH_BEFORE_MS ? c.url : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!path) return false;
    const c = cache.get(path);
    return !(c && c.exp - Date.now() > REFRESH_BEFORE_MS);
  });

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setResolved(url ?? null);
      setLoading(false);
      return;
    }
    const c = cache.get(path);
    if (c && c.exp - Date.now() > REFRESH_BEFORE_MS) {
      setResolved(c.url);
      setLoading(false);
      return;
    }
    setLoading(true);
    signPath(path).then((u) => {
      if (cancelled) return;
      setResolved(u);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [path, url]);

  return { url: resolved, loading };
}
