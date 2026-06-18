---
name: Pipeline v4.2 decisions
description: Decisões D1–D8 do pipeline da Clínica ÓR v4.2, gates de segurança G1–G11, fases de implementação incluindo Fase 2.5 com agentes auditores A1/A2/A3. Consultar antes de mexer em docs/pipeline/ ou implementar fases.
type: feature
---

# Pipeline v4.2 — decisões e roadmap

Pipeline default: `17c27f4d-8256-4ea7-b5b9-ed706494f686` (clínica `cf038458-457d-4c1a-9ac4-c88c3c8353a1`).

## 8 decisões fechadas (D1–D8, vindas da v4.1)

| # | Decisão |
|---|---|
| D1 | "Procedimento pago" eliminada → campo `status_financeiro`. Pipeline 12→11 colunas. |
| D2 | "Procedimento agendado" → "Tratamento agendado". |
| D3 | Paciente antigo NÃO sai do stage ao agendar — só anexa tags `consulta_agendada`/`tratamento_em_andamento`. Guard nas `auto:appointment-*`. |
| D4 | Inatividade tiered: `auto:followup-24h` → `auto:followup-3d` → `auto:followup-7d-nutricao`. |
| D5 | Move automático ao passar do horário (via `appointments.status`). Humano reverte via `status_consulta`. |
| D6 | Lembretes via UI `/automations` (sistema `automations-tick` existente). Sem regra `auto:reminder-*` codificada. |
| D7 | Reator de ação humana: trigger em `lead_stage_history` (source manual/ui) → edge function `pipeline-human-reactor` infere consequência ou trava com tag. |
| D8 | Tag `precisa_atencao_humana` = fallback universal de baixa confiança (classifier `confidence<0.6`, reator ambíguo, regra sem decisão). |

## v4.2 — agentes auditores (A1/A2/A3, sem nova decisão D)

| Agente | O que faz | Onde roda |
|---|---|---|
| **A1** `pipeline-position-auditor` | Cron 03:00 BRT, batch 50/dia. Revisa leads parados ≥7d. Se classifier "revisor" discorda com `confidence ≥ 0.75` → tags `precisa_atencao_humana` + `auditor_sugere_<stage>` + task. **Não move.** | Edge function nova, Fase 2.5 |
| **A2** `pipeline-post-move-verifier` | Hook async dentro do helper `pipeline-move` quando `source LIKE 'auto:%'`. 2ª opinião Flash-Lite. Se discorda com `confidence ≥ 0.8` → tags `precisa_atencao_humana` + `post_move_warning`. **Não reverte.** | Edge function nova, Fase 2.5 |
| **A3** Tool `get_lead_history` no classifier | Classifier pode chamar até 3x por execução (`stopWhen: stepCountIs(4)`) quando `ai_summary` não cobre uma intent. | Ajuste no `pipeline-classify`, Fase 2 |

**Princípio**: A1/A2 nunca movem stage nem editam appointments. G11 estendido para cobrir isso.

## 11 gates de segurança

G1–G10 (v3) + **G11 v4.1**: Classifier nunca cria/altera `appointments`. **v4.2**: G11 cobre também A1 e A2.

## Fases

- **Fase 0**: migration (renomear/eliminar stages, novas colunas em `leads`, `stage_sequence_bindings`, toggles em `app_settings`). Helper `pipeline-move.ts` com gates. UI read-only `/admin/pipeline-automations`.
- **Fase 0.5**: 12 campos novos em `lead_custom_fields` + enum reescrito `motivo_desqualificacao` + whitelist de tags v4.1.
- **Fase 1** (sem LLM): `auto:novo-lead`, `auto:secretary-replied`, 5 regras `auto:appointment-*`, 3 followup tiered, `auto:reactivation`, `auto:modality-guard`, `auto:ciclo-concluido`, reator humano (`pipeline-human-reactor`).
- **Fase 2** (LLM): Classifier `pipeline-classify` (Gemini Flash) **+ A3 tool `get_lead_history`**. Regras `auto:b2b-move`, `auto:urgency-flag`, `auto:field-patch`, `auto:tags-merge`, `auto:agendamento-sugerido`.
- **Fase 2.5** (v4.2): **A1** `pipeline-position-auditor` (cron) + **A2** `pipeline-post-move-verifier` (hook). Critério de entrada: Fase 2 ≥14d estável com <10% undo humano.
- **Fase 3**: Summarizer + `auto:nf-task` + `auto:payment-confirmed` (webhook real seta `status_financeiro='pago'`).
- **Fase 4**: judicialização, renovação receita, view "Leads travados", `stage_sequence_bindings` ativos.

## Toggles v4.2 (`app_settings`)

- `automation.position_auditor.enabled` (bool, default false)
- `automation.position_auditor.batch_size` (int, default 50)
- `automation.post_move_verifier.enabled` (bool, default false)
- `automation.post_move_verifier.rules_enabled` (string[], default [])
- `automation.classifier.history_tool_enabled` (bool, default true quando Fase 2 ligar)

## Tags v4.2 (na whitelist)

- `auditor_sugere_<stage>` — escrito por A1.
- `post_move_warning` — escrito por A2.
- `precisa_atencao_humana` — escrito por A1, A2, classifier baixa confiança, reator ambíguo.

## Critério de sucesso Fase 2.5 (30d)

- A1 produz ≥1 discordância útil/semana (vira move humano).
- A2 detecta ≥1 move ruim/semana antes do humano perceber.
- A3 reduz "% confidence<0.6" do classifier em ≥15%.

Falhou: desligar via toggle, manter doc, reavaliar.

## Infra não-existente (ignorar referências antigas)

- `scripts/docs-sync.mjs` — não existe neste projeto.
- `docs/roadmap/DOCS_MAINTENANCE.md` — não existe.
- `docs/INDEX.json` / `public/docs-*.json` — não há geração.

Memória anterior `Pipeline restructure 2026-06` é da iniciativa de "pipeline-sombra" — **superseded** pela v4.x.
