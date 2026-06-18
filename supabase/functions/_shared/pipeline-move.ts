// supabase/functions/_shared/pipeline-move.ts
//
// Helper único usado por TODA regra `auto:*` do pipeline v4.2 para mover
// cards entre stages. Centraliza os gates de segurança G1, G2, G3, G4, G5, G8
// + guard D3 (paciente antigo não sai do stage por automação).
//
// Uso típico dentro de uma edge function:
//
//   import { pipelineMove } from "../_shared/pipeline-move.ts";
//   const result = await pipelineMove(supabase, {
//     leadId,
//     toStageId,
//     source: "auto:appointment-agendado",
//     reason: "Appointment criado em /appointments com kind=consulta",
//     ruleKey: "automation.appointment_agendado.enabled",
//     idempotencyKey: `appointment:${appointmentId}:agendado`,
//     metadata: { appointment_id: appointmentId },
//   });
//   if (!result.moved) console.log("skip", result.reason);
//
// Importante:
// - NÃO escreve `pipeline_id` direto (G8: trigger `sync_lead_pipeline_id` deriva).
// - Sempre grava `lead_stage_history` com `source` preenchido (G5).
// - Sempre cria `lead_events.type='pipeline_move_attempted'` p/ idempotência (G4).
// - Lê o toggle em `app_settings` (G3). Default = false (fail-safe off).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type PipelineMoveSource =
  | `auto:${string}`
  | `reator:${string}`
  | `system:${string}`
  | "manual"
  | "ui";

export interface PipelineMoveInput {
  /** Lead a mover. */
  leadId: string;
  /** Stage destino. */
  toStageId: string;
  /** Origem do move — preenche `lead_stage_history.source` (G5). */
  source: PipelineMoveSource;
  /** Texto livre de auditoria — vira `lead_stage_history.reason`. */
  reason?: string;
  /**
   * Chave da automação em `app_settings` (G3). Ex: `automation.appointment_agendado.enabled`.
   * Se omitido, o gate de toggle é pulado (use só para `manual`/`ui`/`system:*`).
   */
  ruleKey?: string;
  /**
   * Chave única para idempotência (G4). Recomendado: combinar entidade + estado, ex.
   * `appointment:<uuid>:agendado`. Se já existir um `lead_events` com a mesma chave
   * para este lead, o move é tratado como já-feito e retorna `{moved: false, reason: 'idempotent'}`.
   */
  idempotencyKey?: string;
  /** Metadados extras gravados em `lead_stage_history.metadata`. */
  metadata?: Record<string, unknown>;
}

export type PipelineMoveResult =
  | { moved: true; fromStageId: string | null; toStageId: string }
  | { moved: false; reason: string };

const PACIENTE_ANTIGO_NAME = "Paciente antigo";

/**
 * Aplica todos os gates e move o card. Retorna `{moved, reason?}`.
 *
 * Gates aplicados nesta ordem:
 *  G3 — toggle off em app_settings → abort.
 *  G4 — `lead_events` já tem a `idempotencyKey` → abort idempotente.
 *  G1 — `leads.manual_lock_until > now()` e source começa com `auto:` → abort (lock manual).
 *  G2 — `pipeline_stages.lock_auto_move` no destino é true e source começa com `auto:` → abort.
 *  D3 — current_stage = "Paciente antigo" e source começa com `auto:` → abort (guard D3).
 *  G8 — UPDATE só toca em `stage_id` e `stage_changed_at` (nunca em `pipeline_id`).
 *  G5 — INSERT em `lead_stage_history` com `source` preenchido.
 */
