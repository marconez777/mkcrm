---
title: "Bugs conhecidos do pipeline"
topic: kanban
kind: troubleshooting
audience: agent
updated: 2026-06-22
summary: "Bugs reportados e seu status. Resolvidos nas Fases A-D (2026-06-22): AI SDK structured outputs, whitelist dinâmica, advisory lock + backoff escalonado, cleanup G10. Aberto: stage_sequence_bindings dormente."
code_refs:
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-classify/agent-core.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-run-executor/index.ts
  - supabase/functions/automations-tick/index.ts
  - src/lib/manual-stage-move.ts
  - src/pages/Kanban.tsx
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/HUMAN_REACTOR.md
  - docs/pipeline/runtime/TAGS_LIVE.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
  - docs/pipeline/runtime/plan-correcoes.md
---

# Bugs conhecidos e limitações

## -10. `stage_sequence_bindings` dormente (ABERTO — 2026-06-22)

`SELECT count(*) FROM stage_sequence_bindings` = **3** em todo o projeto. O trigger `trg_enroll_on_stage_change` continua rodando em todo move de stage para olhar uma tabela praticamente vazia.

**Não é bug**, é dívida operacional. Custo agregado pequeno mas presente em ~100 moves/dia.

**Recomendação**: revisar em 30 dias (2026-07-22). Se ainda <10 bindings, desligar o trigger e arquivar a UI `message_sequences`. Ver `docs/pipeline/runtime/USER_AUTOMATIONS.md §Gap conhecido`.

## -9. Cleanup periódico do G10 (CORRIGIDO 2026-06-22 — Fase D/P28)

Coluna `leads.custom_fields_last_human_edit jsonb` acumulava timestamps indefinidamente; após 7d (janela do G10) as entradas eram lidas em todo classify mas sem efeito útil.

**Fix**: função `public.cleanup_g10_expired()` (SECURITY DEFINER) + cron `cleanup-g10-expired-daily` (`0 4 * * *` UTC). Drop de qualquer entrada com timestamp > 14d (margem dupla).

## -8. Advisory lock + backoff escalonado (CORRIGIDO 2026-06-22 — Fase B/P8+P9)

Fila `needs_ai_review` podia ter o mesmo lead processado por 2 workers concorrentes; falhas usavam backoff flat de 10 min (sem distinção transient vs persistente).

**Fix**:
- RPC `try_classify_lock(_lead_id)` via `pg_try_advisory_xact_lock` — `classifyOneV2` aborta com `skipped: 'locked_by_other_worker'` se já houver lock.
- `backoffMsForFail()` agora escalona 2 → 5 → 30 min conforme `leads.ai_review_fail_count` (coluna nova).
- `tickQueueV2` faz `.in("clinic_id", allowedClinicIds)` no SELECT (evita SELECT no universo de todas as clínicas).

## -7. Whitelist de tags dinâmica (CORRIGIDO 2026-06-22 — Fase A/P7+P20)

Whitelist hardcoded em `apply.ts` descartava 99% das tags sugeridas (278 descartadas / 6 aplicadas em 24h).

**Fix**: `app_settings.automation.v42.allowed_tags` (jsonb array). `agent-core.ts` injeta no system do Tipificador; `apply.ts` filtra contra ela. Adicionar tag = `UPDATE app_settings` (sem deploy). Ver `TAGS_LIVE.md §Whitelist`.

## -6. AI SDK structured outputs (CORRIGIDO 2026-06-22 — Fase A/P0)

12 erros `No object generated` em 48h (todos agentes) causados por uso de `@ai-sdk/openai-compatible` sem suporte a structured outputs.

**Fix**: `_shared/clinic-openai.ts` migrado para `createOpenAI` do `@ai-sdk/openai`. Schemas dos agentes (`schema.ts`) reativados como `z.object(...)` tipado em vez de `z.any()`. Erros zerados.

## -5. Leads MKart vazando no funil ÓR (CORRIGIDO 2026-06-21)

**Sintoma**: a coluna "Leads de entrada" do Kanban da ÓR mostrava 27 leads, mas 19 eram da clínica MKart (`clinic_id='d0a57fa2-10f2-4d86-888f-39f5d977705d'`) com `pipeline_id` apontando para o pipeline da ÓR (`17c27f4d-8256-4ea7-b5b9-ed706494f686`).

**Causa-raiz**: `leads.pipeline_id` / `leads.stage_id` não tinham FK composta `(clinic_id, *)`. Migração antiga ou import manual cruzou os IDs.

