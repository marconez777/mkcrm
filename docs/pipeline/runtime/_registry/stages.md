---
title: "Registry — Stages e canônicos"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-12
verified_at: 2026-08-12
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

> ⚠️ **Atualizado em 12/08/2026 — o funil virou dois.** A Clínica ÓR passou a ter
> **Clínica ÓR — Vendas** (`17c27f4d-…`) e **Clínica ÓR — Pacientes**. Movimentação
> entre eles só acontece com linha declarada em `pipeline_crossings` (gate G9).
> **A IA não move card em nenhum dos dois** — os três caminhos do classifier foram
> removidos. Ver `docs/tenants/clinica-or/FLUXO_ALVO.md`.

### Funil de Vendas

| Nome no banco | Canônico | Alias | Quem move para lá | Notas |
|---|---|---|---|---|
| Leads de entrada | `Novo` | ❌ | `auto:novo-lead` | Nenhum seed mapeia "Leads de entrada"→`Novo`. Quebra `auto:secretary-replied` (sempre `not_in_novo`) |
| Qualificação | `Qualificação` | ✅ | `auto:secretary-replied`, `auto:reactivation-inbound` (de Nutrição Inativa) | Saída daqui limpa o chip `interesse` (wipe do `pipelineMove`) |
| Sem resposta | `Sem resposta` | ✅ | **`auto:followup-24h`** (24h sem mensagem do paciente em Qualificação) | Entrada dispara FU#1; FU#2 em +48h. Ambos `run_once` |
| Nutrição Inativa (Geladeira de Leads) | `Nutrição inativa` | ✅ | `stage_idle` 7d saindo de Sem Resposta | Cadência de reengajamento na entrada |
| Desqualificado / Fora de escopo | — | ❌ | só manual | `is_terminal=true`. Sem canônico: nenhuma automação alcança |
| Administrativo | `B2B / Stakeholders` (legado) | ✅ | só manual | Ex-"B2B / Stakeholders", renomeada em 12/08 mantendo o `stage_id`. O canônico legado não é resolvido por ninguém |
| Nutrição Antigos (migrada) | — | ❌ removido | — | Esvaziada no Bloco B; alias apagado de propósito para nenhuma regra resolvê-la |

### Funil de Pacientes

| Nome no banco | Canônico | Alias | Quem move para lá | Notas |
|---|---|---|---|---|
| Consulta agendada | `Consulta agendada` | ✅ | `auto:field-changed-consulta` 🔀, `auto:appointment-sync` (agendado/consulta, agendado/retorno) 🔀 | Nunca esfria por inatividade (decisão D5) |
| Tratamento agendado | `Tratamento agendado` | ✅ | `auto:field-changed-procedimento` 🔀, `auto:appointment-sync` (agendado/procedimento) 🔀 | Idem. Lembretes 24h/1h ainda não existem para tratamento |
| Consulta finalizada | `Consulta finalizada` | ✅ | `auto:appointment-sync` (realizado/consulta), **manual** | Entrada dispara wipe de datas + `aguardando=true` e a pesquisa de satisfação (`run_once`) |
| Tratamento Finalizado | `1ª Sessão Finalizada` | ✅ | `auto:appointment-sync` (realizado/procedimento), **manual** | Ex-"Tratamento Ativo", ex-"Em tratamento". O canônico sobreviveu a dois renames |
| **Reagendamento** | `Reagendamento` | ✅ | `auto:appointment-sync` (faltou, cancelado), `auto:field-cleared-reagendamento`, `auto:reactivation-inbound` (de Finalizada e Paciente Inativo) | Coluna de trabalho do funil. 7 dias parado → Paciente Inativo |
| Paciente Inativo | `Paciente antigo` | ✅ | `stage_idle` 60d de Finalizada, `stage_idle` 7d de Reagendamento | Ex-"Paciente antigo", fundida com "Nutrição Antigos" no Bloco B. Fim da linha: só sai se o paciente voltar a falar |

🔀 = travessia entre funis, exige linha em `pipeline_crossings`

## Lista canônica no código

`CANON_NAMES` em `pipeline-classify/schema.ts` (11 nomes — o que a IA pode sugerir):

```
Novo · Qualificação · Consulta agendada · Tratamento agendado · Consulta finalizada ·
1ª Sessão Finalizada · Sem resposta · Nutrição inativa · Paciente antigo ·
Desqualificado · B2B / Stakeholders
```

> ⚠️ **Desde 12/08/2026 essa lista não move nada.** Os três caminhos de
> movimentação do classifier (`auto:classifier-general`, `-nurture`, `-b2b`) foram
> **removidos**. `CANON_NAMES` sobrevive apenas como vocabulário do prompt: a IA
> ainda *sugere* um stage, e a sugestão é registrada em telemetria sem efeito.

`type Canon` em `pipeline-deterministic/index.ts` (11 nomes — o que a regra bruta usa)
inclui `Nutrição Antigos` e `Reagendamento`, e **não** inclui `Desqualificado` nem
`B2B / Stakeholders`.

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

> ✅ **Corrigido em 12/08/2026.** Antes esse conjunto era comparado contra o **nome
> real** da coluna. Quando "1ª Sessão Finalizada" virou "Tratamento Ativo", a
> detecção parou de funcionar e a IA rebaixou 5 pacientes em tratamento para
> Qualificação — a última em 11/08 às 14:42. Agora `hasBeenTreatedBefore` resolve
> por **apelido canônico** (`context.ts`), imune a rename.
>
> Há uma **segunda cópia divergente** de `TREATED_STAGES` em
> `pipeline-classify/rules/first-consult.ts`, sem `1ª Sessão Finalizada`. Ainda
> compara por nome. Pendente.

## `HUMAN_SCHEDULING_STAGES` — removido

Existia em `apply.ts` para impedir a IA de alcançar as colunas de agendamento.
**Foi removido em 12/08/2026** junto com os caminhos de movimentação: sem move,
não há destino a bloquear. Quem coloca lead nessas colunas hoje é a secretária
(preenchendo a data) ou `auto:appointment-sync`.

## Verificar no banco

```sql
SELECT ps.name, sca.canonical_name
FROM pipeline_stages ps
LEFT JOIN stage_canonical_aliases sca ON sca.stage_id = ps.id
WHERE ps.pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
ORDER BY ps.position;
```
