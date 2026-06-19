---
title: "Pipeline — Stages atuais (Clínica ÓR)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-19
summary: "Mapa das 11 colunas do pipeline da Clínica ÓR (v5), critério de entrada/saída, e automações de inatividade."
related_docs:
  - docs/pipeline/SCENARIOS.md
  - docs/pipeline/AUTOMATION_V5_ARCHITECTURE.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
  - docs/estudo/README.md
---

# Stages atuais — pipeline `Clínica ÓR` (v5)

Pipeline default da clínica `cf038458-457d-4c1a-9ac4-c88c3c8353a1`. Totalmente autônomo (v5).

**Mudanças vs v3**:
- D1: "Procedimento pago" **removida** como coluna. Pagamento vira campo `status_financeiro`.
- D2: "Procedimento agendado" **renomeada** para "Tratamento agendado". Termo "procedimento" sai do vocabulário operacional (mantido só como alias técnico).
- Total de colunas: **12 → 11**.

## Tabela de stages

| # | Stage | Terminal? | Entrada via automação | Excluído de scans temporais |
|---|---|---|---|---|
| 0 | **Leads de entrada** | não | sim (lead novo via `evolution-webhook`) | não |
| 1 | **Qualificação** | não | sim (`auto:secretary-replied`, `auto:classifier` após resposta) | não |
| 2 | **Consulta agendada** | não | sim (`auto:appointment-agendado`, `auto:classifier` se extrair data confirmada) | não |
| 3 | **Consulta finalizada** | não | sim (`auto:appointment-realizado`) | não |
| 4 | **Tratamento agendado** | não | sim (`auto:appointment-agendado` kind=procedimento) | não |
| 5 | **Em tratamento** | não | sim (`auto:procedure-realizado` na 1ª sessão do ciclo) | não |
| 6 | **Paciente antigo** | não | manual (ciclo concluído). **Travado para saída (Guard D3)**, exceto inatividade extrema. | **sim** (final state) |
| 7 | **Sem resposta** | não | sim (Automação UI: SLA de 24h sem resposta) | não |
| 8 | **Nutrição inativa** | não | sim (Automação UI: +48h sem resposta, ou cron `pipeline-deterministic` após 60d para Paciente antigo) | **sim** (final state) |
| 9 | **B2B / Stakeholders** | **sim** | sim (Classificação IA) | sim |
| 10 | **Desqualificado / Fora de escopo** | **sim** | sim (Classificação IA) | sim |

### Notas das flags

- **Excluído de scans temporais**: jobs `auto:followup-*` e demais varreduras por tempo **NÃO** processam stages finais. Custo zero de retorno.
- **Exceção do inactivity**: leads com agendamentos futuros não caem nas regras de inatividade (SLA).

## Lock manual vs lock de auto-mover

São coisas **diferentes**:

| Lock | O que bloqueia | O que NÃO bloqueia | Duração |
|---|---|---|---|
| `leads.manual_lock_until` | Movimentação automática de stage (qualquer regra `auto:*`) | Classificador escrevendo `tags`, `custom_fields`, `ai_summary`; criação de tasks | **7 dias** após arraste humano. **Renovado** a cada nova ação humana detectada pelo reator (D7). |
| `pipeline_stages.lock_auto_move` | Entrada automática NESTE stage destino | Saída automática | Permanente (flag de schema). |

**Implicação:** dentro do lock manual de 7 dias, o classificador continua taggeando, resumindo conversa e sugerindo. Só **não move** o card.

## Critério de "Paciente antigo" (Guard D3 / V5)

A IA não tem autorização para tirar cards dessa coluna (`pipelineMove` bloqueia). Se o lead agenda uma nova consulta, a IA **atualiza apenas os Chips** (custom fields de data/procedimento) e o card permanece na coluna para preservar o histórico visual do médico.
Saída de "Paciente antigo" só acontece por humano arrastando para outra coluna, ou por cron caindo em Nutrição Inativa após 60 dias de silêncio.

## Critério de "Em tratamento" (D-bonus)

- **Entrada**: 1ª sessão `realizada` (`auto:procedure-realizado` 1ª invocação por ciclo).
- **Permanência**: sessões subsequentes apenas incrementam `custom_fields.sessoes_realizadas` (numérico). **Não movem stage.**
- **Saída**: humano marca `custom_fields.ciclo_concluido=true` → `auto:ciclo-concluido` move para "Paciente antigo".

## Status independentes do stage

A partir da v4.1, dois eixos de status são **campos**, não colunas:

| Campo | Enum | Quem escreve | Independência |
|---|---|---|---|
| `status_financeiro` | `pendente \| parcial \| pago \| reembolsado \| cancelado \| isento \| nao_se_aplica` | humano (manual) ou webhook real de pagamento | Regras de stage **nunca leem** este campo. Separação de preocupações. |
| `status_consulta` | `agendada \| realizada \| faltou \| cancelada \| reagendada` | humano (manual) ou reator (D7) após appointment update | Reator humano lê este campo e infere consequência (ver `AUTOMATION_PLAN.md`). |

## Correspondência com o estudo (14 colunas → 11 stages v4.1)

O estudo original analisou **14 colunas** do pipeline antigo "Agendamentos Novo". Consolidação atual:

| Coluna do estudo | Stage v4.1 |
|---|---|
| `00 - Leads de entrada` | Leads de entrada |
| `02 - Qualificação` | Qualificação |
| `03 - Consulta Agendada` | Consulta agendada |
| `05 - Consulta finalizada` | Consulta finalizada |
| `06 - Fechamento pendente consulta` | Consulta finalizada (sub-estado via `status_financeiro=pendente`) |
| `09 - Fechamento pendente procedimento` | Tratamento agendado (sub-estado via `status_financeiro=pendente`) |
| `10 - Procedimento Agendado` | Tratamento agendado |
| `11 - Procedimento pago` | Tratamento agendado com `status_financeiro=pago` (coluna eliminada — D1) |
| `12 - Retorno Tratamento Finalizado` | Em tratamento → Paciente antigo |
| `13 - Antigo Consulta/procedimento agendado` | Paciente antigo (com tag `consulta_agendada`/`tratamento_em_andamento` — D3) |
| `01 - Paciente antigo` | Paciente antigo |
| `07 - Lead parou de responder` | Sem resposta |
| `14 - Nutrição de Leads Inativos` | Nutrição inativa |
| `08 - Lead não qualificado` | Desqualificado / Fora de escopo |
| (não havia) | B2B / Stakeholders |

## Migração desde v3

```sql
-- D1: eliminar coluna 'Procedimento pago'
UPDATE leads
   SET stage_id = (SELECT id FROM pipeline_stages
                    WHERE pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
                      AND name = 'Tratamento agendado'),
       custom_fields = jsonb_set(coalesce(custom_fields,'{}'::jsonb),
                                 '{status_financeiro}', '"pago"', true)
 WHERE stage_id IN (SELECT id FROM pipeline_stages
                     WHERE pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
                       AND name = 'Procedimento pago');

DELETE FROM pipeline_stages
 WHERE pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
   AND name = 'Procedimento pago';

-- D2: renomear stage
UPDATE pipeline_stages
   SET name = 'Tratamento agendado'
 WHERE pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
   AND name = 'Procedimento agendado';
```

Migration completa (com criação de campos novos, recompactação de `position`, etc.) sai na Fase 0 de implementação — fora do escopo desta rodada de docs.
