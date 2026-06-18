---
title: "Pipeline — Plano de automação v3 (priorizado)"
topic: kanban
kind: roadmap
audience: agent
updated: 2026-06-18
summary: "Roadmap em fases para automatizar o pipeline. Arquitetura: 1 Classifier + 1 Summarizer + Rule Engine determinístico. Fase 1 já move cards de agenda sozinha via appointments.status."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/DATABASE.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Plano de automação v3 — pipeline

Premissa: **começar pequeno, observável e reversível.** O agente anterior foi removido por ser opaco demais. Cada regra abaixo tem toggle independente em `app_settings`, off by default.

## Arquitetura final

```text
inbound WhatsApp ──► Orchestrator (código)
                       ├─► Classifier (LLM, 1 agente, stateless)
                       │     output: intent, tags, custom_fields_patch,
                       │             urgency, suggested_stage_id, confidence
                       │
                       ├─► Summarizer (LLM, 1 agente, incremental)
                       │     output: ai_summary atualizado
                       │
                       └─► Rule Engine (código puro, 0 LLM)
                             ├─ aplica 10 gates de segurança
                             ├─ MERGE tags / SET custom_fields
                             ├─ move stage (se permitido)
                             └─ grava lead_stage_history + lead_events

appointments.status ──► Rule Engine direto (5 regras auto:appointment-*)
cron horário ────────► Rule Engine direto (inactivity-5d, reminder-d1)
```

**O que NÃO fazemos:** ❌ 12 agentes por coluna, ❌ agente "gerente" via LLM, ❌ RAG com embeddings agora, ❌ auto-reply via pipeline (já existe agente separado).

## 10 gates de segurança obrigatórios em TODA regra `auto:*`

| # | Gate | Cobertura |
|---|---|---|
| G1 | `leads.manual_lock_until > now()` → não move stage (continua escrevendo tags/fields/summary) | E6 |
| G2 | `pipeline_stages.lock_auto_move` no destino → aborta movimentação | E10, P4 |
| G3 | `app_settings.automation.<rule>.enabled = true` → aborta se off | kill switch |
| G4 | Idempotência via `lead_events` antes de agir | E2 |
| G5 | `lead_stage_history.source = 'auto:<rule>'` sempre preenchido | auditoria |
| G6 | Tags: SEMPRE `MERGE` (`array_cat`+`distinct`), NUNCA `SET` | E7, R1 |
| G7 | `qualificacao='desqualificado'` exige `motivo_desqualificacao` no mesmo UPDATE | E8, R2 |
| G8 | NUNCA escrever `leads.pipeline_id` direto (trigger deriva) | E9, R3 |
| G9 | Custom fields enum-validados usam strings exatas do enum (ver `CUSTOM_FIELDS_E_TAGS.md`) | R4 |
| G10 | Para a mesma `custom_fields.<key>`, valor humano-escrito nos últimos 7 dias NÃO é sobrescrito por classifier (mesmo com confidence alta) — só mostra sugestão na UI | precedência humano>IA |

Stages excluídos de scans temporais (`auto:inactivity-5d` etc.): `Paciente antigo`, `Nutrição inativa`, `B2B`, `Desqualificado`, **+ qualquer lead com `appointments.scheduled_at > now()`**.

---

## Fase 0 — Infra (1 dia, sem LLM)

Migration única + helpers + UI read-only.

- [ ] Migration:
  - `UPDATE pipeline_stages SET lock_auto_move=true WHERE name='Procedimento pago' AND pipeline_id='<ÓR>'`
  - `ALTER TABLE leads ADD COLUMN last_processed_message_id_classifier uuid REFERENCES messages(id)`
  - `ALTER TABLE leads ADD COLUMN last_processed_message_id_summarizer uuid REFERENCES messages(id)`
  - `CREATE TABLE stage_sequence_bindings (...)` — schema em `DATABASE.md`
  - `INSERT INTO app_settings ('automation.<rule>.enabled', 'false', ...)` para as 13 regras
- [ ] Helper `supabase/functions/_shared/pipeline-move.ts`:
  - Recebe `lead_id`, `to_stage_id`, `source`, `reason`, `metadata`, `idempotency_key`
  - Aplica G1, G2, G3, G4, G5, G8
  - Grava `lead_stage_history` + `lead_events`
  - Retorna `{moved: boolean, reason?: string}`
- [ ] Página `/admin/pipeline-automations` (read-only): lista 13 regras + toggles + métricas 7d.

## Fase 0.5 — Campos custom faltantes (1 dia)

O estudo exige 8 campos que não existem em `lead_custom_fields`. Lista completa em `CUSTOM_FIELDS_E_TAGS.md`. Criar todos antes da Fase 1, ou regras vão escrever em chaves que a UI não mostra.

