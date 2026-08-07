#!/usr/bin/env node
// scripts/docs-verify.mjs
//
// Detecta drift entre o código do pipeline e os registries em
// docs/pipeline/runtime/_registry/.
//
// Existe porque três garantias de segurança falsas ("strict no-move", "tags
// sempre MERGE", "conflito humano 24h") sobreviveram meses na documentação sem
// que nada quebrasse. Um fato afirmado em prosa não falha o build; uma linha
// ausente de um registry, sim.
//
//   node scripts/docs-verify.mjs           # falha (exit 1) se houver drift
//   node scripts/docs-verify.mjs --warn    # sempre exit 0, só reporta
//
// Cada checagem é heurística sobre o texto-fonte, não análise semântica. Falso
// positivo se resolve adicionando a linha ao registry; se a checagem estiver
// errada, corrija-a aqui em vez de silenciar.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const REGISTRY = join(ROOT, "docs/pipeline/runtime/_registry");
const FUNCTIONS = join(ROOT, "supabase/functions");
const MIGRATIONS = join(ROOT, "supabase/migrations");
const DOCS = join(ROOT, "docs");
const WARN_ONLY = process.argv.includes("--warn");

const problems = [];
const fail = (check, msg, hint) => problems.push({ check, msg, hint });

// ---------- helpers ----------

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(entry)) out.push(full);
  }
  return out;
}

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

/** Fontes .ts das edge functions, exceto os monólitos legados e testes. */
function sourceFiles() {
  return walk(FUNCTIONS, (f) => f.endsWith(".ts"))
    .filter((f) => !f.includes("index.v1.ts") && !f.endsWith("_test.ts"));
}

const allSource = () => sourceFiles().map(read).join("\n");
const allMigrations = () => walk(MIGRATIONS, (f) => f.endsWith(".sql")).map(read).join("\n");

