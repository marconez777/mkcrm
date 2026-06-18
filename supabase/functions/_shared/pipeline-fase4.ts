// supabase/functions/_shared/pipeline-fase4.ts
//
// Marco 4 — regras de retenção/nutrição disparadas pelo classifier:
//  - runJudicializacao: intent='judicializacao' → tag urgente + task + precisa_atencao_humana.
//  - runRenovacaoReceita: intent='renovacao_receita' inbound → task "Renovar receita".
//  - runObjectionSuggest: intent='objecao' → cria internal_note sugerindo resposta (NÃO envia).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

function addBusinessDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

async function addTags(client: SupabaseClient, leadId: string, tags: string[]) {
  const { data: lead } = await client.from("leads").select("tags").eq("id", leadId).single();
  const current: string[] = lead?.tags ?? [];
  const merged = Array.from(new Set([...current, ...tags]));
  if (merged.length === current.length) return;
  await client.from("leads").update({ tags: merged }).eq("id", leadId);
}

async function mergeCustomFields(client: SupabaseClient, leadId: string, patch: Record<string, unknown>) {
  const { data } = await client.from("leads").select("custom_fields").eq("id", leadId).single();
  const current = (data?.custom_fields ?? {}) as Record<string, unknown>;
  await client.from("leads").update({ custom_fields: { ...current, ...patch } }).eq("id", leadId);
}

async function hasOpenTaskWithPrefix(
  client: SupabaseClient,
  leadId: string,
  prefix: string,
  withinDays = 14,
): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 86_400_000).toISOString();
  const { data } = await client
    .from("lead_tasks")
    .select("id")
    .eq("lead_id", leadId)
    .is("done_at", null)
    .ilike("title", `${prefix}%`)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export interface JudInput { leadId: string; clinicId: string; reasons: string[] }

export async function runJudicializacao(client: SupabaseClient, input: JudInput) {
  if (!(await isEnabled(client, "automation.judicializacao.enabled"))) return { skipped: "toggle_off" };
  if (await hasOpenTaskWithPrefix(client, input.leadId, "Judicialização")) return { skipped: "duplicate_task" };
  await addTags(client, input.leadId, ["judicializacao", "precisa_atencao_humana"]);
  await mergeCustomFields(client, input.leadId, { judicializacao_em: new Date().toISOString() });
  const due = new Date(Date.now() + 2 * 3600_000); // 2h
  await client.from("lead_tasks").insert({
    lead_id: input.leadId,
    clinic_id: input.clinicId,
    title: "Judicialização detectada — revisar URGENTE",
    due_at: due.toISOString(),
  });
  await client.from("lead_events").insert({
    clinic_id: input.clinicId,
    lead_id: input.leadId,
    type: "auto:judicializacao",
    payload: { reasons: input.reasons, due_at: due.toISOString() },
  });
  return { ok: true };
}

export interface RenovInput { leadId: string; clinicId: string; stageName: string | null }

export async function runRenovacaoReceita(client: SupabaseClient, input: RenovInput) {
  if (!(await isEnabled(client, "automation.renovacao_receita.enabled"))) return { skipped: "toggle_off" };
  // Só em pacientes/leads pós-atendimento (inbound). Stages aceitos:
  const ok = ["Em tratamento", "Consulta finalizada", "Paciente antigo"];
  if (!input.stageName || !ok.includes(input.stageName)) return { skipped: `wrong_stage:${input.stageName}` };
  if (await hasOpenTaskWithPrefix(client, input.leadId, "Renovar receita")) return { skipped: "duplicate_task" };
  await addTags(client, input.leadId, ["renovacao_receita"]);
  const due = addBusinessDays(new Date(), 1);
  await client.from("lead_tasks").insert({
    lead_id: input.leadId,
    clinic_id: input.clinicId,
    title: "Renovar receita — solicitado pelo lead",
    due_at: due.toISOString(),
  });
  await client.from("lead_events").insert({
    clinic_id: input.clinicId,
    lead_id: input.leadId,
    type: "auto:renovacao-receita",
    payload: { due_at: due.toISOString() },
  });
  return { ok: true, due_at: due.toISOString() };
}

export interface ObjInput { leadId: string; clinicId: string; reasons: string[]; suggestion?: string }

export async function runObjectionSuggest(client: SupabaseClient, input: ObjInput) {
  if (!(await isEnabled(client, "automation.objection_suggest.enabled"))) return { skipped: "toggle_off" };
  // Dedup: já existe nota recente do mesmo tipo?
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: existing } = await client
    .from("lead_internal_notes")
    .select("id")
    .eq("lead_id", input.leadId)
    .ilike("content", "[auto:objection-suggest]%")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (existing) return { skipped: "duplicate_note" };
  const body = `[auto:objection-suggest] Objeção detectada pelo classifier.\nMotivos: ${input.reasons.join("; ")}\n${input.suggestion ? `Sugestão: ${input.suggestion}` : "Avalie responder reforçando benefício/segurança."}`;
  await client.from("lead_internal_notes").insert({
    lead_id: input.leadId,
    clinic_id: input.clinicId,
    content: body,
  });
  await addTags(client, input.leadId, ["objecao_detectada"]);
  await client.from("lead_events").insert({
    clinic_id: input.clinicId,
    lead_id: input.leadId,
    type: "auto:objection-suggest",
    payload: { reasons: input.reasons },
  });
  return { ok: true };
}
