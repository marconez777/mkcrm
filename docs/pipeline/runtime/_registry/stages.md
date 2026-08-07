---
title: "Registry — Stages e canônicos"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Uma linha por stage: nome real no banco, canônico, se o alias existe, e quem move para lá."
code_refs:
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
---

# Registry — Stages

Pipeline **`Clínica ÓR (novo)`** · `17c27f4d-8256-4ea7-b5b9-ed706494f686`
Clínica **ÓR** · `cf038458-457d-4c1a-9ac4-c88c3c8353a1`

## Como um canônico vira `stage_id`

Código nunca referencia stage por nome de coluna — usa o **canônico**, resolvido em runtime
contra `stage_canonical_aliases`. Os dois resolvedores **não são equivalentes**:

| Resolvedor | Fallback por nome |
|---|---|
| `pipeline-deterministic::resolveStageId` | ✅ tenta `ilike` exato em `pipeline_stages.name` |
| `pipeline-classify/apply.ts::resolveStageId` | ❌ nenhum — só a tabela de aliases |

Um canônico sem alias pode funcionar pela regra determinística e ser inalcançável para a IA.

## Stages

| Nome no banco | Canônico | Alias existe? | Quem move para lá | Notas |
|---|---|---|---|---|
| Leads de entrada | `Novo` | ❌ **não** | `auto:novo-lead` | Nenhum seed mapeia "Leads de entrada"→`Novo`. Quebra `auto:secretary-replied` (sempre `not_in_novo`). `KNOWN_ISSUES.md` #-11 |
| Qualificação | `Qualificação` | ✅ | `auto:secretary-replied`, `auto:appointment-sync` (cancelado), classifier `general` | Saída daqui limpa o chip `interesse` (wipe do `pipelineMove`) |
| Consulta agendada | `Consulta agendada` | ✅ | `auto:appointment-sync` (agendado/consulta, agendado/retorno) | 🔒 em `HUMAN_SCHEDULING_STAGES` — IA **não** move para cá |
| Tratamento agendado | `Tratamento agendado` | ✅ | `auto:appointment-sync` (agendado/procedimento) | 🔒 `HUMAN_SCHEDULING_STAGES`. Coluna renomeada de "Procedimento agendado" em `20260618021516` |
| Consulta finalizada | `Consulta finalizada` | ✅ | `auto:appointment-sync` (realizado/consulta), `auto:consulta-passou` | 🔒 `HUMAN_SCHEDULING_STAGES`. Entrada aqui dispara wipe de datas + `aguardando=true` |
| 1ª Sessão Finalizada | `1ª Sessão Finalizada` | ✅ | `auto:appointment-sync` (realizado/procedimento), `auto:procedimento-passou` | 🔒 `HUMAN_SCHEDULING_STAGES`. Renomeada de "Em tratamento" na PR9 (2026-06-22); alias legado aponta para o mesmo `stage_id` |
| Sem resposta | `Sem resposta` | ✅ | `auto:appointment-sync` (faltou), classifier `general` | |
| Nutrição inativa | `Nutrição inativa` | ✅ | `auto:followup-7d`, classifier `nurture`, cron 60d ex-Paciente antigo | Saída permitida do D3 |
| Nutrição Antigos (>60d) | `Nutrição Antigos` | ✅ | `auto:inactivity-tick` (SLA 60d) | Saída permitida do D3. **Não** está em `CANON_NAMES` do classifier — só a regra determinística alcança |
| Paciente antigo | `Paciente antigo` | ✅ | `auto:ciclo-concluido`, `auto:monthly-sweep-tick` | 🔒 **D3**: só sai por automação para as duas Nutrições. Classifier nem tenta mover lead que já está aqui (`locked_in_paciente_antigo`) |
| B2B / Stakeholders | `B2B / Stakeholders` | ✅ | classifier `b2b` | `is_terminal=true` |
| Desqualificado / Fora de escopo | `Desqualificado` | ❌ **não** | — | Nenhum seed mapeia esse canônico. Classifier → `stage_alias_not_found`. `is_terminal=true`. `KNOWN_ISSUES.md` #-11 |

## Lista canônica no código

`CANON_NAMES` em `pipeline-classify/schema.ts` (11 nomes — o que a IA pode sugerir):

```
Novo · Qualificação · Consulta agendada · Tratamento agendado · Consulta finalizada ·
1ª Sessão Finalizada · Sem resposta · Nutrição inativa · Paciente antigo ·
Desqualificado · B2B / Stakeholders
```

`type Canon` em `pipeline-deterministic/index.ts` (10 nomes — o que a regra bruta usa) inclui
`Nutrição Antigos` e **não** inclui `Desqualificado` nem `B2B / Stakeholders`.

⚠️ **As duas listas divergem de propósito**, mas a divergência não está expressa em nenhum tipo
compartilhado — são dois `type Canon` independentes que podem dessincronizar em silêncio.

## `TREATED_STAGES`

Conjunto que marca "lead já passou por tratamento" — alimenta `hasBeenTreatedBefore`, a regra
`1ª consulta`, e os guards de `b2b` e `nurture`:

```
1ª Sessão Finalizada · Em tratamento (alias legado) · Consulta finalizada · Paciente antigo
```

⚠️ Manter `Em tratamento` é obrigatório: `lead_stage_history` está cheio do nome antigo. Removê-lo
faz leads antigos passarem a ser tratados como novos.

## `HUMAN_SCHEDULING_STAGES`

Destinos que a IA **nunca** pode alcançar (`apply.ts`). Tentativa → `ai_scheduling_disabled_by_human_transition`:

```
Consulta agendada · Tratamento agendado · Consulta finalizada · 1ª Sessão Finalizada
```

Só humano e `auto:appointment-sync` colocam leads nesses stages.

## Verificar no banco

```sql
SELECT ps.name, sca.canonical_name
FROM pipeline_stages ps
LEFT JOIN stage_canonical_aliases sca ON sca.stage_id = ps.id
WHERE ps.pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
ORDER BY ps.position;
```
