
# Plano: Atualizar docs de Pipeline + Automações + Agente IA

## Diagnóstico do estado atual

Já existem 11 documentos que cobrem o assunto, mas estão **desalinhados** com o que o sistema faz hoje:

| Doc | Última edição | Problema |
|---|---|---|
| `docs/maps/KANBAN_LEADS.md` | 2026-06-07 | Não menciona `pipeline_field_rules`, `stage_ai_defaults` trigger, `is_archive`, custom_fields canônicos, AIBadges no LeadCard. |
| `docs/flows/LEAD_LIFECYCLE.md` | 2026-06-07 | Não cobre o ciclo "derivado por campos" (extractor → field-rules). Ainda descreve só os triggers SQL antigos. |
| `docs/maps/AUTOMATIONS_SEQUENCES.md` | 2026-06-07 | Não inclui `field-rules-tick`, `stage-aging-tick`, `outreach-recovery-tick`, `dedup-leads-tick`, `agent-followups-tick`. |
| `docs/features/SEQUENCES_AUTOMATIONS.md` | 2026-06-07 | Falta documentação dos novos `trigger_type`/`action_type` e do cooldown. |
| `docs/maps/AI_RUNTIME.md` | 2026-06-07 | Não inclui o trio `extractor-tick` + `vision-tick` + `audio-tick` + `field-rules-tick` — esses só aparecem no roadmap. |
| `docs/flows/AI_AGENT_LOOP.md` | 2026-06-07 | Cobre só `ai-auto-reply`/`ai-assist`. Falta o loop "extrator → regras → kanban". |
| `docs/edge-functions/AI.md` | — | Não lista as 4 funções novas do pipeline IA. |
| `docs/edge-functions/INDEX.md` | — | Provavelmente desatualizado para os 16 ticks listados. |
| `docs/roadmap/CLINIC_PIPELINE.md` | 2026-06-12 | OK como roadmap, mas serve como **fonte de verdade temporária** — precisa ser destilado para os mapas/flows. |
| `docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md` | 2026-06-14 | Idem — auditoria viva, conclusões precisam virar referência. |
| `docs/support/journeys/usar-pipeline-ia.md` | — | Provavelmente OK, validar contra UI atual. |

**Lacuna principal:** não existe um documento único que descreva o **contrato de `custom_fields`** (nome canônico de cada campo, tipo, enum, quem escreve, quem lê), nem o **mapa completo dos cron ticks** com frequência e responsabilidade.

---

## Fase 1 — Mapas de referência (a "fonte de verdade")

Atualizar os 3 mapas-pilares para refletir o sistema atual.

### 1.1 `docs/maps/KANBAN_LEADS.md`
- Adicionar seção **"Pipeline derivado por campos"** explicando que stage é resultado de `pipeline_field_rules` + `extractor`, não escolha manual.
- Documentar `pipeline_field_rules` (tabela, operadores suportados, prioridade, manual_lock).
- Adicionar tabela atualizada do pipeline da Clínica ÓR como exemplo real (15 colunas).
- Documentar `AIBadges`, `manual_lock_until`, `ai_review_reasons`.
- Listar invariantes novos (custom_fields canônicos, position pode ter gaps).

### 1.2 `docs/maps/AI_RUNTIME.md`
- Nova seção **"Pipeline IA"** listando os 4 ticks: `extractor-tick`, `vision-tick`, `audio-tick`, `field-rules-tick` (frequência, custo, modelo padrão, BYOK).
- Separar claramente **AI conversacional** (ai-auto-reply/assist/copilot) de **AI estrutural** (extractor/vision/audio/field-rules).
- Documentar `clinic_secrets` (BYOK OpenAI) e `clinics.classifier_config`.
- Tabela de custos por camada com estimativa.

### 1.3 `docs/maps/AUTOMATIONS_SEQUENCES.md`
- Adicionar **inventário completo dos crons** (tabela com 16 funções `*-tick`).
- Diferenciar `automations` (regra "quando→faça") de `pipeline_field_rules` (regra "estado→stage").
- Documentar `stage-aging-tick`, `outreach-recovery-tick`, `agent-followups-tick`, `dedup-leads-tick`.
- Atualizar inventário de `trigger_type` e `action_type` da tabela `automations`.

## Fase 2 — Flows (o "como funciona")

Atualizar os fluxos end-to-end.

### 2.1 `docs/flows/LEAD_LIFECYCLE.md`
- Substituir o diagrama "ORIGEM → estágios manuais" por **"ORIGEM → IA extrai → regras movem"**.
- Adicionar seção "Como uma mensagem vira movimentação de card" passo-a-passo (trigger SQL → needs_ai_review → extractor → custom_fields → field-rules-tick → stage_changed).
- Documentar manual_lock (quando humano edita, IA respeita por N min).

### 2.2 `docs/flows/AI_AGENT_LOOP.md`
- Adicionar nova seção **"Loop do Pipeline IA"** com o diagrama do `CLINIC_PIPELINE.md §3.2`.
- Manter o loop conversacional (ai-auto-reply) como seção separada.