Principais:
- `nome_responsavel_financeiro` (text)
- `possui_liminar_judicial` (boolean)
- `saldo_sessoes_pacote` (number)
- `sessoes_realizadas` (number)
- `pagamento_alegado_em` (timestamp)
- `data_solicitacao_nf` (timestamp)
- `modalidade_preferida` (enum: presencial|online|qualquer)
- `motivo_desqualificacao` (enum: fora_de_escopo_geografico|sem_fit_clinico|outro)

## Fase 1 — Quick wins de alto volume (1 semana, sem LLM)

Regras determinísticas. Código puro. **Fase 1 já nasce movendo cards de agenda sozinha.**

### 1.1 Motor `auto:appointment-*` (5 regras, mesma trigger Postgres)

Trigger em `INSERT OR UPDATE OF status` em `appointments` chama edge function `pipeline-appointment-sync`. Idempotência única por `(appointment_id, status)` via `lead_events.type='appointment_status_synced'`.

| Regra | Trigger | Ação |
|---|---|---|
| `auto:appointment-agendado` | INSERT, `status='agendado'` | `kind='consulta'` → mover lead para `Consulta agendada`. `kind='procedimento'` → mover para `Procedimento agendado`. **Fecha o bug do estudo** ("pagou a consulta e ficou em Qualificação"). |
| `auto:appointment-realizado` | UPDATE, `status='realizado'`, `kind='consulta'` | Mover lead para `Consulta finalizada`. Dispara enrollment de pesquisa pós-consulta (C13/C14). |
| `auto:appointment-faltou` | UPDATE, `status='faltou'` | Mover para `Sem resposta` + tag `no_show` + task "Reagendar" D+1. |
| `auto:appointment-cancelado` | UPDATE, `status='cancelado'` | Mover para `Qualificação` + tag `reagendamento_pendente` + task "Oferecer novo horário". |
| `auto:procedure-realizado` | UPDATE, `status='realizado'`, `kind='procedimento'` | Se 1ª sessão do ciclo (não existe `lead_events.type='session_counted'` anterior): mover para `Em tratamento`, criar evento `session_counted` com `payload.session_number=1`. Senão: incrementar `custom_fields.sessoes_realizadas`, criar `session_counted` com número, **não move**. |

**Importante**: G2 garante que `auto:appointment-realizado` para `kind='procedimento'` em lead já em `Procedimento pago` move via `auto:procedure-realizado` (não para `Consulta finalizada`).

### 1.2 Inatividade e reativação

| Regra | Trigger | Ação |
|---|---|---|
| `auto:inactivity-5d` | Cron horário | Move leads com `last_message_at < now()-5d`, **excluindo** stages finais (`Paciente antigo`, `Nutrição inativa`, `B2B`, `Desqualificado`) **e** leads com `appointments.scheduled_at > now()`. Destino: `Sem resposta`. Grava `inactivity_detected`. |
| `auto:reactivation` | `evolution-webhook` (inbound) em lead em `Sem resposta` ou `Nutrição inativa` | Decisão por tags: `no_show` → `Consulta agendada` + tag `reagendamento_solicitado` + task; `reagendamento_pendente` → idem; senão → `Qualificação` + tag `reativacao`. Se G1 (lock manual): só tag `reativacao_durante_lock` + notifica, **não move**. |
| `auto:reminder-d1` | Cron horário | Para `appointments.scheduled_at` em [+18h,+36h] e `status='agendado'`, envia template único. Dedup por `lead_events.type='reminder_sent'` + `payload.appointment_id`. **Não move stage.** |
| `auto:modality-guard` | Pré-envio de template | Bloqueia template com `{{endereco}}` se `custom_fields.modalidade='online'`. |

### Critério de aceite da Fase 1

- Cada regra tem teste unitário (happy + dedup + G1/G2/G3).
- Todas off-by-default em `app_settings`.
- Ligar 1 regra por vez, com janela de 48h de observação antes da próxima.

---

## Fase 2 — Classifier LLM (2 semanas)

Edge function `pipeline-classify`. Roda em todo inbound (debounce 5s). Saída via `Output.object` (Zod schema).

**Input**: `last_processed_message_id_classifier`, `leads.ai_summary` (se houver), `custom_fields`, `tags`, `stage` atual, novas mensagens.
**Output (Zod)**:
```ts
{
  intent: 'agendar' | 'reagendar' | 'pagar' | 'nf_reembolso' | 'urgencia' | 'b2b' | 'desqualificar' | 'outro',
  tags_to_add: string[],              // whitelist em CUSTOM_FIELDS_E_TAGS.md
  custom_fields_patch: Record<string, unknown>,  // enums validados (G9)
  urgency: 'baixa' | 'media' | 'alta' | 'critica',
  suggested_stage_id: string | null,
  confidence: number,                 // 0..1
  reasoning: string                   // ≤200 chars
}
```

