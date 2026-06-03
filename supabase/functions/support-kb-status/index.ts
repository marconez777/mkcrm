// Diff manifest (.md files bundled with the function) vs support_documents in DB.
// Returns counts and lists of stale / missing / deleted paths.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SUPPORT_KB_FILES } from "../_shared/support-kb-manifest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await userClient.rpc("is_super_admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Build manifest hashes (whole-file hash; matches how sync stores per chunk only,
    // so we compare whole-file hash stored on first chunk metadata if available;
    // fallback: any chunk hash that doesn't match means stale).
    const manifestMap = new Map<string, string>();
    for (const path of Object.keys(SUPPORT_KB_FILES)) {
      manifestMap.set(path, await sha256(SUPPORT_KB_FILES[path]));
    }

    const { data: docs } = await admin
      .from("support_documents")
      .select("path, hash, metadata, chunk_index");

    // Group DB docs by path, capture file-level hash if metadata has it, else use the
    // concatenation of chunk hashes for a stable signature.
    const dbByPath = new Map<string, { file_hash: string; chunks: number }>();
    const grouped = new Map<string, { hashes: string[]; fileHash?: string }>();
    for (const d of (docs ?? []) as any[]) {
      const g = grouped.get(d.path) ?? { hashes: [], fileHash: undefined };
      g.hashes.push(d.hash);
      if (d.metadata?.file_hash) g.fileHash = d.metadata.file_hash;
      grouped.set(d.path, g);
    }
    for (const [path, g] of grouped) {
      const file_hash = g.fileHash ?? (await sha256(g.hashes.sort().join("|")));
      dbByPath.set(path, { file_hash, chunks: g.hashes.length });
    }

    const manifestPaths = new Set(manifestMap.keys());
    const dbPaths = new Set(dbByPath.keys());

    const missing: string[] = []; // in manifest, not in DB
    const stale: string[] = [];   // in both, hash differs
    const inSync: string[] = [];

    for (const [path, h] of manifestMap) {
      if (!dbByPath.has(path)) { missing.push(path); continue; }
      const db = dbByPath.get(path)!;
      // Try file_hash first; fallback to comparing hash from any chunk (the sync stores per-chunk hash, so a content change definitely changes at least one chunk hash and consequently file_hash via grouping).
      if (db.file_hash === h) inSync.push(path);
      else stale.push(path);
    }
    const deleted: string[] = [];
    for (const p of dbPaths) if (!manifestPaths.has(p)) deleted.push(p);

    const needsSync = stale.length + missing.length + deleted.length;
    const statusByPath: Record<string, "in_sync" | "stale" | "missing" | "deleted"> = {};
    for (const p of inSync) statusByPath[p] = "in_sync";
    for (const p of stale) statusByPath[p] = "stale";
    for (const p of missing) statusByPath[p] = "missing";
    for (const p of deleted) statusByPath[p] = "deleted";

    return json({
      ok: true,
      manifest_files: manifestPaths.size,
      db_files: dbPaths.size,
      in_sync_count: inSync.length,
      stale,
      missing,
      deleted,
      needs_sync: needsSync,
      status_by_path: statusByPath,
    });
  } catch (e) {
    console.error("support-kb-status error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
