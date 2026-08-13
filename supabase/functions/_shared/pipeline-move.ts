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
import { isClinicPipelineAllowed } from "./pipeline-allowlist.ts";
import { isAiAllowedForPipeline } from "./ai-pipeline-filter.ts";

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
 *  G2 — `pipeline_stages.lock_auto_move` no destino é true e source começa com `auto:` → abort.
 *  D3 — current_stage = "Paciente antigo" e source começa com `auto:` → abort (guard D3).
 *  G8 — UPDATE toca em `stage_id`; `pipeline_id` SÓ em travessia entre funis,
 *       porque `trg_leads_enforce_coherence` roda antes do sync e exigiria os
 *       dois coerentes no mesmo statement. `stage_changed_at` é gravado pelo
 *       trigger BEFORE `leads_stage_changed` e lido de volta como instante
 *       canônico do movimento (base da deduplicação do histórico).
 *  G9 — travessia entre pipelines exige linha declarada em `pipeline_crossings`.
 *  G5 — INSERT em `lead_stage_history` com `source` preenchido.
 *
 * PR4 — gate G1 (manual_lock_until) removido. A feature foi descontinuada.
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
    .select("id, clinic_id, stage_id, pipeline_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return { moved: false, reason: `lead_not_found:${leadErr?.message ?? leadId}` };
  }

  // Allowlist por clínica (Marco 4.5) — só fontes automáticas são gateadas.
  if (isAutoSource && !(await isClinicPipelineAllowed(client, lead.clinic_id))) {
    return { moved: false, reason: "clinic_not_allowlisted" };
  }

  // Filtro de pipelines da IA (clinics.settings.ai_target_pipeline_ids).
  // Lista vazia/ausente = todos os pipelines. Só gateia fontes automáticas.
  if (
    isAutoSource &&
    !(await isAiAllowedForPipeline(client, lead.clinic_id, (lead as { pipeline_id?: string }).pipeline_id))
  ) {
    return { moved: false, reason: "pipeline_not_in_ai_targets" };
  }

  // PR4 — gate G1 (manual_lock_until) removido.


  // No-op se já está no destino.
  if (lead.stage_id === toStageId) {
    return { moved: false, reason: "already_at_destination" };
  }

  // Carrega stages (origem + destino).
  const { data: stages, error: stagesErr } = await client
    .from("pipeline_stages")
    .select("id, name, lock_auto_move, pipeline_id")
    .in("id", [lead.stage_id, toStageId].filter(Boolean) as string[]);
  if (stagesErr) {
    return { moved: false, reason: `stages_lookup_error:${stagesErr.message}` };
  }
  const fromStage = stages?.find((s) => s.id === lead.stage_id) ?? null;
  const toStage = stages?.find((s) => s.id === toStageId) ?? null;
  if (!toStage) {
    return { moved: false, reason: `to_stage_not_found:${toStageId}` };
  }

  // G9 — TRAVESSIA ENTRE PIPELINES.
  // Mudar de funil não pode ser efeito colateral do trigger que deriva
  // `pipeline_id`. Automação só atravessa se houver linha declarada e habilitada
  // em `pipeline_crossings`. Humano e scripts administrativos passam direto.
  // Ver docs/tenants/clinica-or/FLUXO_ALVO.md §4.
  const isCrossing =
    !!fromStage?.pipeline_id &&
    !!toStage.pipeline_id &&
    fromStage.pipeline_id !== toStage.pipeline_id;

  if (isCrossing) {
    const isHumanOrAdmin =
      source === "manual" || source === "ui" || source.startsWith("system:");

    if (!isHumanOrAdmin) {
      const { data: crossings, error: crossErr } = await client
        .from("pipeline_crossings")
        .select("trigger_key, allow_auto")
        .eq("clinic_id", lead.clinic_id)
        .eq("from_stage_id", lead.stage_id)
        .eq("to_stage_id", toStageId)
        .eq("enabled", true);
      if (crossErr) {
        return { moved: false, reason: `gate_g9_lookup_error:${crossErr.message}` };
      }

      // A regra pode declarar `trigger_key` específico ou '*' (qualquer origem).
      const match = (crossings ?? []).find(
        (c) => c.trigger_key === "*" || c.trigger_key === source,
      );
      if (!match) {
        return { moved: false, reason: `gate_g9_crossing_not_declared:${source}` };
      }
      if (!match.allow_auto) {
        return { moved: false, reason: "gate_g9_crossing_human_only" };
      }
    }
  }

  // G2 — destino com lock_auto_move.
  if (isAutoSource && toStage.lock_auto_move) {
    return { moved: false, reason: `gate_g2_destination_locked:${toStage.name}` };
  }

  // Guard D3 — paciente antigo não sai do stage por automação, EXCETO p/
  // "Nutrição inativa" ou "Nutrição Antigos" (saídas executadas por cron de inatividade).
  if (
    isAutoSource &&
    fromStage?.name === PACIENTE_ANTIGO_NAME &&
    toStage.name !== "Nutrição inativa" &&
    toStage.name !== "Nutrição Antigos"
  ) {
    return { moved: false, reason: "guard_d3_paciente_antigo" };
  }

  // V5 — Wipe centralizado de chips (custom_fields JSONB em leads).
  // NUNCA tocar em lead_custom_fields (essa tabela guarda a DEFINIÇÃO dos campos,
  // não os valores). Manipulamos o objeto JSONB com spread e UPDATE atômico.
  const wipedKeys: string[] = [];
  const shouldWipe =
    fromStage?.name === "Qualificação" || toStage.name === "Consulta finalizada";
  if (shouldWipe) {
    const { data: leadCF } = await client
      .from("leads")
      .select("custom_fields")
      .eq("id", leadId)
      .maybeSingle();
    const cur = (leadCF?.custom_fields ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...cur };
    if (fromStage?.name === "Qualificação" && "interesse" in next) {
      delete next.interesse;
      wipedKeys.push("interesse");
    }
    if (toStage.name === "Consulta finalizada") {
      for (const k of [
        "consulta_agendada_em",
        "procedimento_agendado_em",
        "consulta_confirmada",
        "procedimento_confirmado",
      ]) {
        if (k in next) {
          delete next[k];
          wipedKeys.push(k);
        }
      }
      next.aguardando = true;
      wipedKeys.push("+aguardando");
    }
    if (wipedKeys.length > 0) {
      const { error: wipeErr } = await client
        .from("leads")
        .update({ custom_fields: next })
        .eq("id", leadId);
      if (wipeErr) console.warn("[pipeline-move] chip wipe failed", wipeErr); // non-blocking
    }
  }

  // G8 — UPDATE limitado a stage_id (+ pipeline_id APENAS em travessia).
  //
  // `stage_changed_at` é sobrescrito pelo trigger BEFORE `leads_stage_changed`
  // com o `now()` da transação — por isso lemos de volta o valor real: ele é o
  // INSTANTE CANÔNICO do movimento e a chave da deduplicação (ver abaixo).
  //
  // ⚠️ TRAVESSIA EXIGE ESCREVER `pipeline_id` NO MESMO UPDATE.
  // Triggers BEFORE disparam em ordem alfabética, então
  // `trg_leads_enforce_coherence` roda ANTES de `trg_leads_sync_pipeline`. Ao
  // mover para uma coluna de outro funil mandando só `stage_id`, a validação vê
  // `NEW.stage_id` no funil novo e `NEW.pipeline_id` ainda no antigo e levanta
  // `stage_id % belongs to pipeline %, not lead.pipeline_id %` — a sincronização
  // que corrigiria isso nunca chega a rodar. Mandando os dois juntos, a validação
  // passa e o sync apenas reescreve o mesmo valor.
  const updatePayload: Record<string, unknown> = { stage_id: toStageId };
  if (isCrossing) updatePayload.pipeline_id = toStage.pipeline_id;

  const { data: moved, error: updErr } = await client
    .from("leads")
    .update(updatePayload)
    .eq("id", leadId)
    .select("stage_changed_at")
    .maybeSingle();
  if (updErr) {
    return { moved: false, reason: `update_failed:${updErr.message}` };
  }
  const movedAt = (moved as { stage_changed_at?: string } | null)?.stage_changed_at
    ?? new Date().toISOString();

  // G5 — history.
  //
  // UPSERT, não INSERT. O trigger `record_lead_stage_history` já criou a linha
  // durante o UPDATE acima, com `moved_at = NEW.stage_changed_at` e source
  // genérico ('system' ou 'manual'). Como usamos o MESMO `moved_at`, o índice
  // único colide e nós ENRIQUECEMOS aquela linha com o source real, o motivo e o
  // metadata — em vez de criar uma segunda.
  //
  // Era essa segunda linha que produzia 18% de duplicação no histórico.
  // `moved_by_user_id` fica de fora do payload de propósito: o valor que o
  // trigger gravou a partir de `auth.uid()` deve prevalecer.
  const historyMeta = {
    ...(metadata ?? {}),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    ...(wipedKeys.length > 0 ? { wiped_keys: wipedKeys } : {}),
    rule_key: ruleKey ?? null,
  };
  const { error: histErr } = await client
    .from("lead_stage_history")
    .upsert(
      {
        clinic_id: lead.clinic_id,
        lead_id: leadId,
        from_stage_id: lead.stage_id,
        to_stage_id: toStageId,
        from_pipeline_id: fromStage?.pipeline_id ?? null,
        to_pipeline_id: toStage.pipeline_id ?? null,
        from_stage_name: fromStage?.name ?? null,
        to_stage_name: toStage.name,
        moved_at: movedAt,
        source,
        reason: reason ?? null,
        metadata: historyMeta,
      },
      { onConflict: "lead_id,to_stage_id,moved_at" },
    );
  if (histErr) {
    // Não revertemos o move (a UI já reflete o novo stage); logamos como warning.
    console.warn("[pipeline-move] history upsert failed", histErr);
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

  // Marco 4 — stage_sequence_bindings (não bloqueia).
  try {
    const { applyStageBindings } = await import("./stage-bindings.ts");
    const bindingsPromise = applyStageBindings(client, leadId, lead.clinic_id, toStageId).catch((err) =>
      console.warn("[pipeline-move] stage-bindings failed", err),
    );
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(bindingsPromise);
  } catch (err) {
    console.warn("[pipeline-move] stage-bindings hook error", err);
  }

  return { moved: true, fromStageId: lead.stage_id ?? null, toStageId };
}
