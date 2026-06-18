---
title: "Pipeline — Cenários canônicos do estudo"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Catálogo de cenários reais das 441 conversas, padrões cross-coluna, situações que exigem humano e erros do agente antigo. Base para o AUTOMATION_PLAN."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
  - docs/estudo-geral.md
---

# Cenários canônicos — extraídos do estudo

Cada cenário é uma situação que **acontece com frequência suficiente** para virar regra/automação. Detalhe completo nas pastas `docs/estudo/<coluna>.md`.

## Convenções

- **Sinal**: o que o sistema observa (mensagens, intervalo de tempo, evento externo).
- **Ação manual hoje**: o que o atendente humano faz.
- **Ação automatizada futura**: o que poderia ser feito por regra/IA, com nível de confiança necessário.
- **Stage destino**: ver `STAGES.md`.
- **Prio**: P0 (urgente, alto volume) → P3 (nice-to-have).

---

## C1. Contato B2B / representante farmacêutico
- **Sinal**: 1ª mensagem do lead menciona "amostra", "representante", "portfólio", "parceria", "laboratório", CNPJ, "comercial".
- **Hoje**: atendente identifica e descarta manualmente, mas vários vazam para o funil clínico (problema #1 do estudo; **260 leads B2B** já marcados — ver `LEAD_SAMPLES.md`).
- **Automação**: classificador de intenção no `Leads de entrada` → mover direto para `B2B / Stakeholders` com tag `b2b_auto`.
- **Stage destino**: B2B / Stakeholders. **Prio: P0**.

## C2. Crise de saúde mental / urgência
- **Sinal**: palavras-chave "ideação suicida", "não aguento mais", "morrer", "emergência", "crise" + contexto familiar.
- **Hoje**: atendente prioriza e oferece horário.
- **Automação**: detecção de urgência → tag `urgencia_clinica` + notificação imediata para humano (não mover stage automaticamente). Trigger `tg_lead_risk_handler` já existe no banco — automação deve **adicionar** tag, nunca sobrescrever.
- **Stage destino**: Qualificação com flag. **Prio: P0**.

## C3. Fluxo de reembolso (NF + relatório)
- **Sinal**: pós-consulta, paciente pede "nota fiscal", "recibo", "relatório para convênio", "reembolso".
- **Hoje**: atendente abre tarefa interna de emissão.
- **Automação**: criar `lead_tasks` "Emitir NF/Relatório" com `due_at = +24h úteis`, registrar `lead_events.type='nf_solicitada'`.
- **Stage destino**: mantém em Consulta finalizada. **Prio: P1**.

## C4. Pagamento confirmado (PIX/link)
- **Sinal**: webhook do provedor de pagamento (futuro), OU mensagem com comprovante (imagem) + confirmação humana.
- **Hoje**: atendente confirma e move manualmente.
- **Automação (v3 — restrita)**: mover de `Procedimento agendado` → `Procedimento pago` **apenas** com sinal real. Texto sozinho ("paguei", "fiz o pix") gera tag `pagamento_alegado` + task "Confirmar pagamento" + notificação — **não move**, porque o stage tem `lock_auto_move=true`.
- **Stage destino**: Procedimento pago. **Prio: P1**.

## C5. Lead parou de responder
- **Sinal**: `last_message_at` > 5 dias úteis sem resposta em qualquer stage não terminal **E** não tem `appointments.scheduled_at > now()` (consulta futura) **E** não está em `Paciente antigo` / `Nutrição inativa` / `B2B` / `Desqualificado`.
- **Hoje**: atendente esquece ou move manual. **70%+ da base atual está aqui** (684 em Sem resposta + 457 em Paciente antigo na amostra recente).
- **Automação**: cron horário → mover para `Sem resposta` com `reason='inatividade_5d'`. Se voltar a falar, ver C6.
- **Stage destino**: Sem resposta. **Prio: P0**.

## C6. Reativação de lead inativo
- **Sinal**: lead em `Sem resposta` ou `Nutrição inativa` envia nova mensagem.
- **Hoje**: notificação genérica de mensagem nova.
- **Automação (v3 — consciente de no-show)**: ao receber inbound, decidir destino pelas tags:
  - Tem tag `no_show` → mover para `Consulta agendada` + tag `reagendamento_solicitado` + task "Oferecer novo horário".
  - Tem tag `reagendamento_pendente` (vinda de cancelamento) → idem.
  - Caso contrário → `Qualificação` + tag `reativacao` (comportamento default).
  - Se `manual_lock_until > now()` → **não mover**, só taggear `reativacao_durante_lock` + notificar atendente.
- **Stage destino**: variável. **Prio: P1**.

## C7. Aguardando decisão judicial / liminar
- **Sinal**: menção a "liminar", "processo", "ação contra o convênio", "advogado", "judicial".
- **Hoje**: atendente faz follow-up manual quinzenal.
- **Automação**: escrever `custom_fields.possui_liminar_judicial=true` (campo novo, ver `CUSTOM_FIELDS_E_TAGS.md`) + tag `judicializacao` + task recorrente "Follow-up status liminar" a cada 15 dias. **Não move stage** — humano decide se vai pra Nutrição.
- **Stage destino**: nenhum (humano decide). **Prio: P2**.

## C8. Paciente antigo pedindo renovação de receita
- **Sinal**: lead em `Paciente antigo` envia mensagem com "receita", "renovar", "Rivotril", nome de controlado.
- **Hoje**: atendente verifica data e agenda retorno se >4-6 meses.
- **Automação**: regra baseada em `appointments` mais recente. Como `Paciente antigo` é final state, **classificador não roda aqui em scans temporais** — só roda em inbound. Cria task "Validar receita digital" ou "Agendar retorno" conforme intervalo.
- **Stage destino**: mantém Paciente antigo (humano decide se vira novo episódio). **Prio: P2**.

## C9. Confirmação de consulta D-1
- **Sinal**: existe `appointments` com `scheduled_at` entre 18h–36h no futuro e status `agendado`.
- **Hoje**: lembrete enviado manualmente (e historicamente com bug: spam de 5x).
- **Automação**: cron horário → enviar template único de confirmação, registrar `lead_events.type='reminder_sent'` com `payload.appointment_id` para dedup. **NUNCA** reenviar se já existe evento `reminder_sent` para o mesmo `appointment_id`. **Não move stage** — só envia template.
- **Stage destino**: nenhum. **Prio: P0** (corrige problema #2 do estudo).

## C10. Mistura de modalidade (presencial vs online)
- **Sinal**: `custom_fields.modalidade='online'` (enum validado por trigger) mas mensagem automática menciona endereço físico.
- **Hoje**: paciente reclama, atendente corrige.
- **Automação**: validador pré-envio — templates de confirmação devem ler `custom_fields.modalidade` antes de incluir endereço. Bloqueio no nível da regra `auto:modality-guard`.
- **Stage destino**: nenhum. **Prio: P1**.

## C11. Fora de escopo geográfico
- **Sinal**: lead diz que mora fora de SP e exige atendimento presencial; sem interesse em teleconsulta.
- **Hoje**: atendente desqualifica.
- **Automação**: classificador sugere `qualificacao='desqualificado'` + `motivo_desqualificacao='fora_de_escopo_geografico'` (ambos obrigatórios juntos por trigger — ver R2). **Não move** — humano confirma. Risco de falso positivo alto.
- **Stage destino**: Desqualificado (manual). **Prio: P3**.

## C12. Objeção de preço aceitando reembolso
- **Sinal**: lead questiona R$ 750, depois pergunta sobre NF / reembolso.
- **Hoje**: atendente envia script de reembolso.
- **Automação**: sugerir resposta pronta (não enviar sozinho) no painel do atendente.
- **Stage destino**: mantém. **Prio: P2**.

## C13. Pesquisa pós-consulta / pós-procedimento (NOVO v3)
- **Sinal**: `appointments.status` muda para `realizado` (via `auto:appointment-realizado` ou `auto:procedure-realizado`).
- **Hoje**: pesquisa ad-hoc ou inexistente.
- **Automação**: ao entrar em `Consulta finalizada` (ou contar 1ª sessão em `Em tratamento`), enrollar lead em sequência de pesquisa via `stage_sequence_bindings` (ver C14). NPS D+1, follow-up clínico D+7. Padrão P2 (Procedure post-flow).
- **Stage destino**: nenhum (não move). **Prio: P2**.

## C14. Enrollment de sequência por entrada em stage (NOVO v3)
- **Sinal**: lead entra em stage X (via qualquer fonte: manual, `auto:*`, system).
- **Mecanismo**: tabela `stage_sequence_bindings` (a criar — schema em `AUTOMATION_PLAN.md` Fase 0) mapeia `(pipeline_id, stage_id) → message_sequences.id`. Trigger em `lead_stage_history` enrolla automaticamente em `message_sequence_enrollments`.
- **Casos iniciais sugeridos**:
  - `Sem resposta` → sequência "Tentativa de reativação 3-toques" (D+1, D+3, D+7).
  - `Consulta finalizada` → sequência "Pós-consulta NPS+follow-up" (D+1, D+7).
  - `Procedimento pago` → sequência "Pré-procedimento" (D-2, D-1).
- **Auditoria**: enrollment grava `source='auto:stage_binding'` em `message_sequence_enrollments.metadata`.
- **Prio: P2**.

---

## Padrões cross-coluna (8 padrões observados no estudo)

| P | Padrão | Colunas afetadas | Implicação para automação |
|---|---|---|---|
| P1 | **Confusão B2B vs paciente** | Leads de entrada, Qualificação | Classificador de Fase 2 obrigatório; manter humano-only enquanto não estiver em prod. |
| P2 | **Familiar fala pelo paciente** | Qualificação, Consulta agendada, Procedimento agendado, Em tratamento, Paciente antigo, Sem resposta (6 colunas) | Classificador deve escrever `custom_fields.nome_responsavel_financeiro` separado de `leads.name`. Nunca renomear o lead. |
| P3 | **Modalidade inconsistente** | Consulta agendada, Procedimento agendado | `auto:modality-guard` pré-envio. |
| P4 | **Procedimento "pago" só no texto** | Procedimento agendado, Procedimento pago | `lock_auto_move=true` em Procedimento pago; texto vira tag, não movimento. |
| P5 | **Lembretes duplicados** | Consulta agendada, Procedimento agendado | Dedup por `lead_events` com `appointment_id`. |
| P6 | **Inatividade silenciosa** | Qualificação, Consulta finalizada (sem appointment futuro) | `auto:inactivity-5d` com exclusões de R7. |
| P7 | **No-show vira "fui esquecido"** | Sem resposta (após faltou) | Reativação consciente de tag `no_show` (C6). |
| P8 | **Renovação de receita = novo episódio** | Paciente antigo | Não roda em scans; humano confirma se vira Qualificação. |

---

## 10 situações que exigem humano (NÃO automatizar)

1. Crise/ideação suicida (C2) — só taggear + notificar.
2. Decisão de desqualificação (C11) — só sugerir.
3. Confirmação de pagamento sem webhook (C4) — só tag + task.
4. Mover lead em `manual_lock_until` ativo — bloqueio absoluto.
5. Resposta livre ao paciente (cobertura: agente de auto-reply é separado).
6. Conclusão de ciclo de tratamento (Em tratamento → Paciente antigo).
7. Movimentação para `Desqualificado` ou `B2B` (terminal sem retorno).
8. Renomear lead (sempre `leads.name` canônico, classificador escreve só em `custom_fields.nome_responsavel_financeiro`).
9. Sobrescrever `custom_fields` com valor humano-escrito nos últimos 7 dias (R10).
10. Mover lead com appointment futuro por inatividade.

---

## Erros do agente IA antigo (a NÃO repetir)

Vieram do estudo (§6 de `estudo-geral.md`) + análise de tentativas anteriores. Toda automação nova deve ter teste explícito contra:

| E | Erro | Cenário | Mitigação v3 |
|---|---|---|---|
| E1 | Confundir B2B com paciente | C1 | Classificador Fase 2, confidence ≥ 0.85, `b2b_auto` tag para rollback. |
| E2 | Loop/spam de lembretes (5x) | C9 | Dedup `lead_events.reminder_sent` por `appointment_id`. |
| E3 | Trocar nome do paciente | P2 | Escrever em `custom_fields.nome_responsavel_financeiro`, nunca em `leads.name`. |
| E4 | Endereço para consulta online | C10 | `auto:modality-guard` pré-envio. |
| E5 | Mensagem motivacional fora de contexto | — | Sem trigger explícito = nenhum envio. |
| E6 | Mover lead que humano acabou de tocar | — | `manual_lock_until` = 7d, checagem em todo `auto:*` que move stage. |
| E7 | Sobrescrever tags do trigger de risco | C2 | Sempre MERGE em tags, nunca SET. |
| E8 | Mover para Desqualificado sem `motivo` | C11 | Trigger `trg_validate_lead_custom_fields_enums` rejeita; classificador deve preencher juntos. |
| E9 | Escrever `pipeline_id` direto | — | Trigger `sync_lead_pipeline_id` deriva automaticamente; nunca escrever. |
| E10 | Mover por texto "paguei" sem dinheiro caído | C4 | `lock_auto_move=true` em Procedimento pago; só webhook/comprovante+humano. |

Cinco erros adicionais de "LLM decidiu sem gate" — todos cobertos pelos 10 gates do `AUTOMATION_PLAN.md`.
