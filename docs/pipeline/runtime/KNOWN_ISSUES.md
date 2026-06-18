---
title: "Bugs conhecidos do pipeline"
topic: kanban
kind: troubleshooting
audience: agent
updated: 2026-06-18
summary: "Bugs reportados e seu status: tag 1ª consulta em paciente antigo (CORRIGIDO), data 19/06 vs 18/06 (CORRIGIDO via fmtBR + sanitizeDateField), lock manual sem botão Destravar (CORRIGIDO), gaps estruturais (G10 ausente, whitelist de tags não enforced)."
code_refs:
  - supabase/functions/pipeline-classify/index.ts
  - src/lib/manual-stage-move.ts
  - src/pages/Kanban.tsx
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/HUMAN_REACTOR.md
  - docs/pipeline/runtime/TAGS_LIVE.md
---

# Bugs conhecidos e limitações

## 0. Fila "IA na fila" não drenava (CORRIGIDO 2026-06-18)

**Sintoma**: badge "IA na fila" persistindo horas/dias em cards (256 leads acumulados, mais antigo de 11/06).

**Causas**:
1. `pipeline-classify/index.ts` (V2): skips `clinic_not_allowlisted` e `no_new_messages` escreviam telemetria + watermark mas **não** limpavam `needs_ai_review`. Leads não-allowlistados ficavam para sempre na fila.
2. O tick ordena por `ai_review_queued_at ASC` em batches de 50. Como 235/256 leads eram de clínicas fora da allowlist (e os mais antigos), cada tick era 100% consumido em skips e os 21 leads da ÓR (única allowlistada) raramente eram alcançados.

**Fix**:
- Nova função `clearQueueFlag()` em `pipeline-classify/index.ts` zera `needs_ai_review`, `ai_review_reasons` e `ai_review_queued_at` em **qualquer** caminho de skip.
- Limpeza one-shot: `UPDATE leads SET needs_ai_review=false, ai_review_reasons=array_remove(..., 'pipeline-classifier'), ai_review_queued_at=NULL WHERE needs_ai_review AND clinic_id NOT IN (SELECT clinic_id FROM pipeline_automation_allowlist WHERE enabled)` — derrubou de 256 para 21.

**Status**: ✅ Corrigido. Fila drena no ritmo do cron (1/min, 5 paralelos).



## 1. Tag "1ª consulta" aplicada a paciente antigo (CORRIGIDO)

**Reportado por**: usuário em 2026-06-18 — "o paciente está ativo há 5 anos, e não era a primeira consulta".

**Causa**: o classifier não tinha contexto de idade do lead nem histórico de stages, então sugeria "1ª consulta" para qualquer mensagem que pareça de marcação inicial.

**Fix aplicado**:
- `pipeline-classify/index.ts:194-204` — `LeadContext` agora inclui `ageHuman`, `totalMessages`, `firstMessageAt`, `recentStageHistory` (com nomes de stage), `hasBeenTreatedBefore`.
- Prompt do sistema (linhas 256–259) inclui **REGRAS ESPECÍFICAS DE TAG "1ª consulta"**: nunca aplicar se lead >90d, ou já passou por `{Em tratamento, Consulta finalizada, Paciente antigo}`, ou tem tag `paciente_antigo`. Se a tag já estiver no lead nessas condições, OBRIGATORIAMENTE incluir em `tags_remove`.
- `tags_remove` é processado quando `automation.classifier.tag_replace.enabled=true` (atualmente true).

**Status**: ✅ Corrigido. Próxima classificação do lead remove a tag stale.

## 2. Data "consulta_agendada_em" 19/06 quando era 18/06 (CORRIGIDO)

**Reportado por**: usuário em 2026-06-18 — chip "Consulta 19/06" sendo a mensagem do dia 18.

**Causas**:
- Mensagens eram formatadas com `created_at.slice(0,16)` (UTC raw). 18:07 UTC vira "2026-06-18T18:07" no prompt, mas o real BRT é 15:07 do dia 18 → o modelo via "amanhã" partindo de um momento errado.
- O modelo resolvia datas relativas ("quinta", "amanhã") a partir de `now()` em vez do timestamp da mensagem.
- Nenhuma validação server-side rejeitava data no passado ou muito distante.

**Fix aplicado**:
- `pipeline-classify/index.ts:164-180` — função `fmtBR()` formata todo timestamp em `America/Sao_Paulo` via `Intl.DateTimeFormat('pt-BR')`. Mensagens e `LeadContext` usam esse helper.
- Prompt do sistema (linhas 261–266) — **REGRAS PARA DATAS**: relativas resolvidas a partir do timestamp da **mensagem** que cita a data, não de `now()`. Formato ISO obrigatório com offset `-03:00`. Ambiguidade → não preencher.
- `sanitizeDateField()` (linhas 290–306) — rejeita `t < anchor-2h` (`in_past`), rejeita `t > anchor+90d` (`too_far_future`). `anchor` = timestamp da última mensagem lida.
- Rejeições registradas em `lead_events.payload.applied.custom_fields_rejected[]`.

**Status**: ✅ Corrigido. Verificar via:

```sql
SELECT lead_id, created_at,
       payload->'applied'->'custom_fields_rejected' AS rejections
FROM lead_events
WHERE type='auto:classifier'
  AND jsonb_array_length(payload->'applied'->'custom_fields_rejected') > 0
ORDER BY created_at DESC;
```