Rule Engine consome esse output e aplica G1–G10. Modelo: `google/gemini-3-flash-preview`. Prompt versionado em `agent_prompt_versions`, traces em `agent_traces`. Watermark sempre avança após classify, mesmo se Rule Engine não agir.

### Regras Fase 2

| Regra | Ação determinística após classifier |
|---|---|
| `auto:b2b-move` | `intent='b2b'` e `confidence ≥ 0.85` e stage atual = `Leads de entrada` → move para `B2B/Stakeholders` + tag `b2b_auto`. |
| `auto:urgency-flag` | `urgency in ('alta','critica')` → tag `urgencia_clinica` + `lead_events.urgency_flagged` + notificação realtime. **Não move stage.** |
| `auto:field-patch` | Aplica `custom_fields_patch` respeitando G10 (não sobrescreve valor humano <7d). |
| `auto:tags-merge` | MERGE de `tags_to_add` (G6), filtrado por whitelist. |

**Custo**: limite via `ai_spend_limits` por clínica. Hard stop se exceder.

### Validação golden

260 leads B2B existentes (ver `LEAD_SAMPLES.md`) servem de golden set. Aceite: ≥90% de precisão em `intent='b2b'` antes de habilitar `auto:b2b-move` em prod.

---

## Fase 3 — Summarizer + Tarefas (1 semana)

| Regra | Trigger | Ação |
|---|---|---|
| `pipeline-summarize` | Após classifier, se houver ≥N novas msgs OU `intent != 'outro'` | Atualiza `leads.ai_summary` (≤800 chars). Avança `last_processed_message_id_summarizer`. |
| `auto:nf-task` | `intent='nf_reembolso'` e stage = `Consulta finalizada` | Cria `lead_tasks` "Emitir NF" `due_at=+1d útil`. Dedup por título aberto. Evento `nf_solicitada`. |
| `auto:payment-confirmed` | `intent='pagar'` + comprovante (imagem detectada) OU webhook de pagamento | Com webhook: move `Procedimento agendado` → `Procedimento pago` (G2 permite porque vem de fonte confiável). Sem webhook: tag `pagamento_alegado` + `custom_fields.pagamento_alegado_em` + task "Confirmar pagamento" + notifica. **Texto sozinho nunca move** (G2 bloqueia em `Procedimento pago`). |

## Fase 4 — Retenção e nutrição

Depois de Fases 1–3 estáveis com <5% de "humano desfez em 24h":

- `auto:judicializacao` (C7) — tag + custom_field + task recorrente.
- `auto:renovacao-receita` (C8) — só em inbound, nunca scan.
- `auto:objection-suggest` (C12) — sugestão no painel, não envia.
- Bindings de `stage_sequence_bindings` ativos para C13/C14 (pós-consulta NPS, pré-procedimento).
- Avaliação offline (golden set), métrica "undo humano <24h" por regra. Só introduzir 2º classifier se acurácia global <90%.

---

## Métricas de sucesso (por regra)

Painel `/admin/pipeline-automations` mostra para últimos 7d:
- Leads tocados.
- Taxa de "humano desfez em <24h" (cruzar `lead_stage_history` com `source='auto:X'` → `source='manual'` no mesmo lead).
- Custo estimado (LLM tokens × preço).
- Tempo médio trigger → ação humana correlata.

**Critério para manter regra ligada**: <5% undo humano em 7d, zero spam/loop detectado.

## Coisas que NÃO automatizamos

- Desqualificação direta (C11) — só sugere.
- Resposta automática genérica — agente de auto-reply é separado.
- Reordenação dentro da coluna — atendentes usam ordem como sinal próprio.
- Movimentação `Em tratamento` → `Paciente antigo` — humano marca ciclo completo.

## Decisões fechadas (v3)

| Tema | Decisão |
|---|---|
| Recuperação de no-show | Tag `no_show` em `Sem resposta`. Não cria stage novo. |
| Sessões subsequentes em tratamento | 1ª sessão move stage; subsequentes só incrementam `custom_fields.sessoes_realizadas`. |
| Lock manual | 7 dias para movimentação de stage. Não bloqueia escrita de tags/fields/summary. |
| Quem move card | Sempre código determinístico. LLM só sugere. |
| Pagamento | `Procedimento pago` com `lock_auto_move=true`. Texto sozinho nunca move; só webhook ou comprovante+humano. |
| Reativação | Consciente de tag `no_show`/`reagendamento_pendente`; roteia para stage de agenda em vez de Qualificação. |

## Como começar

Quando quiser executar: _"vamos fazer a Fase 0"_. Migration + helpers + UI sai junto. Depois Fase 1.1 (motor de appointments) já entrega o fechamento do bug original.