/** Extrai um bloco `export const NAME = [...]` ou `new Set([...])`. */
function extractStringList(src, name) {
  const re = new RegExp(`${name}[^=]*=\\s*(?:new Set<[^>]*>\\()?\\[([\\s\\S]*?)\\]`, "m");
  const m = src.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const registry = (name) => read(join(REGISTRY, name));

// ---------- checagens ----------

function checkRegistriesExist() {
  const required = ["README.md", "stages.md", "triggers.md", "toggles.md", "fields.md", "tags.md", "events.md"];
  for (const f of required) {
    if (!existsSync(join(REGISTRY, f))) {
      fail("registry", `_registry/${f} não existe`, "Crie a partir do contrato em _registry/README.md");
    }
  }
}

/** Todo canônico do TS precisa de linha em stages.md. */
function checkCanonicalStages() {
  const doc = registry("stages.md");
  if (!doc) return;
  const schema = read(join(FUNCTIONS, "pipeline-classify/schema.ts"));
  const det = read(join(FUNCTIONS, "pipeline-deterministic/index.ts"));

  const canon = new Set(extractStringList(schema, "CANON_NAMES"));
  // `type Canon = | "A" | "B"` do deterministic
  const detBlock = det.match(/type Canon\s*=([\s\S]*?);/);
  if (detBlock) for (const m of detBlock[1].matchAll(/"([^"]+)"/g)) canon.add(m[1]);

  for (const name of canon) {
    if (!doc.includes(`\`${name}\``) && !doc.includes(`| ${name} `)) {
      fail("stages", `canônico "${name}" não tem linha em _registry/stages.md`,
        "playbooks/add-stage.md passo 7");
    }
  }
}

/** Todo ruleKey precisa estar em toggles.md e seedado numa migration. */
function checkToggles() {
  const doc = registry("toggles.md");
  if (!doc) return;
  const src = allSource();
  const migrations = allMigrations();

  const keys = new Set([...src.matchAll(/ruleKey:\s*"([^"]+)"/g)].map((m) => m[1]));
  for (const key of keys) {
    if (!doc.includes(key)) {
      fail("toggles", `ruleKey "${key}" usado em código mas ausente de _registry/toggles.md`,
        "playbooks/add-trigger.md passo 7");
    }
    if (!migrations.includes(`'${key}'`)) {
      fail("toggles", `ruleKey "${key}" não é seedado em nenhuma migration — G3 é fail-closed, a regra nasce morta`,
        "playbooks/add-trigger.md passo 2");
    }
  }
}

/** Chaves de campo com tratamento especial precisam de linha em fields.md. */
function checkFields() {
  const doc = registry("fields.md");
  if (!doc) return;
  const schema = read(join(FUNCTIONS, "pipeline-classify/schema.ts"));
  const apply = read(join(FUNCTIONS, "pipeline-classify/apply.ts"));

  const keys = new Set([
    ...extractStringList(schema, "DATE_FIELD_KEYS"),
    ...extractStringList(apply, "STICKY_HUMAN_FIELDS"),
    ...extractStringList(apply, "AI_FORBIDDEN_FIELDS"),
  ]);
  for (const key of keys) {
    if (!doc.includes(`\`${key}\``)) {
      fail("fields", `campo "${key}" tem tratamento especial no código mas não está em _registry/fields.md`,
        "playbooks/add-custom-field.md passo 8");
    }
  }
}

/** Toda tag protegida precisa de linha em tags.md. */
function checkTags() {
  const doc = registry("tags.md");
  if (!doc) return;
  const schema = read(join(FUNCTIONS, "pipeline-classify/schema.ts"));
  for (const tag of extractStringList(schema, "PROTECTED_TAGS")) {
    if (!doc.includes(`\`${tag}\``)) {
      fail("tags", `tag protegida "${tag}" não está em _registry/tags.md`, "Adicione à tabela de protegidas");
    }
  }
}

/** Todo lead_events.type emitido precisa de linha em events.md. */
function checkEvents() {
  const doc = registry("events.md");
  if (!doc) return;
  const types = new Set();
  for (const file of sourceFiles()) {
    const src = read(file);
    // insert em lead_events com `type: "..."` por perto
    for (const m of src.matchAll(/from\("lead_events"\)[\s\S]{0,400}?type:\s*"([^"]+)"/g)) types.add(m[1]);
    for (const m of src.matchAll(/logEvent\([^)]*?,\s*"([^"]+)"/g)) types.add(m[1]);
  }
  for (const t of types) {
    if (!doc.includes(`\`${t}\``)) {
      fail("events", `lead_events.type "${t}" é emitido mas não está em _registry/events.md`,
        "playbooks/add-trigger.md passo 7");
    }
  }
}

/** code_refs do frontmatter precisam apontar para arquivos existentes. */
function checkCodeRefs() {
  for (const file of walk(DOCS, (f) => f.endsWith(".md"))) {
    const src = read(file);
    const fm = src.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const block = fm[1].match(/code_refs:\n((?:\s+-\s+.+\n?)+)/);
    if (!block) continue;
    for (const line of block[1].split("\n")) {
      const ref = line.replace(/^\s*-\s*/, "").trim();
      if (!ref) continue;
      const target = join(ROOT, ref);
      if (!existsSync(target)) {
        fail("code_refs", `${relative(ROOT, file)} → code_refs aponta para "${ref}", que não existe`,
          "Corrija ou remova a referência");
      }
    }
  }
}

/**
 * Caminhos de payload que docs antigos usavam e retornam vazio.
 *
 * Um doc que cite esses caminhos DE PROPÓSITO (para avisar que estão errados)
 * deve declarar `<!-- docs-verify:allow-stale-paths -->` no corpo. É opt-out
 * explícito: quem escreve assume que sabe o que está fazendo.
 */
function checkStalePayloadPaths() {
  const stale = [
    ["auto:maestro", "esse lead_events.type não existe — a telemetria vai em auto:classifier"],
    ["applied.custom_fields_rejected", "falta o nível intermediário: applied.custom_fields.rejected"],
    ["'applied'->'custom_fields_rejected'", "use ->'custom_fields'->'rejected'"],
  ];
  for (const file of walk(DOCS, (f) => f.endsWith(".md"))) {
    const src = read(file);
    if (src.includes("docs-verify:allow-stale-paths")) continue;
    for (const [needle, why] of stale) {
      if (src.includes(needle)) {
        fail("payload", `${relative(ROOT, file)} usa "${needle}" — ${why}`, "_registry/events.md tem os caminhos corretos");
      }
    }
  }
}

// ---------- execução ----------

checkRegistriesExist();
checkCanonicalStages();
checkToggles();
checkFields();
checkTags();
checkEvents();
checkCodeRefs();
checkStalePayloadPaths();

if (problems.length === 0) {
  console.log("✅ docs-verify: registries em dia com o código.");
  process.exit(0);
}

const byCheck = problems.reduce((acc, p) => ((acc[p.check] ??= []).push(p), acc), {});
console.log(`\n${WARN_ONLY ? "⚠️" : "❌"} docs-verify: ${problems.length} divergência(s)\n`);
for (const [check, items] of Object.entries(byCheck)) {
  console.log(`  [${check}]`);
  for (const p of items) {
    console.log(`    • ${p.msg}`);
    if (p.hint) console.log(`      → ${p.hint}`);
  }
  console.log("");
}
process.exit(WARN_ONLY ? 0 : 1);