**Fix aplicado**:
- 1ª onda (20 leads): `UPDATE leads SET pipeline_id='7ee3b834-…', stage_id='f2ab32fd-de68-…'` filtrando `clinic_id` MKart + `pipeline_id` ÓR. Histórico em `lead_stage_history` com `reason='correcao_cross_clinic_or_to_mkart'`.
- 2ª onda (2 leads residuais, 2026-06-21): mesmo `UPDATE`, `reason='correcao_cross_clinic_or_to_mkart_residual'`.
- Trigger `trg_leads_enforce_coherence` (`BEFORE INS/UPD` de `clinic_id, pipeline_id, stage_id`) valida que `pipeline.clinic_id = lead.clinic_id` e `stage.pipeline_id = lead.pipeline_id`. Vide `TRIGGERS_AUDIT.md §2.3`.

**Como verificar regressão**:
```sql
SELECT count(*) FROM leads l
  JOIN pipelines p ON p.id = l.pipeline_id
 WHERE p.clinic_id <> l.clinic_id;
-- deve ser sempre 0
```

**Invariante**: nunca mover lead entre pipelines de clínicas diferentes. Toda edge function que faz `UPDATE leads SET pipeline_id/stage_id` deve buscar o destino dentro da mesma `clinic_id`.

## -4. `automations-tick` rodando cross-clinic (CORRIGIDO 2026-06-21)

**Sintoma**: 7.891 linhas em `automation_runs` onde `automation.clinic_id <> lead.clinic_id`. Risco de envio de WhatsApp/templates de uma clínica para leads de outra.

**Causa-raiz**: em `supabase/functions/automations-tick/index.ts`, a função `findCandidates()` consultava `leads` sem filtrar por `clinic_id`. Cada automação habilitada iterava o universo completo de leads do projeto, filtrando só por `stage_id`/`last_message_at` — sem isolamento de tenant.

**Fix aplicado**:
- 3 queries de `leads` em `findCandidates()` ganharam `.eq("clinic_id", a.clinic_id)` (branches `no_reply_after`, `stage_idle`, `before_appointment`).
- Guard defensivo no loop principal de `Deno.serve`: `if (lead.clinic_id !== a.clinic_id) { skipped++; console.warn(...); continue; }`.
- `UPDATE automation_runs SET status='failed_cross_clinic'` em 7.891 linhas históricas (preserva registro, exclui das métricas).
- Trigger `trg_automation_runs_clinic_coherence` (`BEFORE INS/UPD OF automation_id, lead_id`) bloqueia futuras gravações cross-clinic com `EXCEPTION` (errcode `check_violation`). Vide `TRIGGERS_AUDIT.md §2.3`.
- Snapshot pré-fix: `/mnt/documents/snapshot-automation-runs-cross-clinic-pre-fix.csv` (7.891 linhas).

**Como verificar regressão**:
```sql
SELECT count(*) FROM automation_runs ar
  JOIN automations a ON a.id = ar.automation_id
  JOIN leads       l ON l.id = ar.lead_id
 WHERE a.clinic_id <> l.clinic_id
   AND ar.status <> 'failed_cross_clinic';
-- deve ser sempre 0
```

**Invariante**: qualquer edge function que itere `automations × leads` (ou `sequences × leads`, `email_automations × leads`, etc.) **DEVE** filtrar `leads.clinic_id = parent.clinic_id` na própria query do Postgres. O trigger é a última linha de defesa, mas falha o run inteiro — não confiar nele para correção silenciosa. Auditoria completa em `/mnt/documents/auditoria-cross-clinic.md`.



## -3. Dispatcher do `pipeline-run-executor` não aceita `only_agent='parallel'` (ABERTO — 2026-06-21)

**Sintoma**: a UI `/pipeline-runs` oferece o botão "Só Paralelos" (Agendador + Tipificador + Movimentador), mas ao clicar nenhum dos três roda isoladamente — a request é descartada pelo backend.

**Causa-raiz**: em `supabase/functions/pipeline-run-executor/index.ts`:
- linha 88: `only_agent?: "summarizer" | "typifier" | "maestro"`
- linhas 229-231 e 421-422: whitelist literal `["summarizer", "typifier", "maestro"]`.

`parallel`, `agendador` e `movimentador` caem fora dessa lista e o campo é silenciosamente dropado, fazendo o executor rodar o flow completo (V6).

