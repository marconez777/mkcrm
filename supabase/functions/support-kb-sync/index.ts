// Re-ingests the support KB into support_documents. Super admin only.
// - Reads SUPPORT_KB_FILES (snapshot at deploy time)
// - Chunks each .md (~1000 chars, 150 overlap)
// - Embeds via OpenAI text-embedding-3-small (1536 dims) using stored API key
// - Upserts on (path, chunk_index); deletes stale rows

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SUPPORT_KB_FILES } from "../_shared/support-kb-manifest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= CHUNK_SIZE) return [clean];
  const paras = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > CHUNK_SIZE && buf) {
      chunks.push(buf);
      // overlap: keep tail of previous chunk
      const tail = buf.slice(-CHUNK_OVERLAP);
      buf = tail + "\n\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
    while (buf.length > CHUNK_SIZE * 1.5) {
      chunks.push(buf.slice(0, CHUNK_SIZE));
      buf = buf.slice(CHUNK_SIZE - CHUNK_OVERLAP);
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractTitle(md: string, fallback: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

async function embedBatch(apiKey: string, inputs: string[]): Promise<number[][]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs, dimensions: EMBED_DIMS }),
  });
  if (!r.ok) throw new Error(`OpenAI embeddings ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j.data.map((d: any) => d.embedding as number[]);
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: superRow } = await admin.from("user_roles")
      .select("role").eq("user_id", userData.user.id).eq("role", "super_admin").maybeSingle();
    if (!superRow) return json({ error: "Forbidden" }, 403);

    const { data: cfg } = await admin.from("support_agent_config")
      .select("api_key").eq("singleton", true).maybeSingle();
    const apiKey = cfg?.api_key;
    if (!apiKey) return json({ error: "Configure a API key OpenAI primeiro" }, 400);

    const paths = Object.keys(SUPPORT_KB_FILES);
    const stats = { files: 0, chunks: 0, skipped: 0, deleted: 0 };
    const seenPaths = new Set<string>();

    for (const path of paths) {
      const content = SUPPORT_KB_FILES[path];
      seenPaths.add(path);
      const fileHash = await sha256(content);

      // Skip if all existing chunks already have this file hash (stored in metadata.file_hash)
      const { data: existing } = await admin.from("support_documents")
        .select("chunk_index, hash, metadata").eq("path", path);
      const existingFileHash = existing?.[0]?.metadata?.file_hash;
      if (existing && existing.length > 0 && existingFileHash === fileHash) {
        stats.skipped++;
        continue;
      }

      const title = extractTitle(content, path);
      const chunks = chunkText(content);
      // embed in batches of 16
      const embeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += 16) {
        const batch = chunks.slice(i, i + 16);
        const emb = await embedBatch(apiKey, batch);
        embeddings.push(...emb);
      }

      // delete old chunks for this path, re-insert
      await admin.from("support_documents").delete().eq("path", path);
      const rows = chunks.map((c, idx) => ({
        path,
        title,
        chunk_index: idx,
        content: c,
        embedding: embeddings[idx] as any,
        hash: fileHash,
        metadata: { file_hash: fileHash, chars: c.length },
      }));
      // insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await admin.from("support_documents").insert(rows.slice(i, i + 50));
        if (error) throw new Error(`insert ${path}: ${error.message}`);
      }
      stats.files++;
      stats.chunks += chunks.length;
    }

    // Cleanup: remove docs for paths not in manifest
    const { data: allDocs } = await admin.from("support_documents").select("path");
    const stalePaths = Array.from(new Set((allDocs ?? []).map((r: any) => r.path))).filter((p) => !seenPaths.has(p));
    if (stalePaths.length > 0) {
      const { error } = await admin.from("support_documents").delete().in("path", stalePaths);
      if (!error) stats.deleted = stalePaths.length;
    }

    await admin.from("support_agent_config").update({ kb_synced_at: new Date().toISOString() }).eq("singleton", true);

    return json({ ok: true, ...stats, total_files_in_manifest: paths.length });
  } catch (e) {
    console.error("kb-sync error:", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
