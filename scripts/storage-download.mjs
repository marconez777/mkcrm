#!/usr/bin/env node
// Baixa todos os arquivos do storage do Lovable Cloud para uma pasta local.
//
// Por que existe: são 5.449 arquivos (~900 MB, quase tudo mídia de WhatsApp em
// chat-attachments) que hoje só existem dentro do Lovable Cloud. A tela de
// Storage baixa um por vez. Ver docs/roadmap/MIGRACAO_SUPABASE_PLANO.md §R0.
//
// Onde cada coisa fica — backup e token FORA do repositório, que sincroniza
// com o Lovable e com o GitHub:
//   <trabalho>/querys/migracao/M08-manifesto-storage.csv   entrada
//   <trabalho>/storage-backup/<bucket>/<caminho>           saída
//   <trabalho>/.env.storage                                credencial
// onde <trabalho> é o diretório que contém este repositório. Dá para
// sobrescrever com STORAGE_MANIFEST, STORAGE_OUT_DIR e STORAGE_ENV.
//
// Como usar:
//   1. Rodar querys/migracao/M08-manifesto-storage.sql e salvar o CSV
//   2. Pedir ao agente do Lovable para publicar a function `storage-export`
//      e criar o secret STORAGE_EXPORT_TOKEN (aleatório, 32+ chars)
//   3. Criar o .env.storage com:
//        SUPABASE_URL=https://<ref>.supabase.co
//        STORAGE_EXPORT_TOKEN=<o mesmo valor do secret>
//   4. node scripts/storage-download.mjs
//
// É retomável: arquivo já baixado com o tamanho certo é pulado. Pode
// interromper com Ctrl+C e rodar de novo.

import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const REPO = path.resolve(import.meta.dirname, "..");
const WORK = path.resolve(REPO, "..");

const firstExisting = (candidatos, padrao) =>
  candidatos.find((c) => fs.existsSync(c)) ?? padrao;

const MANIFEST = process.env.STORAGE_MANIFEST ?? firstExisting(
  [path.join(WORK, "querys", "migracao", "M08-manifesto-storage.csv"),
   path.join(REPO, "querys", "migracao", "M08-manifesto-storage.csv")],
  path.join(WORK, "querys", "migracao", "M08-manifesto-storage.csv"),
);
const OUT_DIR = process.env.STORAGE_OUT_DIR ?? path.join(WORK, "storage-backup");
const ENV_FILE = process.env.STORAGE_ENV ?? firstExisting(
  [path.join(WORK, ".env.storage"), path.join(REPO, ".env.storage")],
  path.join(WORK, ".env.storage"),
);

const BATCH = 100;        // teto da function
const CONCURRENCY = 6;    // downloads simultâneos
const RETRIES = 3;

// ── env ────────────────────────────────────────────────────────────────────
function loadEnv() {
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const url = process.env.SUPABASE_URL;
  const token = process.env.STORAGE_EXPORT_TOKEN;
  if (!url || !token) {
    console.error(`Faltam SUPABASE_URL e/ou STORAGE_EXPORT_TOKEN.\nCrie ${ENV_FILE} — veja o cabeçalho deste arquivo.`);
    process.exit(1);
  }
  return { url: url.replace(/\/+$/, ""), token };
}

// ── CSV: campos entre aspas, aspas duplicadas, quebra de linha dentro do campo ──
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

function readManifest() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`Manifesto não encontrado: ${MANIFEST}\nRode querys/migracao/M08-manifesto-storage.sql e salve o CSV aí.`);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(MANIFEST, "utf8"));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const iB = header.indexOf("bucket");
  const iP = header.indexOf("caminho");
  const iT = header.indexOf("tamanho");
  if (iB < 0 || iP < 0) {
    console.error(`Cabeçalho inesperado: ${header.join(" | ")}\nEsperado: bucket ; caminho ; tamanho`);
    process.exit(1);
  }
  return rows.slice(1)
    .map((r) => ({ bucket: r[iB], name: r[iP], size: Number(r[iT] ?? 0) || 0 }))
    .filter((f) => f.bucket && f.name);
}

