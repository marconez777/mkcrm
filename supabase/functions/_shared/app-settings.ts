// supabase/functions/_shared/app-settings.ts
//
// F3 — Helpers unificados para leitura de `app_settings`.
//
// Antes deste módulo, cada função (pipeline-classify, pipeline-summarize-core,
// pipeline-position-auditor, agent-core, etc.) tinha sua própria cópia de
// `isEnabled()`. Variações sutis (quote stripping, default value) causavam
// divergências — ex.: P29 (summarizer ignorando toggle).
//
// Regra única:
//   - chave ausente / valor não-parseável → `defaultValue` (default = false).
//   - valores aceitos como TRUE: "true", "1", true (jsonb), '"true"' (string-quoted).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * Lê um valor bruto de `app_settings.value`. Retorna `null` se ausente.
 * O valor é normalizado removendo aspas externas e convertido para string.
 */
export async function getSettingString(
  client: SupabaseClient,
  key: string,
): Promise<string | null> {
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  const raw = (data as { value: unknown }).value;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") return raw.replace(/^"|"$/g, "");
  return String(raw);
}

/**
 * Lê e parseia um valor JSON de `app_settings.value`. Retorna `null` se ausente
 * ou inválido. Use para arrays/objetos (ex.: allowed_tags, taxonomy).
 */
export async function getSettingJSON<T = unknown>(
  client: SupabaseClient,
  key: string,
): Promise<T | null> {
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  const raw = (data as { value: unknown }).value;
  if (raw === null || raw === undefined) return null;
  try {
    if (typeof raw === "string") return JSON.parse(raw) as T;
    return raw as T;
  } catch {
    return null;
  }
}

/**
 * Lê um toggle booleano. Default = `false` (mantém comportamento legacy de G3).
 *
 * Substitui as N cópias locais de `isEnabled()` espalhadas pelo pipeline.
 */
export async function getToggle(
  client: SupabaseClient,
  key: string,
  defaultValue = false,
): Promise<boolean> {
  const v = await getSettingString(client, key);
  if (v === null) return defaultValue;
  const s = v.toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return defaultValue;
}

/**
 * Lê um número de `app_settings`. Default = `defaultValue` se ausente,
 * inválido, ou ≤ 0. Aplica `max` opcional como teto.
 */
export async function getSettingNumber(
  client: SupabaseClient,
  key: string,
  defaultValue: number,
  max?: number,
): Promise<number> {
  const v = await getSettingString(client, key);
  if (v === null) return defaultValue;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return max !== undefined ? Math.min(n, max) : n;
}
