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
import { isAutoReplyMessage } from "../_shared/standard-messages.ts";


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
  | "Paciente antigo"
  | "Reagendamento";

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

/**
 * Resolve o destino de uma regra, aceitando travessia entre pipelines.
 *
 * 1) Tenta a coluna dentro do pipeline atual do lead (comportamento de sempre).
 * 2) Se não existir lá, procura uma travessia DECLARADA saindo da coluna atual
 *    em `pipeline_crossings`. Prefere `trigger_key` igual à origem da regra;
 *    só usa o coringa '*' quando ele é único. Ambíguo => recusa.
 *
 * Sem isto, separar Vendas de Pacientes quebraria a conversão: `resolveStageId`
 * filtra por `lead.pipeline_id` e devolveria null em silêncio.
 * Ver docs/tenants/clinica-or/FLUXO_ALVO.md §4.
 */
async function resolveDestination(
  client: SupabaseClient,
  lead: { clinic_id: string; pipeline_id: string; stage_id: string | null },
  canonical: Canon,
  source: string,
): Promise<string | null> {
  const own = await resolveStageId(client, lead.clinic_id, lead.pipeline_id, canonical);
  if (own) return own;
  if (!lead.stage_id) return null;

  const { data } = await client
    .from("pipeline_crossings")
    .select("to_stage_id, trigger_key")
    .eq("clinic_id", lead.clinic_id)
    .eq("from_stage_id", lead.stage_id)
    .eq("enabled", true)
    .eq("allow_auto", true);

  const exact = (data ?? []).filter((c) => c.trigger_key === source);
  if (exact.length === 1) return exact[0].to_stage_id as string;
  if (exact.length > 1) {
    console.warn(`[resolveDestination] travessia ambígua para ${source} de ${lead.stage_id}`);
    return null;
  }
  const wild = (data ?? []).filter((c) => c.trigger_key === "*");
  return wild.length === 1 ? (wild[0].to_stage_id as string) : null;
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
    .select("id, clinic_id, pipeline_id, stage_id, form_source")
    .eq("id", leadId)
    .single();
  if (!lead?.pipeline_id) return { skipped: "no_pipeline" };

  // Lead de formulário do site já nasce na etapa que `forms-ingest` resolveu
  // (etapa do formulário → etapa da integração → primeira coluna /nutri/i).
  // Sem esta guarda o AFTER INSERT desfazia essa escolha em segundos: o lead
  // caía em Nutrição Inativa e era arrastado para "Novo" sem nenhuma mensagem,
  // sem nenhuma interação. Quem cria o lead decide onde ele entra.
  if (lead.form_source) {
    return { skipped: "created_by_form", form_source: lead.form_source };
  }

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
    .select("id, lead_id, from_me, message_type, content, is_automated")
    .eq("id", messageId)
    .single();
  if (!msg || !msg.from_me) return { skipped: "not_outbound" };
  // Saudação automática do WhatsApp não conta como resposta da secretária.
  if (msg.is_automated) return { skipped: "automated_message" };
  if (isAutoReplyMessage(msg.content)) return { skipped: "auto_reply_greeting" };


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
 *
 * O paciente/lead voltou a falar. O destino depende de onde ele está:
 *
 *   VENDAS     Nutrição Inativa      → Qualificação
 *   PACIENTES  Paciente Inativo      → Reagendamento
 *              Consulta Finalizada   → Reagendamento
 *              Tratamento Finalizado → Reagendamento
 *
 * A ideia central do desenho de dois funis: quem já é paciente nunca é
 * rebaixado a lead ao reaparecer — vai para a fila de trabalho de Pacientes.
 * Nas demais colunas, nada acontece.
 *
 * Respeita todos os gates via pipelineMove, inclusive o G9 de travessia.
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

  // Etapa 5 — o paciente que volta a falar tem destino diferente conforme onde
  // está. No funil de Vendas ele volta a ser trabalhado como lead; no de
  // Pacientes vai para a fila de Reagendamento, sem ser rebaixado a lead.
  const [inativaId, semRespostaId, finalConsultaId, finalTratamentoId, pacInativoId] =
    await Promise.all([
      resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Nutrição inativa"),
      resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Sem resposta"),
      resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Consulta finalizada"),
      resolveStageId(client, lead.clinic_id, lead.pipeline_id, "1ª Sessão Finalizada"),
      resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Paciente antigo"),
    ]);

  let targetCanon: Canon | null = null;
  if (lead.stage_id === inativaId || lead.stage_id === semRespostaId) {
    // "Sem resposta" foi acrescentada em 13/08: até então esse caminho existia
    // APENAS no trigger SQL `fn_clinica_or_wakeup_inbound`, com os UUIDs das
    // colunas cravados. Com a regra cobrindo os dois casos, o trigger vira
    // redundante e pode ser removido — junto com 5 UUIDs hardcoded e o defeito
    // D9 (o wake-up aparecia como `system` no histórico).
    targetCanon = "Qualificação";
  } else if (
    lead.stage_id === pacInativoId ||
    lead.stage_id === finalConsultaId ||
    lead.stage_id === finalTratamentoId
  ) {
    targetCanon = "Reagendamento";
  } else {
    return { skipped: "coluna_sem_reativacao" };
  }

  const toStageId = await resolveDestination(
    client,
    lead,
    targetCanon,
    "auto:reactivation-inbound",
  );
  if (!toStageId) return { skipped: `stage_not_found:${targetCanon}` };
  if (lead.stage_id === toStageId) return { skipped: "already_at_destination" };

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
    // Antes ia para "Sem resposta", que ficou no funil de Vendas. Quem falta
    // continua sendo paciente: fica em Pacientes, na fila de Reagendamento.
    targetCanon = "Reagendamento";
    extraTag = "reagendamento_pendente";
    patch["status_consulta"] = "faltou";
  } else if (appt.status === "cancelado") {
    // Antes voltava para "Qualificação" — rebaixava paciente a lead.
    targetCanon = "Reagendamento";
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
  // Aceita travessia: compromisso marcado como "agendado" para um lead ainda em
  // Vendas leva o card para Pacientes.
  //
  // ⚠️ Etapa 5: os destinos de `faltou` (hoje "Sem resposta") e `cancelado`
  // (hoje "Qualificação") precisam virar "Reagendamento" — no desenho novo a
  // secretária apaga a data e o card fica no funil de Pacientes. Enquanto não
  // mudarem, essas duas transições serão recusadas como travessia não declarada.
  const toStageId = await resolveDestination(
    client,
    lead,
    targetCanon,
    "auto:appointment-sync",
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

  // ── Aposentados na Etapa 5 (12/08/2026) ────────────────────────────────
  // `ciclo_concluido` e `eh_paciente_antigo` moviam o card para "Paciente
  // antigo". No desenho de dois funis quem leva para Paciente Inativo é o
  // tempo: 60 dias parado em Consulta/Tratamento Finalizado. Confirmado com o
  // cliente que a secretária não usa esses campos.
  // Os toggles automation.ciclo_concluido.enabled e
  // automation.paciente_antigo_canonical.enabled ficam órfãos — remover da tela
  // de automações. Ver PLANO_IMPLEMENTACAO §3 Etapa 5, item 22.
  //
  // PR4 — modality-guard já havia sido removido (campo descontinuado).

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
      // Aceita travessia entre pipelines: no desenho de dois funis, Qualificação
      // (Vendas) → Consulta/Tratamento Agendado (Pacientes) cruza a fronteira.
      const toStageId = await resolveDestination(client, lead, m.canon, m.src);
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

  // ── Data APAGADA → Reagendamento ────────────────────────────────────────
  // Falta ou cancelamento: a secretária limpa a data e o card sai da fila de
  // agendados para a fila de trabalho do funil de Pacientes.
  //
  // ⚠️ Vale SÓ quando o card está em Consulta Agendada ou Tratamento Agendado.
  // Sem essa restrição haveria um laço: entrar em "Consulta Finalizada" limpa a
  // data automaticamente (wipe do pipelineMove), o que dispararia este gatilho e
  // o card saltaria de Finalizada direto para Reagendamento — nunca ficando em
  // Finalizada, e a pesquisa de satisfação nunca disparando.
  if (apptSyncEnabled) {
    const limpou = ["consulta_agendada_em", "procedimento_agendado_em"].some((f) => {
      const before = oldCf?.[f];
      const after = newCf?.[f];
      return !!before && before !== "" && (!after || after === "");
    });

    if (limpou) {
      const { data: lead } = await client
        .from("leads")
        .select("id, clinic_id, pipeline_id, stage_id")
        .eq("id", leadId)
        .single();

      if (lead?.pipeline_id && lead.stage_id) {
        const agendadas = await Promise.all([
          resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Consulta agendada"),
          resolveStageId(client, lead.clinic_id, lead.pipeline_id, "Tratamento agendado"),
        ]);

        if (agendadas.includes(lead.stage_id)) {
          const src = "auto:field-cleared-reagendamento";
          const destino = await resolveDestination(client, lead, "Reagendamento", src);
          if (destino && destino !== lead.stage_id) {
            const res = await pipelineMove(client, {
              leadId,
              toStageId: destino,
              source: src,
              reason: "Data de agendamento apagada pela secretária → Reagendamento",
              ruleKey: "automation.appointment_sync.enabled",
              // Granularidade de hora evita re-disparo em edições seguidas.
              idempotencyKey: `field-cleared:${leadId}:${new Date().toISOString().slice(0, 13)}`,
            });
            await logEvent(client, lead.clinic_id, leadId, src, { res });
            out["field-cleared-reagendamento"] = res;
          }
        }
      }
    }
  }

  return out;
}

async function ruleInactivityTick(client: SupabaseClient) {
  // ── Escada de follow-up, degrau 1 — 24h de silêncio do PACIENTE ──────────
  //
  // Reescrita em 12/08/2026 (Etapa 5). O resto do que existia aqui virou
  // automação de coluna, porque `stage_idle` conta tempo em `stage_changed_at`
  // e não é afetado quando a clínica envia mensagem:
  //
  //   FU#1 ao entrar em Sem Resposta       -> automations, stage_idle hours=0
  //   FU#2 +48h                             -> automations, stage_idle hours=48
  //   Sem Resposta 7d  -> Nutrição Inativa  -> automations, stage_idle hours=168
  //   Reagendamento 7d -> Paciente Inativo  -> automations, stage_idle hours=168
  //   Finalizada 60d   -> Paciente Inativo  -> automations, stage_idle hours=1440
  //
  // Só este degrau precisa de código: o relógio é o silêncio do PACIENTE
  // (`last_inbound_at`), e o lead pode estar conversando há dias na mesma
  // coluna — tempo em coluna não diria nada.
  //
  // Também saíram daqui:
  //   • o degrau de 3 dias (o desenho usa 48h, e ele vive em Sem Resposta);
  //   • a regra de 60d Paciente antigo -> Nutrição Antigos: com a fusão do
  //     Bloco B, Paciente Inativo é o fim da linha — quem tira o paciente de
  //     lá é ele mesmo voltando a falar;
  //   • Consulta e Tratamento agendado saíram do contador (decisão D5: card
  //     com data marcada nunca esfria).
  //
  // Ver docs/tenants/clinica-or/FLUXO_ALVO.md §2.2 e §6b.
  if (!(await isEnabled(client, "automation.followup_24h.enabled"))) {
    return { skipped: "toggle_off" };
  }

  const cutoff24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Origem e destino por apelido canônico — imunes a rename de coluna.
  const { data: aliases } = await client
    .from("stage_canonical_aliases")
    .select("clinic_id, pipeline_id, canonical_name, stage_id")
    .in("canonical_name", ["Qualificação", "Sem resposta"]);

  const qualifIds = new Set(
    (aliases ?? []).filter((a) => a.canonical_name === "Qualificação").map((a) => a.stage_id),
  );
  const semRespostaByPipeline = new Map<string, string>();
  for (const a of aliases ?? []) {
    if (a.canonical_name === "Sem resposta") semRespostaByPipeline.set(a.pipeline_id, a.stage_id);
  }
  if (qualifIds.size === 0) return { skipped: "no_qualificacao_mapped" };

  const { data: leads } = await client
    .from("leads")
    .select("id, clinic_id, pipeline_id, stage_id, last_inbound_at, last_message_at")
    .in("stage_id", Array.from(qualifIds))
    .is("archived_at", null)
    .eq("is_internal_contact", false)
    .limit(2000);

  let movidos = 0;
  const naoMovidos: Record<string, number> = {};

  for (const lead of leads ?? []) {
    // Sem inbound registrado, cai para a última mensagem da conversa.
    const lastInbound = lead.last_inbound_at ?? lead.last_message_at ?? "1970-01-01";
    if (lastInbound >= cutoff24) continue;

    const destino = semRespostaByPipeline.get(lead.pipeline_id);
    if (!destino) {
      naoMovidos["sem_coluna_destino"] = (naoMovidos["sem_coluna_destino"] ?? 0) + 1;
      continue;
    }

    const dia = new Date().toISOString().slice(0, 10);
    const res = await pipelineMove(client, {
      leadId: lead.id,
      toStageId: destino,
      source: "auto:followup-24h",
      reason: "24h sem mensagem do paciente em Qualificação",
      ruleKey: "automation.followup_24h.enabled",
      idempotencyKey: `inactivity:${lead.id}:24h:${dia}`,
    });

    if ((res as { moved?: boolean }).moved) {
      movidos++;
      await logEvent(client, lead.clinic_id, lead.id, "auto:followup-24h", {
        last_inbound_at: lead.last_inbound_at,
        res,
      });
    } else {
      const r = (res as { reason?: string }).reason ?? "nao_movido";
      naoMovidos[r] = (naoMovidos[r] ?? 0) + 1;
    }
  }

  const out = { avaliados: leads?.length ?? 0, movidos, nao_movidos: naoMovidos };
  console.log(JSON.stringify({ v: "det-v3", phase: "followup24:done", ...out }));
  return out;
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
// HTTP entry
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = new Date();
  const t0 = Date.now();
  let bodyAction = "unknown";
  const client = createClient(SUPABASE_URL, SERVICE_KEY);

  async function persistTickStats(params: {
    ok: boolean;
    result?: unknown;
    errorMessage?: string;
  }) {
    try {
      // Corrigido em 12/08/2026: lia `inactivity.pa40`, mas a função devolvia
      // `pa60` — as estatísticas gravavam zero desde sempre, justamente a
      // telemetria que teria denunciado a regra de 60 dias travada.
      // A fase pa60 morreu na Etapa 5; o que sobra é o degrau de 24h.
      const r = params.result as {
        inactivity?: { avaliados?: number; movidos?: number; nao_movidos?: Record<string, number> };
      } | undefined;
      const inact = r?.inactivity ?? {};
      const p = {
        candidates: inact.avaliados ?? 0,
        moved: inact.movidos ?? 0,
        not_moved: Object.values(inact.nao_movidos ?? {}).reduce((s, n) => s + n, 0),
        failure_reasons: inact.nao_movidos ?? {},
        skipped_no_dest: (inact.nao_movidos ?? {})["sem_coluna_destino"] ?? 0,
        errored: 0,
        avg_ms_per_lead: 0,
        p95_ms_per_lead: 0,
      };
      await client.from("pipeline_tick_stats").insert({
        action: bodyAction,
        phase: r?.inactivity ? "inactivity" : null,
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        ok: params.ok,
        candidates: p.candidates ?? 0,
        moved: p.moved ?? 0,
        not_moved: p.not_moved ?? 0,
        skipped_no_dest: p.skipped_no_dest ?? 0,
        errored: p.errored ?? 0,
        avg_ms_per_lead: p.avg_ms_per_lead ?? 0,
        p95_ms_per_lead: p.p95_ms_per_lead ?? 0,
        failure_reasons: p.failure_reasons ?? {},
        error_message: params.errorMessage ?? null,
        raw: (params.result ?? null) as never,
      });
    } catch (e) {
      console.error("pipeline_tick_stats insert failed", (e as Error).message);
    }
  }

  try {
    const body = (await req.json()) as Body;
    bodyAction = body.action ?? "unknown";
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
        // `consulta_passou` saiu: a regra estava desligada desde a Transição
        // Agendamento Humano e virou código inalcançável. Fechar consulta e
        // tratamento é ação da secretária.
        result = { inactivity: await ruleInactivityTick(client) };
        break;
      case "reactivation-tick":
        result = await ruleReactivationTick(client);
        break;
      case "human-reactor-tick":
        result = await ruleHumanReactorTick(client);
        break;
      case "monthly-sweep-tick":
        // Removido na Etapa 5. O sweep do dia 1º movia os finalizados para
        // Paciente antigo; no desenho de dois funis quem faz isso é a regra de
        // 60 dias em Pacientes. O cron `pipeline-monthly-sweep-paciente-antigo`
        // precisa ser desagendado — ver PLANO_IMPLEMENTACAO §3 Etapa 7, item 29.
        result = { skipped: "monthly_sweep_removido_etapa_5" };
        break;
      default:
        await persistTickStats({ ok: false, errorMessage: "unknown_action" });
        return new Response(
          JSON.stringify({ error: "unknown_action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    console.log(JSON.stringify({ action: body.action, result }));
    await persistTickStats({ ok: true, result });
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("pipeline-deterministic error", msg);
    await persistTickStats({ ok: false, errorMessage: msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