// ── rede ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signBatch(env, bucket, paths) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(`${env.url}/functions/v1/storage-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-export-token": env.token },
        body: JSON.stringify({ bucket, paths, expiresIn: 3600 }),
      });
      if (res.status === 404) {
        throw new Error("404 — function não publicada, ou STORAGE_EXPORT_TOKEN diferente do secret");
      }
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).urls ?? [];
    } catch (e) {
      lastErr = e;
      if (attempt < RETRIES) await sleep(1000 * attempt);
    }
  }
  throw lastErr;
}

async function download(url, dest, expectedSize) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
      const got = fs.statSync(tmp).size;
      if (expectedSize > 0 && got !== expectedSize) {
        throw new Error(`tamanho divergente: esperado ${expectedSize}, veio ${got}`);
      }
      fs.renameSync(tmp, dest);
      return got;
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch {}
      if (attempt === RETRIES) throw e;
      await sleep(1000 * attempt);
    }
  }
}

// Caminhos do storage são POSIX e podem trazer o que o Windows recusa.
function safeDest(bucket, name) {
  const parts = name.split("/").map((p) => p.replace(/[<>:"\\|?*\x00-\x1f]/g, "_"));
  return path.join(OUT_DIR, bucket, ...parts);
}

// ── principal ──────────────────────────────────────────────────────────────
const env = loadEnv();
const files = readManifest();
const totalBytes = files.reduce((a, f) => a + f.size, 0);
const porBucket = files.reduce((a, f) => ((a[f.bucket] = (a[f.bucket] ?? 0) + 1), a), {});

console.log(`Manifesto: ${files.length} arquivos, ${(totalBytes / 1048576).toFixed(0)} MB`);
for (const [b, n] of Object.entries(porBucket)) console.log(`  ${b}: ${n}`);
console.log(`Destino: ${OUT_DIR}\n`);

let ok = 0, pulados = 0, bytes = 0;
const falhas = [];

for (const bucket of [...new Set(files.map((f) => f.bucket))]) {
  const doBucket = files.filter((f) => f.bucket === bucket);

  const pendentes = doBucket.filter((f) => {
    const dest = safeDest(f.bucket, f.name);
    if (fs.existsSync(dest) && (f.size === 0 || fs.statSync(dest).size === f.size)) {
      pulados++;
      return false;
    }
    return true;
  });

  console.log(`\n[${bucket}] ${pendentes.length} a baixar (${doBucket.length - pendentes.length} já estavam)`);

  for (let i = 0; i < pendentes.length; i += BATCH) {
    const lote = pendentes.slice(i, i + BATCH);
    let assinados;
    try {
      assinados = await signBatch(env, bucket, lote.map((f) => f.name));
    } catch (e) {
      console.error(`\n  ! falha ao assinar lote ${i}-${i + lote.length}: ${e.message}`);
      lote.forEach((f) => falhas.push({ ...f, erro: `assinatura: ${e.message}` }));
      continue;
    }

    const porPath = new Map(assinados.map((u) => [u.path, u]));
    const fila = [...lote];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (fila.length) {
        const f = fila.shift();
        const u = porPath.get(f.name);
        if (!u?.signedUrl) {
          falhas.push({ ...f, erro: u?.error ?? "sem URL assinada" });
          continue;
        }
        try {
          bytes += await download(u.signedUrl, safeDest(f.bucket, f.name), f.size);
          ok++;
        } catch (e) {
          falhas.push({ ...f, erro: e.message });
        }
      }
    }));
    process.stdout.write(`\r  ${ok} baixados · ${falhas.length} falhas · ${(bytes / 1048576).toFixed(0)} MB`);
  }
}

console.log(`\n\n── resumo ──`);
console.log(`baixados agora : ${ok}`);
console.log(`já existiam    : ${pulados}`);
console.log(`falhas         : ${falhas.length}`);
console.log(`total conferido: ${ok + pulados} de ${files.length}`);

if (falhas.length) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const log = path.join(OUT_DIR, "_falhas.json");
  fs.writeFileSync(log, JSON.stringify(falhas, null, 2));
  console.log(`\nDetalhe das falhas em ${log}. Rodar de novo tenta só o que faltou.`);
  process.exit(1);
}
console.log(`\nCompleto. Confira contra o M04 §4 antes de considerar fechado.`);