## 3. Lock manual sem botão "Destravar" (CORRIGIDO)

**Reportado por**: usuário em 2026-06-18 — "como remove a tag [Lock manual]?".

**Estado anterior**: chip estático no card. Único jeito de tirar era esperar 7d ou editar `manual_lock_until=NULL` no banco.

**Fix aplicado**:
- `src/pages/Kanban.tsx:315-356` — componente `LockManualChip` clicável. Hover mostra "Destravar"; click abre `AlertDialog` confirmando; OK chama `unlockLeadManually()`.
- `src/lib/manual-stage-move.ts:21-51` — `unlockLeadManually(client, leadId)` zera `manual_lock_until` e grava `lead_events.type='manual:unlock'` com `previous_lock_until` e `by_user_id` (best-effort).
- Realtime na tabela `leads` atualiza o Kanban automaticamente.

**Status**: ✅ Corrigido.

## 4. Tag de paciente "1ª consulta" não está na whitelist nem é validada (GAP estrutural)

A whitelist `automation.v42.allowed_tags` em `app_settings` **não é consultada por código**. O classifier escreve qualquer string que sair de `tags_suggested`. Por isso o snapshot mostra tags como `audit:b22`, `PHQ-9 Depressão`, `LEAD TRÁFEGO` convivendo com as tags de sistema.

**Status**: não corrigido. Impacto baixo (não quebra nada), mas dificulta análises.

**Sugestão**: criar `_shared/tag-whitelist.ts` lido pelo classifier antes do UPDATE — silenciosamente descarta o que não está na whitelist + tags listadas em manual-tags da clínica.

## 5. Gate G10 — implementado em 2026-06-18 (Classifier V2)

**Status: CORRIGIDO** via:

- Migration `20260618...g10_human_edits.sql`: coluna `leads.custom_fields_last_human_edit jsonb` + trigger `track_custom_fields_human_edits` (BEFORE UPDATE) que marca por chave quando o ator não é `'system'`.
- RPC `apply_lead_automation_patch` (SECURITY DEFINER) seta `app.actor='system'` na transação — o classifier V2 sempre usa essa RPC.
- `pipeline-classify/apply.ts` lê `custom_fields_last_human_edit[key]` e, se < 7d, descarta a sugestão da IA. Bloqueios aparecem em `lead_events.payload.applied.custom_fields.blocked_by_g10`.

**Limitação remanescente**: outras edge functions automáticas (`pipeline-deterministic`, `pipeline-fase4`, `pipeline-move`) que escrevem em `custom_fields` ainda **não** usam a RPC — seus writes são marcados como "humanos" pelo trigger. Isso na prática faz o classifier respeitar regras determinísticas (efeito desejável), mas se elas mesmas precisarem se sobrescrever, vão se autobloquear pela janela de 7d. Acompanhar e migrar para a RPC se observado.

## 5b. Strict no-move — cards podem acumular em Qualificação até Fase 2

A partir de 2026-06-18 (Classifier V2), **nenhum** stage_suggestion é executado automaticamente, exceto o caminho B2B com guards rígidos (`confidence ≥ 0.95` + `tags_suggested` inclui `b2b` + lead nunca tratado). Cards que deveriam ir para "Consulta agendada" / "Tratamento agendado" / etc. ficam estacionados na coluna atual.

**Mitigação**: Fase 2 (webhook SumUp + `appointment-extractor`) vai mover esses cards com base em sinal determinístico, não em LLM. Até lá, a secretária move manualmente.


## 6. `auto:novo-lead`, `auto:secretary-replied`, `auto:appointment-sync` com 0 eventos em 30d

Triggers + edge function existem, toggles estão ligados. Mas `lead_events` não mostra ocorrências. Hipóteses:

- (a) `pg_net.http_post` falhando silenciosamente (a função wrapper engole exceções).
- (b) As regras estão rodando mas não chegam a inserir o evento (ex.: lead já em "Novo" pula com `already_in_stage` sem logar).
- (c) Crons criadas após eventos antigos terem expirado.

**Como diagnosticar**:

```sql
-- pg_net deliveries (últimas 24h)
SELECT id, url, status_code, error_msg, created
FROM net._http_response
WHERE created > now() - interval '24 hours'
  AND url LIKE '%pipeline-deterministic%'
ORDER BY created DESC LIMIT 20;
```

**Status**: a investigar. Não bloqueia operação (regras tomam decisões idempotentes), mas degrada observabilidade.

## 7. `consulta_agendada_em` sem definição em `lead_custom_fields`

Classifier escreve essa chave no JSONB de `leads.custom_fields`, mas a UI de campos custom não a mostra (só `procedimento_agendado_em` foi cadastrada). Provável esquecimento na migration de Fase 0.5.

**Status**: cosmético — o valor é salvo, só não aparece como campo gerenciado.

## 8. Mismatch `trigger` em `stage_sequence_bindings`

CHECK aceita `'on_enter'|'on_exit'` (migration `20260618021516`). Código em `applyStageBindings` filtra por `trigger='stage_enter'` (sem underscore antes do 'enter'). **Bindings novos com `'on_enter'` não vão disparar**, e bindings com `'stage_enter'` violariam o CHECK.

**Status**: bug latente — só ativa se alguém criar bindings. Antes de ligar `automation.stage_bindings.enabled` em produção, alinhar os dois nomes.
