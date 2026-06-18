---
title: "Pipeline — Plano de automação v4.2 (priorizado)"
topic: kanban
kind: roadmap
audience: agent
updated: 2026-06-18
summary: "Roadmap em fases para automatizar o pipeline (v4.2). Arquitetura: 1 Classifier + 1 Summarizer + Rule Engine + Reator humano + agentes auditores (A1 position-auditor, A2 post-move-verifier, A3 history tool no classifier). Inclui 8 decisões D1–D8 e 11 gates de segurança."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/DATABASE.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Plano de automação v4.2 — pipeline

**Premissa**: começar pequeno, observável e reversível. Cada regra tem toggle independente em `app_settings`, off by default. Lembretes ficam na UI `/automations` (D6).

**v4.2 (incremento sobre v4.1)** adiciona 3 agentes de auditoria que **nunca movem cards**, só sinalizam via tag `precisa_atencao_humana` + task:
- **A1** — `pipeline-position-auditor` (cron diário) revisa leads parados ≥7d.
- **A2** — `pipeline-post-move-verifier` (hook async no `pipeline-move`) dá segunda opinião barata em todo move automático.
- **A3** — Classifier ganha tool `get_lead_history` para puxar contexto sob demanda.

## Arquitetura

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
                             ├─ aplica 11 gates de segurança
                             ├─ MERGE tags / SET custom_fields
                             ├─ move stage (se permitido)
                             └─ grava lead_stage_history + lead_events

appointments.status ──► Rule Engine direto (5 regras auto:appointment-*)
cron horário ────────► Rule Engine direto (followup-24h/3d/7d)
lead_stage_history ──► Reator humano (escuta source='manual'|'ui')
                         └─► infere consequência ou tag precisa_atencao_humana
