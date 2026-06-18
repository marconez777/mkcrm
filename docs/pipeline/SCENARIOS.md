---
title: "Pipeline — Cenários canônicos do estudo"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Catálogo de cenários reais encontrados nas 441 conversas analisadas, com sinais de detecção, ação ideal no pipeline e prioridade para automação."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
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
- **Hoje**: atendente identifica e descarta manualmente, mas vários vazam para o funil clínico (problema #1 do estudo).
- **Automação**: classificador de intenção no `Leads de entrada` → mover direto para `B2B / Stakeholders` com tag `b2b_auto`. Lock manual de 24h para revisão.
- **Stage destino**: B2B / Stakeholders. **Prio: P0**.

## C2. Crise de saúde mental / urgência
- **Sinal**: palavras-chave "ideação suicida", "não aguento mais", "morrer", "emergência", "crise" + contexto familiar.
- **Hoje**: atendente prioriza e oferece horário.
- **Automação**: detecção de urgência → tag `urgencia_clinica` + notificação imediata para humano (não mover stage automaticamente).
- **Stage destino**: Qualificação com flag. **Prio: P0**.

## C3. Fluxo de reembolso (NF + relatório)
- **Sinal**: pós-consulta, paciente pede "nota fiscal", "recibo", "relatório para convênio", "reembolso".
- **Hoje**: atendente abre tarefa interna de emissão.
- **Automação**: criar `lead_tasks` "Emitir NF/Relatório" com `due_at = +24h úteis`, registrar `lead_events.type='nf_solicitada'`.
- **Stage destino**: mantém em Consulta finalizada. **Prio: P1**.

## C4. Pagamento confirmado (PIX/link)
- **Sinal**: mensagem com comprovante (imagem), texto "paguei", "fiz o pix", ou webhook do provedor de pagamento.
- **Hoje**: atendente confirma e move manualmente.
- **Automação**: mover de `Procedimento agendado` → `Procedimento pago`, criar tarefa "Notificar enfermagem", registrar `lead_events.type='payment_confirmed'`.
- **Stage destino**: Procedimento pago. **Prio: P1**.

## C5. Lead parou de responder
- **Sinal**: `last_message_at` > 5 dias úteis sem resposta humana ou do lead em qualquer stage não terminal.
- **Hoje**: atendente esquece ou move manual.
- **Automação**: cron diário → mover para `Sem resposta` com `reason='inatividade_5d'`. Se voltar a falar, devolve ao stage anterior automaticamente.
- **Stage destino**: Sem resposta. **Prio: P0** (alto volume, baixa ambiguidade).

## C6. Reativação de lead inativo
- **Sinal**: lead em `Sem resposta` ou `Nutrição inativa` envia nova mensagem.
- **Hoje**: notificação genérica de mensagem nova.
- **Automação**: ao receber inbound, mover de volta para `Qualificação` (não para o stage onde parou — passou tempo) e taggear `reativacao`.
- **Stage destino**: Qualificação. **Prio: P1**.

## C7. Aguardando decisão judicial / liminar
- **Sinal**: menção a "liminar", "processo", "ação contra o convênio", "advogado", "judicial".
- **Hoje**: atendente faz follow-up manual quinzenal.
- **Automação**: mover para `Nutrição inativa` com tag `judicializacao`, criar tarefa recorrente "Follow-up status liminar" a cada 15 dias.
- **Stage destino**: Nutrição inativa. **Prio: P2**.

## C8. Paciente antigo pedindo renovação de receita
- **Sinal**: lead em `Paciente antigo` envia mensagem com "receita", "renovar", "Rivotril", nome de controlado.
- **Hoje**: atendente verifica data e agenda retorno se >4-6 meses.
- **Automação**: regra baseada em `appointments` mais recente: se >6m → criar tarefa "Agendar retorno" + mensagem template; se <6m → criar tarefa "Validar receita digital".
- **Stage destino**: mantém Paciente antigo (ou move para Qualificação se for novo episódio). **Prio: P2**.

## C9. Confirmação de consulta D-1
- **Sinal**: existe `appointments` com `scheduled_at` entre 18h–36h no futuro e status `agendado`.
- **Hoje**: lembrete enviado manualmente (e historicamente com bug: spam de 5x).
- **Automação**: cron horário → enviar template único de confirmação, registrar `lead_events.type='reminder_sent'` para dedup. **NUNCA** reenviar se já existe evento `reminder_sent` na janela.
- **Stage destino**: nenhum. **Prio: P0** (corrige problema #2 do estudo).

## C10. Mistura de modalidade (presencial vs online)
- **Sinal**: `custom_fields.modalidade='online'` mas mensagem automática menciona endereço físico.
- **Hoje**: paciente reclama, atendente corrige.
- **Automação**: validador pré-envio — templates de confirmação devem ler `custom_fields.modalidade` antes de incluir endereço.
- **Stage destino**: nenhum. **Prio: P1** (corrige problema #4 do estudo).

## C11. Fora de escopo geográfico
- **Sinal**: lead diz que mora fora de SP e exige atendimento presencial; sem interesse em teleconsulta.
- **Hoje**: atendente desqualifica.
- **Automação**: depois de qualificação humana confirmar, sugerir movimentação para `Desqualificado`. NÃO automatizar movimentação direto — risco de falso positivo.
- **Stage destino**: Desqualificado. **Prio: P3**.

## C12. Objeção de preço aceitando reembolso
- **Sinal**: lead questiona R$ 750, depois pergunta sobre NF / reembolso.
- **Hoje**: atendente envia script de reembolso.
- **Automação**: sugerir resposta pronta (não enviar sozinho) no painel do atendente, com link para `STAGES.md` script.
- **Stage destino**: mantém. **Prio: P2**.

---

## Erros do agente IA antigo (a NÃO repetir)

Vieram do estudo (§6 de `estudo-geral.md`). Toda automação nova deve ter teste explícito contra:

1. Confundir contato B2B com paciente (cenário C1).
2. Loop/spam de lembretes (cenário C9 — dedup obrigatória).
3. Trocar nomes do paciente ao longo da conversa (sempre usar `leads.name` canônico).
4. Enviar endereço físico para consulta online (cenário C10).
5. Disparar mensagem motivacional fora de contexto (sem trigger explícito = nenhum envio).