### 2.3 **NOVO** `docs/flows/PIPELINE_DERIVED.md`
- Documento dedicado: como o kanban deriva de campos.
- Inclui exemplos reais de leads (com transcrição curta + custom_fields antes/depois + regra que disparou).
- Casos de falha: campo não preenchido, regra não casa, data passada, lock manual.

## Fase 3 — Contratos e referências técnicas

### 3.1 **NOVO** `docs/maps/CUSTOM_FIELDS_CONTRACT.md`
Catálogo único dos custom_fields do lead:

| Campo | Tipo | Enum | Escrito por | Lido por |
|---|---|---|---|---|
| `qualificacao` | enum | interessado, em_negociacao, desqualificado, sumiu | extractor | field-rules |
| `tipo_atendimento` | enum | primeira_consulta, sessao_cetamina, sessao_emt, … | extractor | field-rules |
| `consulta_agendada_em` | timestamptz | — | extractor | field-rules |
| `procedimento_agendado_em` | timestamptz | — | extractor | field-rules |
| `pagamento_confirmado` | bool | — | extractor/vision | field-rules |
| `tentou_agendar` | bool | — | extractor | field-rules |
| `tentou_pagamento` | bool | — | extractor/vision | field-rules |
| `status_consulta` | enum | agendada, confirmada, realizada, reagendada, no_show, cancelada | extractor | field-rules |
| `status_nf_reembolso` | enum | pendente, enviada, nao_aplica | extractor | humano |
| `is_b2b` | bool | — | trigger SQL + extractor | field-rules |

- Regras de normalização (timezone, formato ISO).
- Como adicionar campo novo (checklist: trigger → extractor schema → field-rules → AIBadges).

### 3.2 Atualizar `docs/edge-functions/AI.md`
- Adicionar as 4 funções do pipeline IA com assinaturas + payload + RLS.
- Linkar com o mapa AI_RUNTIME.

### 3.3 Atualizar `docs/edge-functions/INDEX.md`
- Regerar tabela com as 16 funções `*-tick` atuais (frequência cron, responsabilidade).

### 3.4 Atualizar `docs/features/SEQUENCES_AUTOMATIONS.md`
- Inventário atualizado de triggers/actions.
- Diferenciar para o leitor: "automation" vs "field rule" (link cruzado).

## Fase 4 — Documentação de usuário (Support)

### 4.1 Revisar `docs/support/journeys/usar-pipeline-ia.md`
- Conferir com UI atual (`AILimitsCard`, `FieldRulesCard`, `OpenAIKeyCard`, `ExtractorHistoryCard`).
- Adicionar passo "Como debugar um lead que não moveu" (lock manual? regra não casa? campo não extraído?).

### 4.2 Atualizar `docs/support/pages/automations.md`
- Adicionar nota sobre a diferença vs `pipeline_field_rules` (que vive em outra tela: `/settings` aba IA do Pipeline).
- Linkar para a journey acima.

### 4.3 Atualizar `docs/support/troubleshooting/ia.md`
- Nova seção "Lead não está sendo movido automaticamente" com checklist (5 causas mais comuns identificadas no AUDIT_EXTRACTOR_PIPELINE).

### 4.4 **NOVO** `docs/support/journeys/criar-field-rule.md`
- Como criar uma regra de campo (qual campo, qual operador, qual coluna alvo).
- Exemplos práticos baseados nas 7 regras já existentes da ÓR.

## Fase 5 — Closing

1. Atualizar `updated:` em todos os arquivos tocados para a data de hoje (2026-06-17).
2. Conferir `code_refs` apontam para arquivos existentes.
3. Adicionar `related_docs` cruzados (mapas ↔ flows ↔ features ↔ journeys).
4. Rodar `node scripts/docs-sync.mjs` e revisar `docs/DRIFT.md` resultante.
5. Mover `docs/roadmap/CLINIC_PIPELINE.md` para status **"Entregue"** com link para os novos mapas (deixa de ser fonte de verdade — vira histórico).

---

## O que **não** vai mudar

- Não vou mexer no código (extractor, ticks, UI). É só doc.
- Não vou apagar `docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md` — auditoria é histórica.
- Não vou reescrever as docs de Builder/Inbox/Email — fora de escopo.
- Não vou tocar em `supabase/functions/_shared/support-kb/**` (espelho gerado).

## Ordem sugerida

```text
Fase 1 (mapas)       → 3 arquivos editados      ~30 min agente
Fase 2 (flows)       → 2 editados + 1 novo      ~25 min
Fase 3 (contratos)   → 1 novo + 3 editados      ~30 min
Fase 4 (support)     → 3 editados + 1 novo      ~20 min
Fase 5 (sync)        → docs-sync + DRIFT review ~5 min
```

## Risco

- DRIFT.md pode acusar `code_refs` antigos quebrados — corrijo no ato.
- Conflito com o usuário se ele preferir um único doc gigante vs mapas+flows separados.

**Quer que eu siga as 5 fases em sequência, ou prefere que eu pare ao fim de cada uma para você revisar?**