export async function pipelineMove(
  client: SupabaseClient,
  input: PipelineMoveInput,
): Promise<PipelineMoveResult> {
  const {
    leadId,
    toStageId,
    source,
    reason,
    ruleKey,
    idempotencyKey,
    metadata,
  } = input;

  const isAutoSource = source.startsWith("auto:");

  // G3 — toggle (só vale para auto:*; reator/system/manual/ui sempre passam).
  if (ruleKey && isAutoSource) {
    const { data: setting, error: settingErr } = await client
      .from("app_settings")
      .select("value")
      .eq("key", ruleKey)
      .maybeSingle();
    if (settingErr) {
      return { moved: false, reason: `gate_g3_lookup_error:${settingErr.message}` };
    }
    if (!setting || String(setting.value).toLowerCase() !== "true") {
      return { moved: false, reason: `gate_g3_disabled:${ruleKey}` };
    }
  }

  // G4 — idempotência.
  if (idempotencyKey) {
    const { data: existing, error: evErr } = await client
      .from("lead_events")
      .select("id")
      .eq("lead_id", leadId)
      .eq("type", "pipeline_move_attempted")
      .contains("payload", { idempotency_key: idempotencyKey })
      .limit(1)
      .maybeSingle();
    if (evErr) {
      return { moved: false, reason: `gate_g4_lookup_error:${evErr.message}` };
    }
    if (existing) {
      return { moved: false, reason: `idempotent:${idempotencyKey}` };
    }
  }

  // Carrega lead + stage atual + stage destino (1 select cada para clareza).
  const { data: lead, error: leadErr } = await client
    .from("leads")
    .select("id, clinic_id, stage_id, manual_lock_until")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return { moved: false, reason: `lead_not_found:${leadErr?.message ?? leadId}` };
  }

  // G1 — lock manual.
  if (isAutoSource && lead.manual_lock_until) {
    const lockedUntil = new Date(lead.manual_lock_until).getTime();
    if (lockedUntil > Date.now()) {
      return { moved: false, reason: `gate_g1_manual_lock_until:${lead.manual_lock_until}` };
    }
  }

  // No-op se já está no destino.
  if (lead.stage_id === toStageId) {
    return { moved: false, reason: "already_at_destination" };
  }

  // Carrega stages (origem + destino).
  const { data: stages, error: stagesErr } = await client
    .from("pipeline_stages")
    .select("id, name, lock_auto_move")
    .in("id", [lead.stage_id, toStageId].filter(Boolean) as string[]);
  if (stagesErr) {
    return { moved: false, reason: `stages_lookup_error:${stagesErr.message}` };
  }
  const fromStage = stages?.find((s) => s.id === lead.stage_id) ?? null;
  const toStage = stages?.find((s) => s.id === toStageId) ?? null;
  if (!toStage) {
    return { moved: false, reason: `to_stage_not_found:${toStageId}` };
  }

  // G2 — destino com lock_auto_move.
  if (isAutoSource && toStage.lock_auto_move) {
    return { moved: false, reason: `gate_g2_destination_locked:${toStage.name}` };
  }

  // Guard D3 — paciente antigo não sai do stage por automação.
  if (isAutoSource && fromStage?.name === PACIENTE_ANTIGO_NAME) {
    return { moved: false, reason: "guard_d3_paciente_antigo" };
  }

  // G8 — UPDATE limitado a stage_id + stage_changed_at.
  const { error: updErr } = await client
    .from("leads")
    .update({
      stage_id: toStageId,
      stage_changed_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (updErr) {
    return { moved: false, reason: `update_failed:${updErr.message}` };
  }

  // G5 — history.
  const historyMeta = {
    ...(metadata ?? {}),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    rule_key: ruleKey ?? null,
  };
  const { error: histErr } = await client.from("lead_stage_history").insert({
    clinic_id: lead.clinic_id,
    lead_id: leadId,
    from_stage_id: lead.stage_id,
    to_stage_id: toStageId,
    source,
    reason: reason ?? null,
    metadata: historyMeta,
  });
  if (histErr) {
    // Não revertemos o move (a UI já reflete o novo stage); logamos como warning.
    console.warn("[pipeline-move] history insert failed", histErr);
  }

  // G4 — marca idempotência.
  if (idempotencyKey) {
    await client.from("lead_events").insert({
      clinic_id: lead.clinic_id,
      lead_id: leadId,
      type: "pipeline_move_attempted",
      payload: {
        idempotency_key: idempotencyKey,
        source,
        from_stage_id: lead.stage_id,
        to_stage_id: toStageId,
        rule_key: ruleKey ?? null,
      },
    });
  }

  // A2 (Marco 2.5) — hook não-bloqueante para o verificador pós-move.
  // Só dispara em moves automáticos. O verifier aplica seus próprios gates
  // (toggle automation.post_move_verifier.enabled + rules_enabled whitelist).
  if (isAutoSource) {
    try {
      const supaUrl = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(
        "SUPABASE_URL",
      );
      const serviceKey = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );
      if (supaUrl && serviceKey) {
        const verifierPromise = fetch(`${supaUrl}/functions/v1/pipeline-post-move-verifier`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            lead_id: leadId,
            from_stage_id: lead.stage_id,
            to_stage_id: toStageId,
            source,
            rule_key: ruleKey ?? null,
          }),
        }).catch((err) => {
          console.warn("[pipeline-move] post-move-verifier dispatch failed", err);
        });
        // Não esperamos a resposta no caminho crítico.
        const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
        if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(verifierPromise);
      }
    } catch (err) {
      console.warn("[pipeline-move] post-move-verifier hook error", err);
    }
  }

  return { moved: true, fromStageId: lead.stage_id ?? null, toStageId };
}
