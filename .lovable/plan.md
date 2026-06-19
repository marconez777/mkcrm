# Fase 1 V5 — Segurança + Wipe + SLA + Lock D3

Vou aplicar 6 mudanças. Diffs serão exibidos ao final.

## 1) `supabase/functions/ai-chat/index.ts` (tool `move_lead_stage`, linhas 226-256)

Mantém pre-checks de `lock_auto_move` (para preservar os erros granulares `stage_locked`/`stage_locked_source`) e substitui o `update({stage_id})` direto + insert manual em `lead_events` por chamada a `pipelineMove`:

```ts
import { pipelineMove } from "../_shared/pipeline-move.ts";
// ...
const moveRes = await pipelineMove(supabase, {
  leadId,
  toStageId: stage.id,
  source: "auto:ai-chat-tool",
  reason: `move_lead_stage via agent ${agent.name}`,
  ruleKey: "automation.ai_chat_move.enabled",
  idempotencyKey: `ai-chat:${agent.id}:${leadId}:${stage.id}:${Date.now()}`,
  metadata: { agent_id: agent.id, agent_name: agent.name },
});
if (!moveRes.moved) return { error: "move_blocked", reason: moveRes.reason, stage: stage.name };
// lead_events 'stage_changed_by_ai' continua sendo gravado p/ telemetria de UI.
```

## 2) `supabase/functions/automations-tick/index.ts` (action `move_stage`, linhas 266-317)

Remove o `update({stage_id})` direto + o "enriquecer histórico" manual (que duplicava lógica do helper). Tudo passa a ser uma chamada:

```ts
import { pipelineMove } from "../_shared/pipeline-move.ts";
// ...
const moveRes = await pipelineMove(supabase, {
  leadId,
  toStageId: stageId,
  source: "auto:automation-rule",
  reason: `automation:${a.id} (${a.trigger_type})`,
  ruleKey: "automation.ui_rule_move.enabled",
  idempotencyKey: `automation:${a.id}:${leadId}:${stageId}`,
  metadata: { automation_id: a.id, trigger_type: a.trigger_type },
});
return moveRes.moved ? { ok: true } : { ok: false, detail: moveRes.reason };
```

`pipelineMove` já cobre G2 (lock_auto_move), G5 (history) e G4 (idempotência).

## 3) `supabase/functions/_shared/pipeline-move.ts` — Wipe + D3 estreitado

**3a) Guard D3 (linha 176)** — apertar exceção para destino estrito "Nutrição inativa":
```ts
if (isAutoSource && fromStage?.name === PACIENTE_ANTIGO_NAME && toStage.name !== "Nutrição inativa") {
  return { moved: false, reason: "guard_d3_paciente_antigo" };
}
```
(Guard preservado — apenas a única saída permitida agora é Nutrição inativa.)

**3b) Wipe centralizado** — antes do `UPDATE leads` (linha 179), inserir:

```ts
// V5: wipe de chips ao trocar de stage. Mexemos APENAS na coluna JSONB
// leads.custom_fields (NUNCA em lead_custom_fields, que guarda o schema).
const wipedKeys: string[] = [];
if (
  (isAutoSource || source === "manual" || source === "ui") &&
  (fromStage?.name === "Qualificação" || toStage.name === "Consulta finalizada")
) {
  const { data: leadCF } = await client
    .from("leads")
    .select("custom_fields")
    .eq("id", leadId)
    .maybeSingle();
  const cur = (leadCF?.custom_fields ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...cur };
  if (fromStage?.name === "Qualificação" && "interessado" in next) {
    delete next.interessado;
    wipedKeys.push("interessado");
  }
  if (toStage.name === "Consulta finalizada") {
    for (const k of ["consulta_agendada_em", "procedimento_agendado_em", "consulta_confirmada", "procedimento_confirmado"]) {
      if (k in next) { delete next[k]; wipedKeys.push(k); }
    }
    next.aguardando = true;
    wipedKeys.push("+aguardando");
  }
  if (wipedKeys.length > 0) {
    const { error: wipeErr } = await client.from("leads").update({ custom_fields: next }).eq("id", leadId);
    if (wipeErr) console.warn("[pipeline-move] chip wipe failed", wipeErr); // non-blocking
  }
}
```

