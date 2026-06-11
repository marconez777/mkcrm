// Helper compartilhado pelos smoke tests dos ticks.
// Carrega .env, faz OPTIONS (CORS) e POST autenticado e valida a resposta.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

export function tickUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

export async function corsSmoke(name: string) {
  const r = await fetch(tickUrl(name), { method: "OPTIONS" });
  await r.text();
  assertEquals(r.status, 200, `${name} OPTIONS deve responder 200`);
  assert(
    r.headers.get("access-control-allow-origin") !== null,
    `${name} deve devolver header CORS`,
  );
}

export async function postSmoke(name: string, body: unknown = {}) {
  const r = await fetch(tickUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  assert(r.status < 500, `${name} não pode estourar 5xx (status=${r.status})`);
  assertEquals(typeof json, "object", `${name} deve devolver JSON`);
  // O contrato dos ticks é { ok: boolean, results?: [...] } ou { ok:false, error }
  assert("ok" in json, `${name} deve incluir campo 'ok' na resposta`);
  return { status: r.status, json };
}
