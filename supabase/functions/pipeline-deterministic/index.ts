// supabase/functions/pipeline-deterministic/index.ts
//
// Marco 1 — Regras determinísticas do pipeline v4.2.
// Roteador único; cada action é uma regra `auto:*`. Todas as regras usam o
// helper pipelineMove (gates G1/G2/G3/G4/G5/G8/D3) e respeitam toggles em
// `app_settings` (default false).
//
// Acessada por:
//  - Triggers do banco via pg_net (lead INSERT, message INSERT, appointment INSERT/UPDATE, lead.custom_fields UPDATE)
//  - Cron jobs (inactivity-tick, reactivation-tick, human-reactor-tick)
//  - Invocação manual via supabase.functions.invoke (smoke test)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { pipelineMove } from "../_shared/pipeline-move.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Action =
  | "novo-lead"
  | "secretary-replied"
  | "reactivation-inbound"
  | "appointment-sync"
  | "field-changed"
  | "inactivity-tick"
  | "reactivation-tick"
  | "human-reactor-tick"
  | "monthly-sweep-tick";

interface Body {
  action: Action;
  lead_id?: string;
  message_id?: string;
  appointment_id?: string;
  // optional payload for field-changed
  old_custom_fields?: Record<string, unknown>;
  new_custom_fields?: Record<string, unknown>;
}

// Canonical stage names used by the rules (PT-BR).
type Canon =
  | "Novo"
  | "Qualificação"
  | "Consulta agendada"
  | "Tratamento agendado"
  | "Consulta finalizada"
  | "1ª Sessão Finalizada"
  | "Sem resposta"
  | "Nutrição inativa"
  | "Nutrição Antigos"
  | "Paciente antigo";

/**
 * Resolve a stage id within the lead's pipeline using stage_canonical_aliases.
 * Returns null when the canonical name has no mapping in the clinic's pipeline.
 */
async function resolveStageId(
  client: SupabaseClient,
  clinicId: string,
  pipelineId: string,
  canonical: Canon,
): Promise<string | null> {
  // Try alias table first (per pipeline)
  const { data: alias } = await client
    .from("stage_canonical_aliases")
    .select("stage_id")
    .eq("clinic_id", clinicId)
    .eq("pipeline_id", pipelineId)
    .eq("canonical_name", canonical)
    .maybeSingle();
  if (alias?.stage_id) return alias.stage_id as string;

  // Fallback: try exact name match in same pipeline
  const { data: stage } = await client
    .from("pipeline_stages")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("pipeline_id", pipelineId)
    .ilike("name", canonical)
    .maybeSingle();
  return (stage?.id as string) ?? null;
}

async function isEnabled(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (!data) return false;
  const v = String(data.value).toLowerCase();
  return v === "true" || v === "1" || v === '"true"';
}

async function patchCustomFields(
  client: SupabaseClient,
  leadId: string,
  patch: Record<string, unknown>,
) {
  const { data: lead } = await client
    .from("leads")
    .select("custom_fields")
    .eq("id", leadId)
    .single();
  const merged = { ...(lead?.custom_fields ?? {}), ...patch };
  await client.from("leads").update({ custom_fields: merged }).eq("id", leadId);
}

async function addTag(client: SupabaseClient, leadId: string, tag: string) {
  const { data: lead } = await client
    .from("leads")
    .select("tags")
    .eq("id", leadId)
    .single();
  const current: string[] = lead?.tags ?? [];
  if (current.includes(tag)) return;
  await client
    .from("leads")
    .update({ tags: [...current, tag] })
    .eq("id", leadId);
}

async function removeTags(client: SupabaseClient, leadId: string, tagsToRemove: string[]) {
  const { data: lead } = await client
    .from("leads")
    .select("tags")
    .eq("id", leadId)
    .single();
  const current: string[] = lead?.tags ?? [];
  const next = current.filter((t) => !tagsToRemove.includes(t));
  if (next.length === current.length) return;
  await client.from("leads").update({ tags: next }).eq("id", leadId);
}

