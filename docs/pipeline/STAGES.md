---
title: "Pipeline — Stages atuais (Clínica ÓR)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Mapa das 12 colunas atuais do pipeline da Clínica ÓR, critério de entrada/saída, e correspondência com as 14 colunas analisadas no estudo."
related_docs:
  - docs/pipeline/SCENARIOS.md
  - docs/estudo/README.md
---

# Stages atuais — pipeline `Clínica ÓR`

Pipeline default da clínica `cf038458-457d-4c1a-9ac4-c88c3c8353a1`, id `17c27f4d-8256-4ea7-b5b9-ed706494f686`. Todas as movimentações hoje são **manuais**.

| # | Stage | Terminal? | O que entra aqui | O que faz sair |
|---|---|---|---|---|
| 0 | **Leads de entrada** | não | Todo lead novo (WhatsApp, formulário, tráfego pago) que ainda não foi triado. | Triagem humana confirma escopo → Qualificação. |
| 1 | **Qualificação** | não | Lead em conversa ativa de triagem: queixa principal, modalidade (presencial/online), profissional desejado, urgência. | Aceita preço e fecha horário → Consulta agendada. Sem fit → Desqualificado. B2B → B2B/Stakeholders. |
| 2 | **Consulta agendada** | não | Lead com data/hora confirmada de 1ª consulta ou retorno. | Consulta acontece → Consulta finalizada. Não comparece/desiste → Sem resposta. |
| 3 | **Consulta finalizada** | não | Pós-consulta: aguardando envio de NF/relatório, decisão sobre tratamento (Cetamina/EMT), agendamento de procedimento. | Fecha tratamento e marca data → Procedimento agendado. Some → Sem resposta. |
| 4 | **Procedimento agendado** | não | Procedimento (infusão de Cetamina, EMT, etc.) com data marcada. | Pagamento confirmado → Procedimento pago. |
| 5 | **Procedimento pago** | não | Pagamento (PIX/link) confirmado, pronto para execução clínica. | Início efetivo do protocolo → Em tratamento. |
| 6 | **Em tratamento** | não | Paciente em ciclo ativo de tratamento (várias sessões). | Conclui ciclo → Paciente antigo. |
| 7 | **Paciente antigo** | não | Concluiu tratamento, é base de retorno (renovação de receita, follow-ups, novos episódios). | Reativação → volta para Qualificação ou Consulta agendada. |
| 8 | **Sem resposta** | não | Parou de responder em qualquer etapa (silêncio > N dias). | Volta a responder → stage anterior. Persiste → Nutrição inativa. |
| 9 | **Nutrição inativa** | não | Reativação de longo prazo (judicial, financeiro, indecisão crônica). | Reengajou e qualificou → Qualificação. |
| 10 | **B2B / Stakeholders** | **sim** | Representantes farmacêuticos, parcerias, médicos parceiros, fornecedores. | — (não retorna ao funil comercial) |
| 11 | **Desqualificado / Fora de escopo** | **sim** | Fora de SP exigindo presencial, internação obrigatória, spam, contato errado. | — |

## Correspondência com o estudo

O estudo original analisou **14 colunas** do pipeline antigo "Agendamentos Novo". A consolidação atual aglutina alguns estados:

| Coluna do estudo | Stage atual |
|---|---|
| `00 - Leads de entrada` | Leads de entrada |
| `02 - Qualificação` | Qualificação |
| `03 - Consulta Agendada` | Consulta agendada |
| `05 - Consulta finalizada` | Consulta finalizada |
| `06 - Fechamento pendente consulta` | Consulta finalizada (sub-estado: aguardando decisão) |
| `09 - Fechamento pendente procedimento` | Consulta finalizada (sub-estado: aguardando NF/agenda) |
| `10 - Procedimento Agendado` | Procedimento agendado |
| `11 - Procedimento pago` | Procedimento pago |
| `12 - Retorno Tratamento Finalizado` | Em tratamento → Paciente antigo |
| `13 - Antigo Consulta/procedimento agendado` | Paciente antigo (em retorno) |
| `01 - Paciente antigo` | Paciente antigo |
| `07 - Lead parou de responder` | Sem resposta |
| `14 - Nutrição de Leads Inativos` | Nutrição inativa |
| `08 - Lead não qualificado` | Desqualificado / Fora de escopo |
| (não havia) | B2B / Stakeholders (criada para resolver problema #1 do estudo) |

> Implicação para automação: ao reler arquivos do estudo, mapear o título da coluna para o stage atual usando esta tabela.

## Flags por stage relevantes para automação

- `is_terminal=true` → automação NÃO deve mover leads para fora. Hoje: `B2B`, `Desqualificado`.
- `lock_auto_move=true` → automação NÃO deve mover leads PARA dentro. Hoje: nenhum stage marcado (todos `false`); ativar quando criar regras automáticas em estágios sensíveis (ex: `Procedimento pago` só por confirmação de pagamento real).
