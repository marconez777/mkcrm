#!/usr/bin/env node
/**
 * docs-sync.mjs
 *
 * Mantém a documentação em `docs/` saudável e indexada:
 *
 *  1. Garante que TODO `.md` em `docs/` tem frontmatter mínimo.
 *     - Inferimos `title` (H1), `topic` (do path), `kind` (do path),
 *       `audience`, `updated` (mtime) quando faltam.
 *     - Quem editou pode sobrescrever — só preenche o que está ausente.
 *
 *  2. Gera artefatos consumidos pelo agente e pela tela `/admin/docs`:
 *       - docs/INDEX.json                    (lista enxuta — fonte de busca)
 *       - public/docs-bundle.json            (índice + conteúdo, para o app)
 *       - docs/DRIFT.md                      (relatório legível)
 *
 *  3. Detecta drift:
 *       - `code_refs` apontando para path inexistente.
 *       - Rotas em `src/App.tsx` sem mapa em `docs/maps/`.
 *       - Edge functions em `supabase/functions/*` sem doc.
 *
 *  4. Reusa o gerador existente do support-kb manifest.
 *
 *  Uso: `node scripts/docs-sync.mjs`        (em CI ou local)
 *       `node scripts/docs-sync.mjs --check` (não escreve, só lint — exit 1 se drift fatal)
 */

import {
  readFileSync, writeFileSync, readdirSync, statSync, existsSync,
} from "node:fs";
import { join, relative, dirname } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const DOCS = join(ROOT, "docs");
const CHECK_ONLY = process.argv.includes("--check");

// --------------------------------------------------------------------------
// 1. Frontmatter helpers (YAML mínimo — sem dependência externa)
// --------------------------------------------------------------------------

const FM_RE = /^---\n([\s\S]*?)\n---\n?/;

function parseFrontmatter(src) {
  const m = src.match(FM_RE);
  if (!m) return { data: {}, body: src, raw: null };
  const data = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!mm) continue;
    const key = mm[1].trim();
    let val = mm[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else if (val.startsWith('"') || val.startsWith("'")) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  // suportar listas multiline simples (- item)
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^([a-z_]+):\s*$/i);
    if (!head) continue;
    const arr = [];
    let j = i + 1;
    while (j < lines.length && lines[j].match(/^\s+-\s+/)) {
      arr.push(lines[j].replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "").trim());
      j++;
    }
    if (arr.length) data[head[1]] = arr;
  }
  return { data, body: src.slice(m[0].length), raw: m[0] };
}