async function logEvent(
  client: SupabaseClient,
  clinicId: string,
  leadId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await client.from("lead_events").insert({
    clinic_id: clinicId,
    lead_id: leadId,
    type,
    payload,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rules
// ─────────────────────────────────────────────────────────────────────────────

async function ruleNovoLead(client: SupabaseClient, leadId: string) {
  if (!(await isEnabled(client, "automation.novo_lead.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const { data: lead } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, stage_id")
    .eq("id", leadId)
    .single();
  if (!lead?.pipeline_id) return { skipped: "no_pipeline" };

  const novoId = await resolveStageId(
    client,
    lead.clinic_id,
    lead.pipeline_id,
    "Novo",
  );
  if (!novoId) return { skipped: "stage_not_found:Novo" };
  if (lead.stage_id === novoId) return { skipped: "already_in_stage" };

  const res = await pipelineMove(client, {
    leadId,
    toStageId: novoId,
    source: "auto:novo-lead",
    reason: "Lead recém-criado garantido no stage Novo",
    ruleKey: "automation.novo_lead.enabled",
    idempotencyKey: `novo-lead:${leadId}`,
  });
  await logEvent(client, lead.clinic_id, leadId, "auto:novo-lead", { res });
  return { res };
}

async function ruleSecretaryReplied(
  client: SupabaseClient,
  messageId: string,
) {
  if (!(await isEnabled(client, "automation.secretary_replied.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const { data: msg } = await client
    .from("messages")
    .select("id, lead_id, from_me, message_type")
    .eq("id", messageId)
    .single();
  if (!msg || !msg.from_me) return { skipped: "not_outbound" };

  const { data: lead } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, stage_id")
    .eq("id", msg.lead_id)
    .single();
  if (!lead?.pipeline_id) return { skipped: "no_pipeline" };

  const novoId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Novo");
  if (lead.stage_id !== novoId) return { skipped: "not_in_novo" };

  const qualifId = await resolveStageId(
    client,
    lead.clinic_id,
    lead.pipeline_id,
    "Qualificação",
  );
  if (!qualifId) return { skipped: "stage_not_found:Qualificação" };

  const res = await pipelineMove(client, {
    leadId: lead.id,
    toStageId: qualifId,
    source: "auto:secretary-replied",
    reason: `Secretária respondeu (msg ${messageId})`,
    ruleKey: "automation.secretary_replied.enabled",
    idempotencyKey: `secretary:${messageId}`,
  });
  await logEvent(client, lead.clinic_id, lead.id, "auto:secretary-replied", {
    message_id: messageId,
    res,
  });
  return { res };
}

/**
 * auto:reactivation-inbound
 * Quando um lead em "Nutrição inativa" ou "Nutrição Antigos" recebe uma
 * mensagem inbound (from_me=false), o card deve sair da geladeira:
 *   - Nutrição inativa  → Qualificação
 *   - Nutrição Antigos  → Paciente antigo
 * Respeita gates (manual_lock, etc.) via pipelineMove.
 */
async function ruleReactivationInbound(
  client: SupabaseClient,
  messageId: string,
) {
  if (!(await isEnabled(client, "automation.reactivation_inbound.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const { data: msg } = await client
    .from("messages")
    .select("id, lead_id, from_me")
    .eq("id", messageId)
    .single();
  if (!msg || msg.from_me) return { skipped: "not_inbound" };

  const { data: lead } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, stage_id, archived_at, is_internal_contact")
    .eq("id", msg.lead_id)
    .single();
  if (!lead?.pipeline_id) return { skipped: "no_pipeline" };
  if (lead.archived_at) return { skipped: "archived" };
  if (lead.is_internal_contact) return { skipped: "internal_contact" };

  const inativaId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Nutrição inativa");
  const antigosId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Nutrição Antigos");

  let targetCanon: Canon | null = null;
  if (lead.stage_id === inativaId) targetCanon = "Qualificação";
  else if (lead.stage_id === antigosId) targetCanon = "Paciente antigo";
  else return { skipped: "not_in_nutricao" };

  const toStageId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, targetCanon);
  if (!toStageId) return { skipped: `stage_not_found:${targetCanon}` };

  const res = await pipelineMove(client, {
    leadId: lead.id,
    toStageId,
    source: "auto:reactivation-inbound",
    reason: `Lead respondeu (msg ${messageId}) — saindo da geladeira`,
    ruleKey: "automation.reactivation_inbound.enabled",
    idempotencyKey: `reactivation-inbound:${messageId}`,
  });
  await logEvent(client, lead.clinic_id, lead.id, "auto:reactivation-inbound", {
    message_id: messageId,
    to_canon: targetCanon,
    res,
  });
  return { res };
}

async function ruleAppointmentSync(
  client: SupabaseClient,
  appointmentId: string,
) {
  const { data: appt } = await client
    .from("appointments")
    .select("id, lead_id, clinic_id, kind, status")
    .eq("id", appointmentId)
    .single();
  if (!appt) return { skipped: "appt_not_found" };

  const toggleByStatus: Record<string, string> = {
    agendado: "automation.appointment_agendado.enabled",
    realizado: "automation.appointment_realizado.enabled",
    faltou: "automation.appointment_faltou.enabled",
    cancelado: "automation.appointment_cancelado.enabled",
  };
  const toggle = toggleByStatus[appt.status];
  if (!toggle) return { skipped: `status_unhandled:${appt.status}` };
  if (!(await isEnabled(client, toggle))) return { skipped: "toggle_off" };

  const { data: lead } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, stage_id, custom_fields")
    .eq("id", appt.lead_id)
    .single();
  if (!lead?.pipeline_id) return { skipped: "no_pipeline" };

  // appointments.kind ∈ {consulta, procedimento, retorno}; mapeamento v4.2:
  // procedimento → "Tratamento agendado"
  let targetCanon: Canon | null = null;
  let extraTag: string | null = null;
  const patch: Record<string, unknown> = {};

  if (appt.status === "agendado") {
    if (appt.kind === "consulta") targetCanon = "Consulta agendada";
    else if (appt.kind === "procedimento") targetCanon = "Tratamento agendado";
    else if (appt.kind === "retorno") targetCanon = "Consulta agendada";
  } else if (appt.status === "realizado") {
    if (appt.kind === "consulta") {
      targetCanon = "Consulta finalizada";
      patch["status_consulta"] = "realizada";
    } else if (appt.kind === "procedimento") {
      targetCanon = "1ª Sessão Finalizada";
      const prev = Number(
        (lead.custom_fields as Record<string, unknown>)?.sessoes_realizadas ?? 0,
      );
      patch["sessoes_realizadas"] = prev + 1;
    }
  } else if (appt.status === "faltou") {
    targetCanon = "Sem resposta";
    extraTag = "reagendamento_pendente";
    patch["status_consulta"] = "faltou";
  } else if (appt.status === "cancelado") {
    targetCanon = "Qualificação";
    extraTag = "reagendamento_pendente";
    patch["status_consulta"] = "cancelada";
  }

  if (Object.keys(patch).length > 0) await patchCustomFields(client, lead.id, patch);
  if (extraTag) await addTag(client, lead.id, extraTag);

  // PR10.3: auto-clear das tags de reagendamento quando o appointment efetivamente
  // avança (agendado/realizado). Sem isso ruleConsultaPassou trava o lead
  // indefinidamente se a secretária esquecer de limpar a tag.
  if (appt.status === "agendado" || appt.status === "realizado") {
    await removeTags(client, lead.id, [
      "reagendamento_pendente",
      "reagendamento_solicitado",
      "aguardando_nova_data",
    ]);
  }

  if (!targetCanon) return { skipped: "no_target", patch };
  const toStageId = await resolveStageId(
    client,
    lead.clinic_id,
    lead.pipeline_id,
    targetCanon,
  );
  if (!toStageId) return { skipped: `stage_not_found:${targetCanon}` };
  if (lead.stage_id === toStageId) {
    await logEvent(client, lead.clinic_id, lead.id, "auto:appointment-sync", {
      appointment_id: appointmentId,
      status: appt.status,
      kind: appt.kind,
      patch,
      moved: false,
    });
    return { skipped: "already_in_stage", patch };
  }

  const res = await pipelineMove(client, {
    leadId: lead.id,
    toStageId,
    source: "auto:appointment-sync",
    reason: `Appointment ${appt.kind}/${appt.status}`,
    ruleKey: toggle,
    idempotencyKey: `appt:${appointmentId}:${appt.status}`,
    metadata: { appointment_id: appointmentId, kind: appt.kind, status: appt.status },
  });
  await logEvent(client, lead.clinic_id, lead.id, "auto:appointment-sync", {
    appointment_id: appointmentId,
    status: appt.status,
    kind: appt.kind,
    patch,
    res,
  });
  return { res, patch };
}

async function ruleFieldChanged(
  client: SupabaseClient,
  leadId: string,
  oldCf: Record<string, unknown>,
  newCf: Record<string, unknown>,
) {
  const out: Record<string, unknown> = {};

  // ciclo-concluido
  if (
    oldCf?.ciclo_concluido !== true &&
    newCf?.ciclo_concluido === true &&
    (await isEnabled(client, "automation.ciclo_concluido.enabled"))
  ) {
    const { data: lead } = await client
      .from("leads")
      .select("id, clinic_id, pipeline_id, stage_id")
      .eq("id", leadId)
      .single();
    if (lead?.pipeline_id) {
      const pacAntigo = await resolveStageId(
        client,
        lead.clinic_id,
        lead.pipeline_id,
        "Paciente antigo",
      );
      if (pacAntigo && lead.stage_id !== pacAntigo) {
        const res = await pipelineMove(client, {
          leadId,
          toStageId: pacAntigo,
          source: "auto:ciclo-concluido",
          reason: "ciclo_concluido=true",
          ruleKey: "automation.ciclo_concluido.enabled",
          idempotencyKey: `ciclo:${leadId}`,
        });
        // PR4 — removido manual_lock_until de 90 dias após ciclo concluído.
        await logEvent(client, lead.clinic_id, leadId, "auto:ciclo-concluido", {
          res,
        });
        out.ciclo = res;
      }
    }
  }

  // PR4 — modality-guard removido (campo modalidade_preferida descontinuado).

  // PR4 — eh_paciente_antigo: regra canônica para mover paciente antigo.
  if (
    oldCf?.eh_paciente_antigo !== true &&
    newCf?.eh_paciente_antigo === true &&
    (await isEnabled(client, "automation.paciente_antigo_canonical.enabled"))
  ) {
    const { data: lead } = await client
      .from("leads")
      .select("id, clinic_id, pipeline_id, stage_id")
      .eq("id", leadId)
      .single();
    if (lead?.pipeline_id) {
      const pacAntigo = await resolveStageId(
        client,
        lead.clinic_id,
        lead.pipeline_id,
        "Paciente antigo",
      );
      if (pacAntigo && lead.stage_id !== pacAntigo) {
        const res = await pipelineMove(client, {
          leadId,
          toStageId: pacAntigo,
          source: "auto:paciente-antigo-canonical",
          reason: "eh_paciente_antigo=true",
          ruleKey: "automation.paciente_antigo_canonical.enabled",
          idempotencyKey: `paciente-antigo:${leadId}`,
        });
        await logEvent(client, lead.clinic_id, leadId, "auto:paciente-antigo-canonical", { res });
        out.paciente_antigo = res;
      }
    }
  }

  // === Transição Agendamento Humano (Junho/2026) ===
  // Secretária preencheu data no Kanban → mover deterministicamente.
  const apptSyncEnabled = await isEnabled(client, "automation.appointment_sync.enabled");
  if (apptSyncEnabled) {
    const moves: Array<{ field: string; canon: Canon; src: string; key: string }> = [
      { field: "consulta_agendada_em",   canon: "Consulta agendada",   src: "auto:field-changed-consulta",     key: "field-changed-consulta" },
      { field: "procedimento_agendado_em", canon: "Tratamento agendado", src: "auto:field-changed-procedimento", key: "field-changed-procedimento" },
    ];
    for (const m of moves) {
      const before = oldCf?.[m.field];
      const after  = newCf?.[m.field];
      const wasEmpty = !before || before === "" || before === null;
      const nowFilled = !!after && after !== "";
      if (!(wasEmpty && nowFilled) && before === after) continue;
      if (!nowFilled) continue;
      const { data: lead } = await client
        .from("leads")
        .select("id, clinic_id, pipeline_id, stage_id")
        .eq("id", leadId)
        .single();
      if (!lead?.pipeline_id) continue;
      const toStageId = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, m.canon);
      if (!toStageId || lead.stage_id === toStageId) continue;
      const res = await pipelineMove(client, {
        leadId,
        toStageId,
        source: m.src,
        reason: `${m.field} preenchido pela secretária → ${m.canon}`,
        ruleKey: "automation.appointment_sync.enabled",
        idempotencyKey: `${m.key}:${leadId}:${String(after).slice(0, 19)}`,
      });
      await logEvent(client, lead.clinic_id, leadId, m.src, { field: m.field, value: after, res });
      out[m.key] = res;
    }
  }

  return out;
}

async function ruleInactivityTick(client: SupabaseClient) {
  const t24 = await isEnabled(client, "automation.followup_24h.enabled");
  const t3d = await isEnabled(client, "automation.followup_3d.enabled");
  const t7d = await isEnabled(client, "automation.followup_7d_nutricao.enabled");
  if (!t24 && !t3d && !t7d) return { skipped: "all_toggles_off" };

  const now = Date.now();
  const cutoff24 = new Date(now - 24 * 3600 * 1000).toISOString();
  const cutoff3d = new Date(now - 3 * 24 * 3600 * 1000).toISOString();
  const cutoff7d = new Date(now - 7 * 24 * 3600 * 1000).toISOString();

  // Active stages: Novo, Qualificação, Consulta agendada, Tratamento agendado
  const ACTIVE: Canon[] = [
    "Novo",
    "Qualificação",
    "Consulta agendada",
    "Tratamento agendado",
  ];

  // Fetch candidate leads: not archived, has stage in active set (resolved per-clinic)
  const { data: aliases } = await client
    .from("stage_canonical_aliases")
    .select("clinic_id, pipeline_id, canonical_name, stage_id")
    .in("canonical_name", [...ACTIVE, "Nutrição inativa", "Nutrição Antigos", "Paciente antigo"]);

  const stageIdsActive = new Set(
    (aliases ?? [])
      .filter((a) => ACTIVE.includes(a.canonical_name as Canon))
      .map((a) => a.stage_id),
  );
  const nutricaoByPipeline = new Map<string, string>();
  const nutricaoAntigosByPipeline = new Map<string, string>();
  for (const a of aliases ?? []) {
    if (a.canonical_name === "Nutrição inativa") {
      nutricaoByPipeline.set(a.pipeline_id, a.stage_id);
    } else if (a.canonical_name === "Nutrição Antigos") {
      nutricaoAntigosByPipeline.set(a.pipeline_id, a.stage_id);
    }
  }
  if (stageIdsActive.size === 0) return { skipped: "no_active_stages_mapped" };

  const { data: leads } = await client
    .from("leads")
    .select(
      "id, clinic_id, pipeline_id, stage_id, last_message_at, last_inbound_at, last_human_activity_at, tags",
    )
    .in("stage_id", Array.from(stageIdsActive))
    .is("archived_at", null)
    .eq("is_internal_contact", false)
    .limit(2000);

  let tier24 = 0, tier3 = 0, tier7 = 0;
  for (const lead of leads ?? []) {
    // PR5: relógio de inatividade usa last_inbound_at (somente mensagens do
    // paciente). Follow-ups da clínica não resetam mais o timer. Fallback p/
    // last_message_at quando o lead ainda não tem inbound registrado.
    const lastInbound = lead.last_inbound_at ?? lead.last_message_at ?? "1970-01-01";
    const lastHuman = lead.last_human_activity_at ?? "1970-01-01";

    if (t7d && lastInbound < cutoff7d) {
      const nutricaoId = nutricaoByPipeline.get(lead.pipeline_id);
      if (nutricaoId && lead.stage_id !== nutricaoId) {
        const today = new Date().toISOString().slice(0, 10);
        const res = await pipelineMove(client, {
          leadId: lead.id,
          toStageId: nutricaoId,
          source: "auto:followup-7d",
          reason: "7d sem inbound — move para Nutrição inativa",
          ruleKey: "automation.followup_7d_nutricao.enabled",
          idempotencyKey: `inactivity:${lead.id}:7d:${today}`,
        });
        if ((res as { moved?: boolean }).moved) {
          await addTag(client, lead.id, "precisa_atencao_humana");
          tier7++;
          await logEvent(client, lead.clinic_id, lead.id, "auto:followup-7d", {
            res,
          });
        }
      }
    } else if (t3d && lastInbound < cutoff3d) {
      const today = new Date().toISOString().slice(0, 10);
      // tag + event only (no move); idempotency via event lookup
      const { data: existing } = await client
        .from("lead_events")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("type", "auto:followup-3d")
        .gte("created_at", `${today}T00:00:00Z`)
        .maybeSingle();
      if (!existing) {
        await logEvent(client, lead.clinic_id, lead.id, "auto:followup-3d", {
          last_inbound_at: lead.last_inbound_at,
          last_message_at: lead.last_message_at,
        });
        tier3++;
      }
    } else if (t24 && lastHuman < cutoff24) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await client
        .from("lead_events")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("type", "auto:followup-24h")
        .gte("created_at", `${today}T00:00:00Z`)
        .maybeSingle();
      if (!existing) {
        await logEvent(client, lead.clinic_id, lead.id, "auto:followup-24h", {
          last_human_activity_at: lead.last_human_activity_at,
        });
        tier24++;
      }
    }
  }


  // V5 — SLA 60d em "Paciente antigo" → "Nutrição Antigos".
  // Branch independente p/ não interferir nos tiers 24h/3d/7d acima.
  let tier60pa = 0;
  const t60pa = await isEnabled(client, "automation.inactivity_paciente_antigo.enabled");
  if (t60pa) {
    const cutoff60 = new Date(now - 60 * 24 * 3600 * 1000).toISOString();
    const paAliases = (aliases ?? []).filter((a) => a.canonical_name === "Paciente antigo");
    const paStageIds = new Set(paAliases.map((a) => a.stage_id));
    if (paStageIds.size > 0) {
      const { data: paLeads } = await client
        .from("leads")
        .select("id, clinic_id, pipeline_id, stage_id, last_inbound_at, last_message_at")
        .in("stage_id", Array.from(paStageIds))
        .is("archived_at", null)
        .eq("is_internal_contact", false)
        .or(`last_inbound_at.lt.${cutoff60},and(last_inbound_at.is.null,last_message_at.lt.${cutoff60})`)
        .limit(2000);

      for (const lead of paLeads ?? []) {
        const destId = nutricaoAntigosByPipeline.get(lead.pipeline_id);
        if (!destId) continue;
        const ym = new Date().toISOString().slice(0, 7);
        const res = await pipelineMove(client, {
          leadId: lead.id,
          toStageId: destId,
          source: "auto:inactivity-tick",
          reason: "60d sem inbound em Paciente antigo — Nutrição Antigos",
          ruleKey: "automation.inactivity_paciente_antigo.enabled",
          idempotencyKey: `inactivity:paciente_antigo:antigos:${lead.id}:${ym}`,
        });
        if ((res as { moved?: boolean }).moved) {
          tier60pa++;
          await logEvent(client, lead.clinic_id, lead.id, "auto:inactivity-paciente-antigo-nutricao-antigos", { res });
        }
      }
    }
  }

  return { tier24, tier3, tier7, tier60pa, scanned: leads?.length ?? 0 };
}

async function ruleReactivationTick(client: SupabaseClient) {
  if (!(await isEnabled(client, "automation.reactivation.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: aliases } = await client
    .from("stage_canonical_aliases")
    .select("stage_id")
    .eq("canonical_name", "Nutrição inativa");
  const stageIds = (aliases ?? []).map((a) => a.stage_id);
  if (stageIds.length === 0) return { skipped: "no_stage_mapped" };

  const { data: leads } = await client
    .from("leads")
    .select("id, clinic_id, custom_fields, stage_changed_at, tags")
    .in("stage_id", stageIds)
    .lt("stage_changed_at", cutoff)
    .is("archived_at", null)
    .limit(500);

  let count = 0;
  for (const lead of leads ?? []) {
    const cf = (lead.custom_fields as Record<string, unknown>) ?? {};
    if (cf.interesse_tratamento !== true) continue;
    if ((lead.tags as string[]).includes("reativacao")) continue;
    const today = new Date().toISOString().slice(0, 10);
    await addTag(client, lead.id, "reativacao");
    await logEvent(client, lead.clinic_id, lead.id, "auto:reactivation", {
      day: today,
    });
    count++;
  }
  return { tagged: count, scanned: leads?.length ?? 0 };
}

async function ruleHumanReactorTick(client: SupabaseClient) {
  if (!(await isEnabled(client, "automation.human_reactor.enabled"))) {
    return { skipped: "toggle_off" };
  }
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: leads } = await client
    .from("leads")
    .select("id, clinic_id, tags, updated_at")
    .contains("tags", ["precisa_atencao_humana"])
    .lt("updated_at", cutoff)
    .is("archived_at", null)
    .limit(500);

  let count = 0;
  for (const lead of leads ?? []) {
    // skip if a non-done task already exists with this title
    const { data: existing } = await client
      .from("lead_tasks")
      .select("id")
      .eq("lead_id", lead.id)
      .ilike("title", "Revisar lead travado%")
      .is("done_at", null)
      .maybeSingle();
    if (existing) continue;
    await client.from("lead_tasks").insert({
      clinic_id: lead.clinic_id,
      lead_id: lead.id,
      title: "Revisar lead travado (D7)",
      due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
    await logEvent(client, lead.clinic_id, lead.id, "auto:human-reactor", {});
    count++;
  }
  return { tasks_created: count, scanned: leads?.length ?? 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// ruleConsultaPassou — PR6
// Quando a data da consulta/procedimento já passou (+ buffer de 2h) e o lead
// continua em "Consulta agendada" / "Tratamento agendado" sem reagendamento
// pendente, presume-se que foi realizada e move-se para o stage final. No-show
// continua sendo move manual da secretária.
// ─────────────────────────────────────────────────────────────────────────────
async function ruleConsultaPassou(client: SupabaseClient) {
  // === Transição Agendamento Humano (Junho/2026) ===
  // Desligada: com múltiplos procedimentos paralelos (consulta + cetamina), o
  // cron automático finalizava cards ativos prematuramente. A secretária move
  // manualmente para "Consulta finalizada" / "1ª Sessão Finalizada".
  return { skipped: "disabled_by_human_transition" } as const;
  // eslint-disable-next-line no-unreachable
  if (!(await isEnabled(client, "automation.consulta_passou_finaliza.enabled"))) {
    return { skipped: "toggle_off" };
  }

  const BUFFER_MS = 2 * 3600 * 1000;
  const cutoffIso = new Date(Date.now() - BUFFER_MS).toISOString();

  const { data: aliases } = await client
    .from("stage_canonical_aliases")
    .select("pipeline_id, stage_id, canonical_name")
    .in("canonical_name", [
      "Consulta agendada",
      "Tratamento agendado",
      "Consulta finalizada",
      "1ª Sessão Finalizada",
    ]);

  type Pair = { fromCanon: "Consulta agendada" | "Tratamento agendado"; toCanon: "Consulta finalizada" | "1ª Sessão Finalizada"; tag: string; source: string };
  const PAIRS: Pair[] = [
    { fromCanon: "Consulta agendada", toCanon: "Consulta finalizada", tag: "consulta_realizada", source: "auto:consulta-passou" },
    { fromCanon: "Tratamento agendado", toCanon: "1ª Sessão Finalizada", tag: "procedimento_realizado", source: "auto:procedimento-passou" },
  ];

  const REAGENDAMENTO_TAGS = new Set(["reagendamento_pendente", "reagendamento_solicitado", "aguardando_nova_data"]);

  let moved = 0;
  let scanned = 0;
  const moves: unknown[] = [];

  for (const pair of PAIRS) {
    const fromStageIds = (aliases ?? [])
      .filter((a) => a.canonical_name === pair.fromCanon)
      .map((a) => a.stage_id);
    if (fromStageIds.length === 0) continue;

    const toByPipeline = new Map<string, string>();
    for (const a of aliases ?? []) {
      if (a.canonical_name === pair.toCanon) toByPipeline.set(a.pipeline_id, a.stage_id);
    }

    const { data: leads } = await client
      .from("leads")
      .select("id, clinic_id, pipeline_id, stage_id, tags, custom_fields")
      .in("stage_id", fromStageIds)
      .is("archived_at", null)
      .eq("is_internal_contact", false)
      .limit(2000);

    for (const lead of leads ?? []) {
      scanned++;
      const cf = (lead.custom_fields ?? {}) as Record<string, unknown>;
      const rawDate =
        (cf.procedimento_agendado_em as string | undefined) ??
        (cf.consulta_agendada_em as string | undefined);
      if (!rawDate) continue;
      const ts = Date.parse(rawDate);
      if (!Number.isFinite(ts)) continue;
      if (ts >= Date.now() - BUFFER_MS) continue; // ainda futuro / dentro do buffer

      const tags = (lead.tags ?? []) as string[];
      if (tags.some((t) => REAGENDAMENTO_TAGS.has(t))) continue;

      const toStageId = toByPipeline.get(lead.pipeline_id);
      if (!toStageId || lead.stage_id === toStageId) continue;

      const ymd = new Date(ts).toISOString().slice(0, 10);
      const res = await pipelineMove(client, {
        leadId: lead.id,
        toStageId,
        source: pair.source,
        reason: `${pair.fromCanon} → ${pair.toCanon}: data ${ymd} já passou (+2h buffer); no-show fica manual`,
        ruleKey: "automation.consulta_passou_finaliza.enabled",
        idempotencyKey: `consulta-passou:${lead.id}:${ymd}`,
      });
      if ((res as { moved?: boolean }).moved) {
        await addTag(client, lead.id, pair.tag);
        await logEvent(client, lead.clinic_id, lead.id, pair.source, {
          from: pair.fromCanon,
          to: pair.toCanon,
          data_agendada: rawDate,
        });
        moved++;
        moves.push({ lead_id: lead.id, to: pair.toCanon, data: rawDate });
      }
    }
  }

  return { moved, scanned, sample: moves.slice(0, 10) };
}


// ─────────────────────────────────────────────────────────────────────────────
// ruleMonthlySweep — Dia 1 de cada mês: leads em "Consulta finalizada" ou
// "1ª Sessão Finalizada" cuja stage_changed_at < primeiro dia do mês corrente
// viram "Paciente antigo" + eh_paciente_antigo=true.
// Idempotência mensal: monthly-sweep:{lead_id}:{YYYY-MM}
// Toggle: automation.monthly_sweep_paciente_antigo.enabled (default false)
// ─────────────────────────────────────────────────────────────────────────────
async function ruleMonthlySweep(client: SupabaseClient, opts?: { dryRun?: boolean }) {
  const dryRun = !!opts?.dryRun;
  if (!dryRun && !(await isEnabled(client, "automation.monthly_sweep_paciente_antigo.enabled"))) {
    return { skipped: "toggle_off" };
  }

  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const ym = now.toISOString().slice(0, 7);

  const { data: aliases } = await client
    .from("stage_canonical_aliases")
    .select("pipeline_id, stage_id, canonical_name")
    .in("canonical_name", ["Consulta finalizada", "1ª Sessão Finalizada", "Paciente antigo"]);

  const FROM_CANON = new Set(["Consulta finalizada", "1ª Sessão Finalizada"]);
  const fromStageIds = (aliases ?? [])
    .filter((a) => FROM_CANON.has(a.canonical_name))
    .map((a) => a.stage_id);
  const paByPipeline = new Map<string, string>();
  for (const a of aliases ?? []) {
    if (a.canonical_name === "Paciente antigo") paByPipeline.set(a.pipeline_id, a.stage_id);
  }

  if (fromStageIds.length === 0 || paByPipeline.size === 0) {
    return { skipped: "no_stages_mapped" };
  }

  const { data: leads } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, stage_id, stage_changed_at, custom_fields")
    .in("stage_id", fromStageIds)
    .lt("stage_changed_at", firstOfMonth)
    .is("archived_at", null)
    .eq("is_internal_contact", false)
    .limit(5000);

  let moved = 0;
  let scanned = 0;
  const sample: unknown[] = [];

  for (const lead of leads ?? []) {
    scanned++;
    const toStageId = paByPipeline.get(lead.pipeline_id);
    if (!toStageId || lead.stage_id === toStageId) continue;

    if (dryRun) {
      if (sample.length < 20) sample.push({ lead_id: lead.id, from: lead.stage_id, to: toStageId });
      moved++;
      continue;
    }

    const res = await pipelineMove(client, {
      leadId: lead.id,
      toStageId,
      source: "auto:monthly-sweep",
      reason: `Sweep mensal ${ym}: card de mês anterior → Paciente antigo`,
      ruleKey: "automation.monthly_sweep_paciente_antigo.enabled",
      idempotencyKey: `monthly-sweep:${lead.id}:${ym}`,
    });

    if ((res as { moved?: boolean }).moved) {
      await patchCustomFields(client, lead.id, { eh_paciente_antigo: true });
      await logEvent(client, lead.clinic_id, lead.id, "auto:monthly-sweep", {
        ym,
        from_stage_id: lead.stage_id,
        to_stage_id: toStageId,
      });
      moved++;
      if (sample.length < 20) sample.push({ lead_id: lead.id, to: toStageId });
    }
  }

  return { ym, dryRun, moved, scanned, sample };
}


// ─────────────────────────────────────────────────────────────────────────────
// HTTP entry
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const client = createClient(SUPABASE_URL, SERVICE_KEY);
    let result: unknown;

    switch (body.action) {
      case "novo-lead":
        if (!body.lead_id) throw new Error("lead_id required");
        result = await ruleNovoLead(client, body.lead_id);
        break;
      case "secretary-replied":
        if (!body.message_id) throw new Error("message_id required");
        result = await ruleSecretaryReplied(client, body.message_id);
        break;
      case "reactivation-inbound":
        if (!body.message_id) throw new Error("message_id required");
        result = await ruleReactivationInbound(client, body.message_id);
        break;
      case "appointment-sync":
        if (!body.appointment_id) throw new Error("appointment_id required");
        result = await ruleAppointmentSync(client, body.appointment_id);
        break;
      case "field-changed":
        if (!body.lead_id) throw new Error("lead_id required");
        result = await ruleFieldChanged(
          client,
          body.lead_id,
          body.old_custom_fields ?? {},
          body.new_custom_fields ?? {},
        );
        break;
      case "inactivity-tick":
        result = {
          inactivity: await ruleInactivityTick(client),
          consulta_passou: await ruleConsultaPassou(client),
        };
        break;
      case "reactivation-tick":
        result = await ruleReactivationTick(client);
        break;
      case "human-reactor-tick":
        result = await ruleHumanReactorTick(client);
        break;
      case "monthly-sweep-tick": {
        const dryRun = (body as unknown as { dry_run?: boolean }).dry_run === true;
        result = await ruleMonthlySweep(client, { dryRun });
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "unknown_action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    console.log(JSON.stringify({ action: body.action, result }));
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pipeline-deterministic error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
