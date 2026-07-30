---
title: "Redução de custo Cloud (sem perder performance)"
topic: infra
kind: roadmap
audience: agent
updated: 2026-07-30
status: pendente
---

# Roadmap — Redução de custo Cloud

Contexto: no ciclo 13/jul–13/ago o projeto consumiu **23,27 créditos de Cloud**
(~48% de todo o Cloud da workspace). Distribuição: compute micro 9,59 /
egress 8,01 / edge functions 4,69. O compute **já está no menor tier**, então o
ganho real está em **volume de queries, egress e storage**.

Nenhum item abaixo foi executado ainda.

## C1 — Consolidar leituras do webhook Evolution em 1 RPC

- **Onde**: `supabase/functions/evolution-webhook/`, `_shared/evolution.ts`
- **Hoje**: cada evento faz várias queries sequenciais (instância, pipeline,
  lead, mensagens) → ~5M queries/mês.
- **Ação**: criar uma RPC `resolve_inbound_context(instance, remote_jid)` que
  devolve instância + pipeline + lead num único round-trip.
- **Impacto**: −~5M queries/mês, egress −30-40%.
- **Risco**: médio (caminho crítico do inbound). Exige teste de regressão do
  ingest antes de ativar; manter fallback para o caminho antigo por 1 semana.
- **Pronto quando**: inbound continua 100% e `slow_queries` mostra queda do
  bloco de SELECTs do webhook.

## C2 — Parar de gravar `payload jsonb` bruto em `webhook_events`

- **Onde**: `evolution-webhook`, tabela `webhook_events`
- **Ação**: gravar apenas um resumo (tipo, instância, remote_jid, message_id) e
  manter o payload completo só quando `status = error`.
- **Impacto**: principal fonte de crescimento de disco e de egress de backup.
- **Risco**: baixo — perde-se replay completo de eventos OK (que hoje quase
  nunca é usado; erros continuam com payload).
- **Pronto quando**: crescimento diário da tabela cai >80%.

## C3 — Cache in-memory de `whatsapp_instances` no webhook (TTL 60s)

- **Onde**: `supabase/functions/_shared/evolution.ts`
- **Ação**: Map em memória por `instance_name` com TTL 60s; invalidar em
  eventos `CONNECTION_UPDATE`.
- **Impacto**: −~1,6M queries/mês.
- **Risco**: baixo. Atenção: mudança de status de instância pode demorar até
  60s para refletir — por isso a invalidação no CONNECTION_UPDATE é obrigatória.
- **Pronto quando**: contador de SELECT em `whatsapp_instances` cai >90%.

## C4 — Purge de `webhook_events` > 7 dias

- **Onde**: cron + função `cleanup_webhook_events`
- **Ação**: agendar purge diário mantendo 7 dias (30 dias para linhas com erro).
- **Impacto**: libera disco, adia upgrade de compute.
- **Risco**: baixo.
- **Pronto quando**: cron ativo e tamanho da tabela estável.

## Ordem sugerida

C4 → C3 → C2 → C1 (do menor risco/maior retorno imediato para o mais invasivo).
