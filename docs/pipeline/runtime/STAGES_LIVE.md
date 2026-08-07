---
title: "Stages do pipeline (estado real)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-22
summary: "12 colunas reais do pipeline 17c27f4d-… com ID, ordem, flags (is_terminal, lock_auto_move) e mapeamento canônico para o classifier. Inclui '1ª Sessão Finalizada' (ex-'Em tratamento') e 'Nutrição Antigos (>60d)'."
code_refs:
  - supabase/migrations/20260618022933_e4ca1829-7d6c-4cd1-8f70-e5bcb788f35a.sql
  - supabase/migrations/20260622020534_d378996e-880a-4893-8ee9-a226da9b39e5.sql
related_docs:
  - docs/pipeline/runtime/README.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/STAGES.md
---

# Stages reais — pipeline `17c27f4d-…`

Consulta direta:

```sql
SELECT id, name, position, is_terminal, lock_auto_move, color
FROM pipeline_stages
WHERE pipeline_id='17c27f4d-8256-4ea7-b5b9-ed706494f686'
ORDER BY position;
```

| # | Nome | UUID | `is_terminal` | `lock_auto_move` | Color |
|---|---|---|---|---|---|
| 0 | Leads de entrada | `b1aa2fc9-d221-4d4f-b53a-7303ec4b75b0` | false | false | `#14b8a6` |
| 1 | Qualificação | `c6eb67f3-cba9-41e5-949c-aa12d34d962d` | false | false | `#0ea5e9` |
| 2 | Paciente antigo | `7fea97d7-c2af-4e6f-8f39-af8375bb4468` | false | false | `#a3a3a3` |
| 3 | Consulta agendada | `e12f004a-6445-4815-8d6b-22f928507a9a` | false | false | `#10b981` |
| 4 | Consulta finalizada | `7584241f-6e4b-4824-aaea-e271e865227d` | false | false | `#22c55e` |
| 5 | Tratamento agendado | `98320189-6002-4f75-b99d-0b407189efe8` | false | false | `#8b5cf6` |
| 6 | 1ª Sessão Finalizada | `2a352661-01e2-41f8-be10-032f803e2387` | false | false | `#a855f7` |
| 7 | Sem resposta | `9f408ae6-649e-44b2-bc56-f93d138c87ed` | false | false | `#ef4444` |
| 8 | Nutrição Inativa (Geladeira de Leads) | `64356dbe-3889-4b49-9429-260501cdb3d8` | false | false | `#f97316` |
| 9 | Nutrição Antigos (>60d) | `9de8e54e-7edb-47dd-b613-de22276d8ea1` | false | false | `#ec4899` |
| 10 | B2B / Stakeholders | `23a7bfd7-2baf-4d0f-8ed1-2b59b719020d` | **true** | false | `#64748b` |
| 11 | Desqualificado / Fora de escopo | `35670cad-3f95-4e11-8f73-e8b27b865f89` | **true** | false | `#64748b` |

> ⚠️ **Rename PR9** (2026-06-22): a coluna `2a35…` que antes se chamava "Em tratamento" foi renomeada para **"1ª Sessão Finalizada"** e o alias antigo "Em tratamento" passou a apontar para o mesmo `stage_id` (retroativo). O canônico oficial agora é "1ª Sessão Finalizada".

> Nenhum stage tem `lock_auto_move=true` hoje. Se algum stage receber esse flag, o helper `pipelineMove` bloqueia entradas vindas de `source LIKE 'auto:%'` (gate G2).

## Stages canônicos usados pelo código

Os agentes LLM e regras determinísticas referenciam stages por **nome canônico**, resolvido em runtime via `stage_canonical_aliases`. Lista canônica fixa em `pipeline-classify/schema.ts` e `pipeline-deterministic/index.ts`:

```
Novo · Qualificação · Consulta agendada · Tratamento agendado ·
Consulta finalizada · 1ª Sessão Finalizada · Sem resposta ·
Nutrição inativa · Nutrição Antigos · Paciente antigo · B2B / Stakeholders
```

Nota: o canônico `Novo` resolve para o stage real **"Leads de entrada"** via alias.

### Aliases seedados

| Alias `name` (case-insensitive) | `canonical_name` |
|---|---|
| `Novo` | Novo |
| `Qualificação`, `Qualificacao` | Qualificação |
| `Consulta agendada`, `consulta agendada`, `Reunião Agendada`, `reuniao agendada` | Consulta agendada |
| `Tratamento agendado`, `Procedimento agendado` | Tratamento agendado |
| `Consulta finalizada` | Consulta finalizada |
| `1ª Sessão Finalizada`, `Em tratamento` (legado) | 1ª Sessão Finalizada |
| `Sem resposta`, `Lead - Sem resposta`, `Parou de Responder` | Sem resposta |
| `Nutrição inativa`, `Nutricao inativa`, `Nutrição Inativa (Geladeira de Leads)` | Nutrição inativa |
| `Nutrição Antigos`, `Nutrição Antigos (>60d)` | Nutrição Antigos |
| `Paciente antigo` | Paciente antigo |

Se o canônico não bate via alias, o classifier tenta `ilike` exato em `pipeline_stages.name` no mesmo pipeline. Falha total → o move é abortado com `stage_alias_not_found:<canon>` e fica registrado no payload do `auto:classifier`.

## Excluídos do A1 (position-auditor)

Set em `pipeline-position-auditor/index.ts:35`:

```
Paciente antigo · Nutrição inativa · B2B / Stakeholders · B2B ·
Desqualificado · Lead não qualificado
```

→ A1 nunca audita leads parados nesses stages.

## Guards específicos

- **D3** (`pipeline-move.ts:177`): se o stage **atual** é "Paciente antigo" e o move é `auto:*`, abort com `guard_d3_paciente_antigo`. **Exceções**: (V5) move para "Nutrição Antigos" pelo cron de inatividade 60d, e (PR9.4) move via `auto:monthly-sweep` é idempotente e respeita o guard apenas para origens fora de Paciente antigo. Sem essas exceções, o lead só sairia dessa coluna manualmente.
- **Terminais**: `is_terminal=true` em B2B e Desqualificado. Não bloqueia o helper (sem regra `lock_auto_move`), mas a UI esconde de relatórios de funil ativos.

## Histórico do `position=1`

A migration `20260618021516` eliminou a coluna "Procedimento pago" (D1) e renomeou "Procedimento agendado" → "Tratamento agendado" (D2). 9 leads que estavam em "Procedimento pago" foram movidos para "Tratamento agendado" com `status_financeiro=pago` no `custom_fields`, e o evento registrado em `lead_stage_history` com `source='system:d1-eliminate-procedimento-pago'`.