function stringifyFrontmatter(data) {
  const lines = ["---"];
  const order = ["title", "topic", "kind", "audience", "updated", "summary", "code_refs", "related_docs"];
  const keys = [...new Set([...order, ...Object.keys(data)])];
  for (const k of keys) {
    const v = data[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else if (typeof v === "string" && (v.includes(":") || v.includes("#"))) {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

// --------------------------------------------------------------------------
// 2. Inferência (topic / kind / title)
// --------------------------------------------------------------------------

const TOPIC_BY_PATH = [
  [/\/maps\/EMAIL|\/email\/|EMAIL|RESEND|UNSUBSCRIBE/i, "email"],
  [/\/maps\/AI|AI_RUNTIME|BUILDER_AGENTS|\/ai\/|AGENT|LOVABLE_AI/i, "ai"],
  [/\/maps\/INBOX|INBOUND_WHATSAPP|OUTBOUND_WHATSAPP|EVOLUTION|\/inbox\//i, "inbox"],
  [/\/maps\/KANBAN|LEAD_LIFECYCLE|\/kanban\//i, "kanban"],
  [/\/maps\/TRACKING|TRACKING|FORMS|\/tracking\//i, "tracking"],
  [/\/maps\/AUTH|AUTH|MULTI_TENANCY|user-roles/i, "auth"],
  [/\/maps\/ADMIN|SUPER_ADMIN|\/admin/i, "admin"],
  [/\/maps\/BILLING|PLANS_LIMITS|payment|billing/i, "billing"],
  [/\/maps\/AUTOMATIONS|SEQUENCES|BROADCAST|AUTOMATION/i, "automations"],
  [/\/integracao\//i, "integracao"],
  [/\/support\//i, "support"],
  [/\/operations\//i, "operations"],
  [/\/roadmap\//i, "roadmap"],
  [/\/conventions\//i, "conventions"],
  [/\/architecture\//i, "architecture"],
  [/\/database\//i, "database"],
  [/\/known-issues\//i, "known-issues"],
];

function inferTopic(path, content) {
  for (const [re, t] of TOPIC_BY_PATH) if (re.test(path) || re.test(content.slice(0, 400))) return t;
  return "general";
}

function inferKind(path) {
  if (path.includes("/maps/")) return "map";
  if (path.includes("/features/")) return "feature";
  if (path.includes("/flows/")) return "flow";
  if (path.includes("/support/pages/")) return "support";
  if (path.includes("/support/journeys/")) return "journey";
  if (path.includes("/support/troubleshooting/")) return "troubleshooting";
  if (path.includes("/support/")) return "support";
  if (path.includes("/edge-functions/")) return "reference";
  if (path.includes("/database/")) return "reference";
  if (path.includes("/architecture/")) return "reference";
  if (path.includes("/integrations/")) return "reference";
  if (path.includes("/integracao/")) return "reference";
  if (path.includes("/operations/")) return "reference";
  if (path.includes("/conventions/")) return "reference";
  if (path.includes("/known-issues/")) return "reference";
  if (path.includes("/roadmap/")) return "roadmap";
  if (path.includes("/site/")) return "reference";
  if (path.includes("/frontend/")) return "reference";
  return "doc";
}

function inferAudience(path) {
  if (path.includes("/support/") || path.includes("/integracao/")) return "user";
  return "agent";
}

function inferTitle(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  if (!m) return null;
  // remove emojis/leading icons
  return m[1].replace(/^[^\w(]+/, "").trim();
}

function inferSummary(body) {
  // primeiro parágrafo de texto que não seja heading / blockquote / lista
  const blocks = body.split(/\n\n+/);
  for (const b of blocks) {
    const trimmed = b.trim();
    if (!trimmed) continue;
    if (/^[#>\-*|`]/.test(trimmed)) continue;
    if (trimmed.startsWith("---")) continue;
    return trimmed.replace(/\s+/g, " ").slice(0, 240);
  }
  return "";
}

function extractHeadings(body) {
  const out = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) out.push(m[1].replace(/^[^\w(]+/, "").trim());
  }
  return out.slice(0, 12);
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

// --------------------------------------------------------------------------
// 3. Walk
// --------------------------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "INDEX.json" || name === "DRIFT.md" || name === "README.md") {
      // README incluímos sim; INDEX e DRIFT pulamos
      if (name === "README.md") {
        out.push(join(dir, name));
      }
      continue;
    }
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// --------------------------------------------------------------------------
// 4. Pipeline principal
// --------------------------------------------------------------------------

const files = walk(DOCS);
const index = [];
const drift = { stale_refs: [], missing_maps: [], routes_without_doc: [], edges_without_doc: [] };
let migrated = 0;

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, "/");
  const raw = readFileSync(abs, "utf8");
  const { data, body, raw: fmRaw } = parseFrontmatter(raw);

  // Inferências (só preenche o que está faltando)
  if (!data.title) data.title = inferTitle(body) ?? rel.split("/").pop().replace(".md", "");
  if (!data.topic) data.topic = inferTopic(rel, body);
  if (!data.kind) data.kind = inferKind(rel);
  if (!data.audience) data.audience = inferAudience(rel);
  if (!data.updated) data.updated = formatDate(statSync(abs).mtime);
  if (!data.summary) {
    const s = inferSummary(body);
    if (s) data.summary = s;
  }

  // Reescreve o arquivo se inserimos ou completamos frontmatter
  const newFm = stringifyFrontmatter(data);
  const newRaw = newFm + body;
  if (newRaw !== raw) {
    if (!CHECK_ONLY) writeFileSync(abs, newRaw);
    migrated++;
  }

  // Validar code_refs
  const codeRefs = Array.isArray(data.code_refs) ? data.code_refs : [];
  const staleRefs = codeRefs.filter(r => !existsSync(join(ROOT, r)));
  if (staleRefs.length) drift.stale_refs.push({ doc: rel, missing: staleRefs });

  index.push({
    path: rel,
    title: data.title,
    topic: data.topic,
    kind: data.kind,
    audience: data.audience,
    updated: data.updated,
    summary: data.summary ?? "",
    headings: extractHeadings(body),
    code_refs: codeRefs,
    related_docs: Array.isArray(data.related_docs) ? data.related_docs : [],
    size_lines: body.split("\n").length,
    stale_refs: staleRefs,
  });
}

// --------------------------------------------------------------------------
// 5. Drift: rotas e edge functions sem doc
// --------------------------------------------------------------------------

try {
  const appTsx = readFileSync(join(ROOT, "src/App.tsx"), "utf8");
  const routes = [...appTsx.matchAll(/path="([^"]+)"/g)].map(m => m[1]).filter(p => p !== "*" && !p.startsWith(":"));
  const allRefs = index.flatMap(d => d.code_refs).join("\n");
  for (const r of routes) {
    // heurística: o nome da rota aparece em algum code_ref OU em algum summary/headings
    const slug = r.split("/").filter(Boolean)[0];
    if (!slug) continue;
    const covered = index.some(d =>
      d.code_refs.some(cr => cr.includes(`/${slug}/`) || cr.endsWith(`/${slug}`)) ||
      d.title.toLowerCase().includes(slug)
    );
    if (!covered) drift.routes_without_doc.push(r);
  }
} catch {}

try {
  const edgeDir = join(ROOT, "supabase/functions");
  const fns = readdirSync(edgeDir).filter(n => {
    if (n.startsWith("_") || n.startsWith(".")) return false;
    try { return statSync(join(edgeDir, n)).isDirectory(); } catch { return false; }
  });
  for (const fn of fns) {
    const ref = `supabase/functions/${fn}/`;
    const covered = index.some(d => d.code_refs.some(cr => cr === ref || cr === ref.slice(0, -1) || cr.includes(`/${fn}/`)));
    if (!covered) drift.edges_without_doc.push(fn);
  }
} catch {}

// --------------------------------------------------------------------------
// 6. Escrever artefatos
// --------------------------------------------------------------------------

index.sort((a, b) => a.path.localeCompare(b.path));

if (!CHECK_ONLY) {
  writeFileSync(join(DOCS, "INDEX.json"), JSON.stringify(index, null, 2) + "\n");

  // bundle p/ o app (inclui conteúdo)
  const bundle = index.map(entry => ({
    ...entry,
    content: readFileSync(join(ROOT, entry.path), "utf8"),
  }));
  const publicDir = join(ROOT, "public");
  writeFileSync(join(publicDir, "docs-bundle.json"), JSON.stringify(bundle));

  // DRIFT.md
  const lines = [
    "# Drift report",
    "",
    `_Gerado por \`scripts/docs-sync.mjs\` em ${new Date().toISOString()}_`,
    "",
    `Total de docs: **${index.length}** · frontmatter atualizado neste run: **${migrated}**`,
    "",
    "## code_refs apontando para arquivo inexistente",
    drift.stale_refs.length
      ? drift.stale_refs.map(s => `- \`${s.doc}\` → ${s.missing.map(x => `\`${x}\``).join(", ")}`).join("\n")
      : "_(nenhum)_",
    "",
    "## Rotas em src/App.tsx sem mapa associado (heurística)",
    drift.routes_without_doc.length
      ? drift.routes_without_doc.map(r => `- \`${r}\``).join("\n")
      : "_(nenhuma)_",
    "",
    "## Edge functions sem code_ref em nenhum doc",
    drift.edges_without_doc.length
      ? drift.edges_without_doc.map(f => `- \`${f}\``).join("\n")
      : "_(nenhuma)_",
    "",
  ];
  writeFileSync(join(DOCS, "DRIFT.md"), lines.join("\n"));
}

// --------------------------------------------------------------------------
// 7. Rerun do support-kb manifest
// --------------------------------------------------------------------------

if (!CHECK_ONLY) {
  try {
    execSync("node scripts/gen-support-kb-manifest.mjs", { stdio: "inherit" });
  } catch (e) {
    console.warn("support-kb manifest falhou:", e.message);
  }
}

// --------------------------------------------------------------------------
// 8. Summary
// --------------------------------------------------------------------------

console.log(`docs-sync: ${index.length} arquivos · ${migrated} atualizados · ` +
  `${drift.stale_refs.length} code_refs quebrados · ` +
  `${drift.routes_without_doc.length} rotas sem doc · ` +
  `${drift.edges_without_doc.length} edge fns sem doc`);

if (CHECK_ONLY && drift.stale_refs.length) {
  console.error("FAIL: code_refs quebrados (rode sem --check para apenas reportar).");
  process.exit(1);
}