**Workaround**: usar "Completo (V6)" enquanto isso.

**Fix futuro**: estender a whitelist para incluir `agendador`, `movimentador` e o atalho `parallel`; em `agent-core.ts`, mapear `parallel` para rodar os 3 do meio em `Promise.all` pulando Resumidor/Maestro. Ver também `TRIGGERS_AUDIT.md §5 (G3)`.



## -2. Telemetria do classifier agrupada sob um único `operation` (CORRIGIDO 2026-06-20 — V6)

**Sintoma**: o painel `/metrics/ai-usage` mostrava o classifier como uma única linha (`classifier`), impossibilitando comparar custo/latência por agente quando a linha de montagem rodava de fato 3+ chamadas LLM em sequência.

**Causa-raiz**: ao paralelizar Agendador/Tipificador/Movimentador no `agent-core.ts`, todos os `recordStep()` da fase paralela gravavam sob a mesma `operation`, e o Resumidor/Maestro caíam em rótulos genéricos.

**Fix** (refator V6, `supabase/functions/pipeline-classify/agent-core.ts:350,378-380,403`):
- Cada agente grava **uma linha própria** em `ai_usage`:
  `classifier:summarizer` · `classifier:agendador` · `classifier:typifier` · `classifier:movimentador` · `classifier:maestro`.
- `lead_events.payload.agents` ganha modelo + latência + flag `ran` por agente (ver `EVENTS_TELEMETRY.md`).
- UI `/pipeline-runs` e card de Custos passaram a renderizar Resumidor → bloco "Execução Paralela" (3 cards) → Maestro.

**Status**: ✅ Corrigido (frontend + backend deployados 2026-06-20).


## -1. Triggers e crons silenciosamente quebrados por `extensions.http_post` (CORRIGIDO 2026-06-19)

**Sintoma**: 0 eventos `auto:novo-lead`, `auto:secretary-replied`, `auto:appointment-sync`, `auto:followup-*` em 24h. Fila `needs_ai_review` crescendo (440+) sem ser drenada. Em `net._http_response`: ~120 × 404 por hora.

**Causa-raiz**: a função `public.notify_pipeline_deterministic(...)` E 4 cron jobs (`pipeline-classify-tick`, `pipeline-inactivity-tick`, `pipeline-reactivation-tick`, `pipeline-human-reactor-tick`) chamavam `extensions.http_post(...)`. A extensão `http` **não está instalada** — só `pg_net` (schema `net`). Resultado:

- Triggers de pipeline: cada chamada quebrava, mas o `EXCEPTION WHEN OTHERS` na função engolia o erro → silêncio total.
- Crons: `cron.job_run_details.status='failed'` com `function extensions.http_post(...) does not exist`.

**Fix**:
- Migration: `notify_pipeline_deterministic` reescrita usando `net.http_post(...)` (com `SET search_path = public, extensions, net`).
- 4 crons reagendados via `cron.unschedule()` + `cron.schedule()` para usar `net.http_post(...)`.
- Backfill one-shot: `notify_pipeline_deterministic('novo-lead', …)` para todos os leads das últimas 24h + `secretary-replied` para a primeira `from_me` por lead em "Novo".

**Status**: ✅ Corrigido. Em 3 min após o fix: 100 `auto:classifier`, 0 erros 500, 404s reduzidos a 3 residuais, fila caiu de 457 → 376 e continua drenando.

**Schema drift correlato (mesma janela)**: tabela `lead_ai_settings` não tinha `current_stage_id`, `stage_entered_at`, `last_followup_at` — colunas referenciadas por `agent-followups-tick` e `ai-chat`, gerando 500s. Colunas criadas + backfill a partir de `leads.stage_id`/`stage_changed_at` + trigger `trg_sync_lead_ai_settings_stage` mantendo sincronizado. Agente de Follow-up agora roda.

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

## 8. Mismatch `trigger` em `stage_sequence_bindings` (CORRIGIDO)

CHECK aceita `'on_enter'|'on_exit'` (migration `20260618021516`). Código em `applyStageBindings` estava filtrando por `trigger='stage_enter'`. 

**Status**: ✅ Corrigido. A função `applyStageBindings` em `supabase/functions/_shared/stage-bindings.ts` foi atualizada para filtrar por `trigger='on_enter'`, alinhando-se com a constraint do banco de dados. Os bindings criados agora funcionarão corretamente em produção.
