---
name: Pipeline v4.1 decisions
description: Decisões D1–D8 do pipeline da Clínica ÓR v4.1, gates de segurança G1–G11, fases de implementação. Consultar antes de mexer em docs/pipeline/ ou implementar fases.
type: feature
---

# Pipeline v4.1 — decisões e roadmap

Pipeline default: `17c27f4d-8256-4ea7-b5b9-ed706494f686` (clínica `cf038458-457d-4c1a-9ac4-c88c3c8353a1`).

## 8 decisões fechadas

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

## 11 gates de segurança

G1–G10 (v3) + **G11 v4.1**: Classifier nunca cria/altera `appointments`. Só sugere via task + tag `agendamento_sugerido`.

## Fases

- **Fase 0**: migration (renomear/eliminar stages, novas colunas em `leads`, `stage_sequence_bindings`, toggles em `app_settings`). Helper `pipeline-move.ts` com gates. UI read-only `/admin/pipeline-automations`.
- **Fase 0.5**: 12 campos novos em `lead_custom_fields` + enum reescrito `motivo_desqualificacao` + whitelist de tags v4.1.
- **Fase 1** (sem LLM): `auto:novo-lead`, `auto:secretary-replied`, 5 regras `auto:appointment-*`, 3 followup tiered, `auto:reactivation`, `auto:modality-guard`, `auto:ciclo-concluido`, reator humano (`pipeline-human-reactor`).
- **Fase 2** (LLM): Classifier `pipeline-classify` (Gemini Flash). Regras `auto:b2b-move`, `auto:urgency-flag`, `auto:field-patch`, `auto:tags-merge`, `auto:agendamento-sugerido`.
- **Fase 3**: Summarizer + `auto:nf-task` + `auto:payment-confirmed` (webhook real seta `status_financeiro='pago'`).
- **Fase 4**: judicialização, renovação receita, view "Leads travados", `stage_sequence_bindings` ativos.

## Infra não-existente (ignorar referências antigas)

- `scripts/docs-sync.mjs` — não existe neste projeto.
- `docs/roadmap/DOCS_MAINTENANCE.md` — não existe.
- `docs/INDEX.json` / `public/docs-*.json` — não há geração.

Memória anterior `Pipeline restructure 2026-06` (`.lovable/memories/docs/pipeline-restructure.md`) é da iniciativa anterior de "pipeline-sombra" — **superseded** pela v4.1, que decidiu mexer no pipeline atual em vez de criar paralelo.