UI /automations ─────► automations-tick (lembretes — SEM código novo, D6)
```

**O que NÃO fazemos**: ❌ 12 agentes por coluna, ❌ agente "gerente" via LLM, ❌ RAG com embeddings agora, ❌ auto-reply via pipeline (agente WhatsApp é separado), ❌ lembretes reescritos em código (D6).

## 11 gates de segurança obrigatórios em TODA regra `auto:*`

| # | Gate | Cobertura |
|---|---|---|
| G1 | `leads.manual_lock_until > now()` → não move stage (continua escrevendo tags/fields/summary) | E6 |
| G2 | `pipeline_stages.lock_auto_move` no destino → aborta movimentação | E10 (em v4.1 nenhum stage tem essa flag) |
| G3 | `app_settings.automation.<rule>.enabled = true` → aborta se off | kill switch |
| G4 | Idempotência via `lead_events` antes de agir | E2 |
| G5 | `lead_stage_history.source = 'auto:<rule>'` ou `'reator:<inferencia>'` sempre preenchido | auditoria |
| G6 | Tags: SEMPRE `MERGE` (`array_cat`+`distinct`), NUNCA `SET` | E7, R1 |
| G7 | `qualificacao='desqualificado'` exige `motivo_desqualificacao` no mesmo UPDATE | E8, R2 |
| G8 | NUNCA escrever `leads.pipeline_id` direto (trigger deriva) | E9, R3 |
| G9 | Custom fields enum-validados usam strings exatas do enum | R4 |
| G10 | Para a mesma `custom_fields.<key>`, valor humano-escrito nos últimos 7 dias NÃO é sobrescrito por classifier | precedência humano>IA |
| **G11** | **Classifier NUNCA cria/altera `appointments`**. Só sugere via task + tag `agendamento_sugerido`. Criação real é humano ou webhook externo. **v4.2: cobre também A1 e A2 — nenhum agente auditor cria/edita `appointments` nem move stage; apenas tag + task.** | E11 (v4.1) |

**Stages excluídos de scans temporais** (`auto:followup-*`): `Paciente antigo`, `Nutrição inativa`, `B2B`, `Desqualificado`, **+ qualquer lead com `appointments.scheduled_at > now()`**.

**Guard D3 (paciente antigo)**: regras `auto:appointment-*` que normalmente moveriam o card abortam o move quando `current_stage = 'Paciente antigo'`. Em vez disso, anexam tag e atualizam campos.

---

## Fase 0 — Infra (1 dia, sem LLM)

Migration + helpers + UI read-only.

- [ ] Migration:
  - Renomear stage `Procedimento agendado` → `Tratamento agendado` (D2).
  - Eliminar stage `Procedimento pago` migrando leads para `Tratamento agendado` com `custom_fields.status_financeiro='pago'` (D1).
  - `ALTER TABLE leads ADD COLUMN last_processed_message_id_classifier uuid REFERENCES messages(id)`.
  - `ALTER TABLE leads ADD COLUMN last_processed_message_id_summarizer uuid REFERENCES messages(id)`.
  - `CREATE TABLE stage_sequence_bindings (...)`.
  - `INSERT INTO app_settings (...)` para as ~18 chaves `automation.<rule>.enabled` (ver `DATABASE.md`).
- [ ] Helper `supabase/functions/_shared/pipeline-move.ts`:
  - Recebe `lead_id`, `to_stage_id`, `source`, `reason`, `metadata`, `idempotency_key`.
  - Aplica G1, G2, G3, G4, G5, G8, **+ guard D3**.
  - Grava `lead_stage_history` + `lead_events`.
  - Retorna `{moved: boolean, reason?: string}`.
- [ ] Página `/admin/pipeline-automations` (read-only): lista regras + toggles + métricas 7d.

## Fase 0.5 — Campos custom e tags faltantes (1 dia)

Criar todos os campos da seção "Fase 0.5" em `DATABASE.md`:

- Substituir `interesse_principal` por `interesse_consulta` + `interesse_tratamento` (multi-select).
- Atualizar enum `motivo_desqualificacao` (D1 brief): `servico_nao_oferecido | especialidade_nao_atendida | contato_por_engano | fora_da_regiao | demanda_incompativel | outro`.
- Adicionar `status_financeiro`, `ciclo_concluido`, `sessoes_realizadas`, `nome_responsavel_financeiro`, `possui_liminar_judicial`, `saldo_sessoes_pacote`, `pagamento_alegado_em`, `data_solicitacao_nf`, `modalidade_preferida`, `motivo_cancelamento`.
- Atualizar trigger `trg_validate_lead_custom_fields_enums` para refletir.
- Registrar whitelist de tags v4.1 (`CUSTOM_FIELDS_E_TAGS.md`) — incluindo `precisa_atencao_humana`.

## Fase 1 — Regras determinísticas (1 semana, sem LLM)

### 1.1 Onboarding e qualificação

| Regra | Trigger | Ação |
|---|---|---|
| `auto:novo-lead` | INSERT em `leads` via `evolution-webhook` (número novo) | Enviar welcome template (`message_templates` configurável). Registra `lead_events.type='welcome_sent'`. Idempotente. Sender = `'system'` no `messages`. |
| `auto:secretary-replied` | INSERT em `messages` com `direction='outbound' AND sender_type='human'`, em lead atualmente em `Leads de entrada` | Move para `Qualificação` com `source='auto:secretary-replied'`. Idempotente por `lead_events.type='secretary_replied'`. |

### 1.2 Motor `auto:appointment-*` (5 regras, mesma trigger Postgres)

Trigger em `INSERT OR UPDATE OF status` em `appointments` chama edge function `pipeline-appointment-sync`. Idempotência por `(appointment_id, status)` via `lead_events.type='appointment_status_synced'`. **Todas respeitam o guard D3.**

| Regra | Trigger | Ação |
|---|---|---|
| `auto:appointment-agendado` | INSERT, `status='agendado'` | `kind='consulta'` → mover para `Consulta agendada`. `kind='procedimento'` → mover para `Tratamento agendado`. **Guard D3**: se atual = `Paciente antigo`, não move, só anexa tag `consulta_agendada`/`tratamento_em_andamento`. |
| `auto:appointment-realizado` | UPDATE, `status='realizado'`, `kind='consulta'` | Mover para `Consulta finalizada`. Dispara enrollment de pesquisa (C13/C14). |
| `auto:appointment-faltou` | UPDATE, `status='faltou'` | Mover para `Sem resposta` + tag `no_show` + task "Reagendar" D+1. |
| `auto:appointment-cancelado` | UPDATE, `status='cancelado'` | Mover para `Qualificação` + tag `reagendamento_pendente` + task. Setar `custom_fields.motivo_cancelamento` se vier do payload. |
| `auto:procedure-realizado` | UPDATE, `status='realizado'`, `kind='procedimento'` | Se 1ª sessão (sem `session_counted` prévio): mover para `Em tratamento`, criar `session_counted` com `payload.session_number=1`. Senão: incrementar `custom_fields.sessoes_realizadas`, criar `session_counted` com número, **não move**. |

### 1.3 Inatividade tiered (D4)

Substitui `auto:inactivity-5d` por **3 regras escalonadas**.

| Regra | Trigger (cron horário) | Ação |
|---|---|---|
| `auto:followup-24h` | `last_message_at < now()-24h`, último msg inbound, stage não-final, sem appointment futuro, sem `followup_sent attempt=1` | Envia template #1. Registra `followup_sent attempt=1`. Não move. |
| `auto:followup-3d` | `last_message_at < now()-3d`, ainda inbound, tem `attempt=1`, sem `attempt=2` | Template #2. `attempt=2`. Não move. |
| `auto:followup-7d-nutricao` | `last_message_at < now()-7d`, tem `attempt=2`, sem `attempt=3` | Se stage atual ≠ `Sem resposta`: move para `Sem resposta`. Se já em `Sem resposta`: move para `Nutrição inativa`. Registra `inactivity_promoted_to_nutricao`. |

### 1.4 Reativação

| Regra | Trigger | Ação |
|---|---|---|
| `auto:reactivation` | `evolution-webhook` em lead em `Sem resposta` ou `Nutrição inativa` | Decisão por tags: `no_show` → `Consulta agendada` + tag `reagendamento_solicitado` + task; `reagendamento_pendente` → idem; senão → `Qualificação` + tag `reativacao`. Se G1 ativo: só tag `reativacao_durante_lock` + notifica. |

### 1.5 Modalidade

| Regra | Trigger | Ação |
|---|---|---|
| `auto:modality-guard` | Pré-envio de template | Bloqueia template com `{{endereco}}` se `custom_fields.modalidade='online'`. |

### 1.6 Conclusão de ciclo

| Regra | Trigger | Ação |
|---|---|---|
| `auto:ciclo-concluido` | UPDATE de `leads.custom_fields.ciclo_concluido` para `true` (origem humana) | Move lead em `Em tratamento` para `Paciente antigo`. Idempotente. |

### 1.7 Lembretes (D6 — fora do código)

**Não há regra `auto:reminder-*` na v4.1.** Lembretes vivem em `automations` configuradas via UI `/automations`:
- Padrão recomendado: 1 automation `before_appointment` por tipo de procedimento, com 2 offsets (1440min e 60min).
- Edge cases de short notice já tratados em `supabase/functions/automations-tick/index.ts` (linhas marcadas `same_day_short_notice`).
- Não duplicar lógica em código novo.

### 1.8 Reator humano (D7) — **nova subsistema**

Trigger AFTER INSERT em `lead_stage_history` onde `source IN ('manual','ui')` chama edge function `pipeline-human-reactor`. **Sempre** renova `manual_lock_until = now() + 7d`.

Tabela de inferências:

| Ação humana detectada | Inferência da IA |
|---|---|
| Moveu para `Sem resposta` | Pausa `auto:followup-*` automáticos por 24h (humano gerencia primeiro round). |
| Moveu para `Desqualificado` sem `motivo_desqualificacao` preenchido | Tag `precisa_atencao_humana` + task "Preencher motivo da desqualificação". |
| Setou `status_consulta='cancelada'` no card | Localiza appointment ativo mais próximo, seta `status='cancelado'` (dispara `auto:appointment-cancelado` que move para Qualificação + tag). |
| Setou `status_consulta='reagendada'` sem nova data informada | Mantém em `Consulta agendada` + tag `aguardando_nova_data` + task "Confirmar nova data". |
| Setou `status_consulta='faltou'` | Localiza appointment, seta `status='faltou'` (dispara `auto:appointment-faltou`). |
| Setou `status_consulta='realizada'` | Localiza appointment, seta `status='realizado'` (dispara `auto:appointment-realizado`). |
| Setou `status_financeiro='reembolsado'` em paciente em `Em tratamento` | Tag `precisa_atencao_humana` (ambíguo: cancelou tratamento? Trocou modalidade?). |
| Moveu para `B2B` lead com appointment futuro | Tag `precisa_atencao_humana` + task "Confirmar reclassificação como B2B". |
| Moveu para `Em tratamento` sem appointment kind=procedimento histórico | Tag `precisa_atencao_humana` + task "Validar entrada em tratamento". |
| Movimento que IA não tem regra mapeada | Tag `precisa_atencao_humana`. |

Cada ação do reator grava `lead_stage_history` com `source='reator:<inferencia>'` e `lead_events.type='human_action_reacted'` com payload contendo o gatilho e a decisão.

### Critério de aceite da Fase 1

- Cada regra tem teste unitário (happy + dedup + G1/G2/G3 + guard D3 onde aplicável).
- Todas off-by-default.
- Ligar 1 regra por vez, com janela de 48h de observação.
- Reator humano sai por último — só depois das `auto:appointment-*` estarem estáveis.

---

## Fase 2 — Classifier LLM (2 semanas)

Edge function `pipeline-classify`. Roda em todo inbound (debounce 5s). **v4.2**: ganha tool `get_lead_history` (A3) para puxar contexto sob demanda quando `ai_summary` não cobre a intent.

**Input**: `last_processed_message_id_classifier`, `leads.ai_summary`, `custom_fields`, `tags`, `stage`, novas mensagens.

**Output (Zod)**:
```ts
{
  intent: 'agendar' | 'reagendar' | 'pagar' | 'nf_reembolso' | 'urgencia' | 'b2b' | 'desqualificar' | 'outro',
  tags_to_add: string[],
  custom_fields_patch: Record<string, unknown>,
  urgency: 'baixa' | 'media' | 'alta' | 'critica',
  suggested_stage_id: string | null,
  confidence: number,
  reasoning: string                   // ≤200 chars
}
```

Rule Engine consome e aplica G1–G11. Modelo: `google/gemini-3-flash-preview`. **Confidence < 0.6 → tag `precisa_atencao_humana` automática** (D8).

### Regras Fase 2

| Regra | Ação |
|---|---|
| `auto:b2b-move` | `intent='b2b'` e `confidence ≥ 0.85` e stage = `Leads de entrada` → move para `B2B/Stakeholders` + tag `b2b_auto`. |
| `auto:urgency-flag` | `urgency in ('alta','critica')` → tag `urgencia_clinica` + `urgency_flagged` + notificação realtime. Não move. |
| `auto:field-patch` | Aplica `custom_fields_patch` respeitando G10. Inclui `interesse_consulta`, `interesse_tratamento`, `nome_responsavel_financeiro`, `possui_liminar_judicial`. |
| `auto:tags-merge` | MERGE de `tags_to_add` (G6), filtrado por whitelist. |
| `auto:agendamento-sugerido` | `intent='agendar'` → cria task "Confirmar e criar agendamento" + tag `agendamento_sugerido`. **G11**: nunca cria appointment. |

**Custo**: limite via `ai_spend_limits`. Hard stop se exceder.

### Validação golden

260 leads B2B existentes servem de golden set. Aceite: ≥90% precisão em `intent='b2b'` antes de ligar `auto:b2b-move`.

---

## Fase 3 — Summarizer + Tarefas (1 semana)

| Regra | Trigger | Ação |
|---|---|---|
| `pipeline-summarize` | Após classifier, se ≥N novas msgs OU `intent != 'outro'` | Atualiza `ai_summary` (≤800 chars). Avança `last_processed_message_id_summarizer`. |
| `auto:nf-task` | `intent='nf_reembolso'` e stage = `Consulta finalizada` | Cria `lead_tasks` "Emitir NF" `due_at=+1d útil`. Dedup. Evento `nf_solicitada`. Seta `data_solicitacao_nf`. |
| `auto:payment-confirmed` | Webhook de pagamento real | Seta `custom_fields.status_financeiro='pago'`. **Não move stage** (D1). Texto/comprovante sem webhook → tag `pagamento_alegado` + `pagamento_alegado_em` + task. |

## Fase 4 — Retenção e nutrição

Depois das Fases 1–3 estáveis com <5% "humano desfez em 24h":

- `auto:judicializacao` (C7).
- `auto:renovacao-receita` (C8) — só inbound.
- `auto:objection-suggest` (C12) — sugestão.
- Bindings de `stage_sequence_bindings` ativos para C13/C14.
- View "Leads travados" no Kanban (filtra `precisa_atencao_humana`).
- Avaliação offline com `agent_evals`. 2º classifier só se acurácia <90%.

---

## Métricas de sucesso (painel `/admin/pipeline-automations`)

Para últimos 7d, por regra:
- Leads tocados.
- Taxa de "humano desfez em <24h".
- Custo estimado (tokens × preço).
- Tempo médio trigger → ação humana correlata.
- **Volume de `precisa_atencao_humana` aplicadas** (proxy de saúde do classifier).

**Critério para manter regra ligada**: <5% undo humano em 7d, zero spam/loop detectado.

## Coisas que NÃO automatizamos

- Desqualificação direta (C11).
- Resposta automática genérica (agente WhatsApp separado).
- Reordenação dentro da coluna.
- Movimentação `Em tratamento` → `Paciente antigo` sem `ciclo_concluido` humano.
- Lembretes em código (D6 — UI `/automations`).
- Criação/alteração de `appointments` por LLM (G11).

---

## Decisões v4.1 (D1–D8) — rastreabilidade

| # | Decisão | Onde está documentada | Rastreio |
|---|---|---|---|
| D1 | "Procedimento pago" eliminada → campo `status_financeiro` | `STAGES.md`, `DATABASE.md`, `CUSTOM_FIELDS_E_TAGS.md` | Brief item 10. Remove regra `auto:procedimento-pago` da v3. |
| D2 | "Procedimento agendado" → "Tratamento agendado" | `STAGES.md`, todas referências | Brief item 9. |
| D3 | Paciente antigo não sai do stage ao agendar | `STAGES.md`, guard nas `auto:appointment-*` | Brief item 12. Cobre P9 + C17. |
| D4 | Inatividade tiered (24h/3d/7d) | Fase 1.3 acima, `SCENARIOS.md` C5a–c | Brief item 13. Substitui `auto:inactivity-5d` único. |
| D5 | Passou do horário → move automático; humano reverte | `auto:appointment-realizado` + reator | Decisão explícita do usuário (oposto do item 7 do brief). |
| D6 | Lembretes via UI `/automations` | Fase 1.7 + `SCENARIOS.md` C9 | Decisão do usuário; usa `automations-tick` existente. |
| D7 | Reator de ação humana | Fase 1.8 + `SCENARIOS.md` C19 | Decisão do usuário; resolve ambiguidades sem ping-pong. |
| D8 | Tag `precisa_atencao_humana` (lead travado) | Fase 1.8, 2 (confidence<0.6), `CUSTOM_FIELDS_E_TAGS.md`, `SCENARIOS.md` C20 | Decisão do usuário; vira fila de retreino. |

## 13 perguntas do brief (item 18) — todas fechadas em v4.1

| Pergunta | Decisão |
|---|---|
| Renomear Procedimento agendado? | Sim → Tratamento agendado (D2). |
| Eliminar Procedimento pago? | Sim → campo `status_financeiro` (D1). |
| Move automático ou humano confirma? | Move automático ao `appointments.status` mudar; humano reverte via `status_consulta` que aciona reator (D5+D7). |
| Como registrar falta/cancelamento/reagendamento? | Campo `status_consulta` no card → reator (D7) traduz pra `appointments.status` → `auto:appointment-*`. |
| "Consulta finalizada" deve existir? | Sim. Pagamento e detalhes são campos. |
| Quando entra em "Em tratamento"? | 1ª sessão `realizado` via `auto:procedure-realizado`. |
| Quando sai de "Em tratamento"? | Humano marca `ciclo_concluido` → `auto:ciclo-concluido`. |
| Paciente antigo permanece sempre? | Sim (D3). |
| Como mostrar múltiplos compromissos no card? | `appointments` 1-N, próximo no header, lista no detalhe, calendário separa (P9). |
| Sem resposta vs Nutrição inativa unificar? | Não — transição automática (D4). |
| Tempo para "sem resposta"? | 24h/3d/7d (D4). |
| Mensagens de follow-up? | Templates configuráveis em `auto:followup-*`; lembretes em `/automations`. |
| Múltiplos agendamentos no calendário? | `appointments` 1-N (P9). |
| Impedir IA de alterar appointment? | G11 v4.1 — classifier nunca escreve em `appointments`. |
| Quais lembretes? | 24h + 1h (D6, via UI). |
| Agendamento <24h ou <1h? | Skip automático no `automations-tick` (`same_day_short_notice`). |
| Pagamento, comparecimento, conclusão separados? | Sim — campos independentes do stage (D1). |

## Como começar

Quando quiser executar: _"vamos fazer a Fase 0"_. Migration + helpers + UI sai junta. Depois Fase 1.1 (onboarding) + 1.2 (motor de appointments) já entregam o fechamento do bug original do estudo.