Anexo `wiped_keys: wipedKeys` ao `historyMeta` do G5.

## 4) `supabase/functions/pipeline-deterministic/index.ts` — SLA 60d Paciente antigo

Em `ruleInactivityTick` (linha 402+), depois do loop atual, adicionar branch independente (toggle próprio para não interferir nos demais):

```ts
const t60pa = await isEnabled(client, "automation.inactivity_paciente_antigo.enabled");
if (t60pa) {
  const cutoff60 = new Date(now - 60 * 24 * 3600 * 1000).toISOString();
  const paAliases = (aliases ?? []).filter((a) => a.canonical_name === "Paciente antigo");
  const paStageIds = new Set(paAliases.map((a) => a.stage_id));
  if (paStageIds.size > 0) {
    const { data: paLeads } = await client
      .from("leads")
      .select("id, clinic_id, pipeline_id, stage_id, last_message_at")
      .in("stage_id", Array.from(paStageIds))
      .is("archived_at", null)
      .eq("is_internal_contact", false)
      .lt("last_message_at", cutoff60)
      .limit(2000);
    for (const lead of paLeads ?? []) {
      const nutricaoId = nutricaoByPipeline.get(lead.pipeline_id);
      if (!nutricaoId) continue;
      const ym = new Date().toISOString().slice(0, 7);
      const res = await pipelineMove(client, {
        leadId: lead.id,
        toStageId: nutricaoId,
        source: "auto:inactivity-tick",
        reason: "60d sem inbound em Paciente antigo — Nutrição inativa",
        ruleKey: "automation.inactivity_paciente_antigo.enabled",
        idempotencyKey: `inactivity:paciente_antigo:${lead.id}:${ym}`,
      });
      if ((res as { moved?: boolean }).moved) {
        await logEvent(client, lead.clinic_id, lead.id, "auto:inactivity-paciente-antigo", { res });
      }
    }
  }
}
```

O Guard D3 atualizado em (3a) permite esse move (destino == "Nutrição inativa").

## 5) `supabase/functions/pipeline-classify/apply.ts` — Lock D3 no Classifier

Apenas adicionar o bloqueio de tentativa de move (G10 override de datas já existe nas linhas 162-209). Trocar `if (applyMaestro) {` (linha 245) por:

```ts
if (applyMaestro && ctx.stageName === "Paciente antigo") {
  stageOutcome = {
    ...stageOutcome,
    would_move: false,
    reason: "locked_in_paciente_antigo",
    path: "guard_d3",
  };
} else if (applyMaestro) {
  // ... bloco b2b/nurture/general existente intacto
}
```

Resultado: Classifier nem chama `pipelineMove` p/ esses leads.

## 6) Migration — toggles novos

```sql
INSERT INTO app_settings (key, value) VALUES
  ('automation.ai_chat_move.enabled', '"true"'),
  ('automation.ui_rule_move.enabled', '"true"'),
  ('automation.inactivity_paciente_antigo.enabled', '"true"')
ON CONFLICT (key) DO NOTHING;
```

## Regras de Ouro respeitadas
- Guard D3 mantido — só permite saída p/ "Nutrição inativa".
- Wipe usa SELECT + `{...cur}` spread + UPDATE em `leads.custom_fields` (JSONB). NUNCA toca em `lead_custom_fields`.
- Comentários, TODOs, `idempotencyKey` e `ruleKey` preservados em todas as chamadas.
- Não removo o early-return `unchanged` do ai-chat nem o `recentlyRan` cooldown do automations-tick.

## Validação pós-deploy
1. `move_lead_stage` via ai-chat em "Paciente antigo" → `guard_d3_paciente_antigo`.
2. Mover lead de "Qualificação" → outra → `custom_fields.interessado` removido.
3. Mover lead → "Consulta finalizada" → campos de agendamento sumiram, `aguardando=true`.
4. Cron move Paciente antigo (>60d sem msg) → Nutrição inativa.
5. Classifier em lead "Paciente antigo" → `would_move=false, reason='locked_in_paciente_antigo'`.

Aprove o plano p/ eu aplicar os diffs.