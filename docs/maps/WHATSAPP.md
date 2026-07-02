---
title: "Mapa — WhatsApp (multi-instância, QR, health, seleção)"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "Superfície de UI + hooks + tabela whatsapp_instances. Cobre provisionamento no onboarding, gerenciamento em Settings, seleção de instância no Inbox e vínculo com pipelines/broadcasts."
code_refs:
  - src/components/settings/WhatsAppQrDialog.tsx
  - src/hooks/useWhatsappInstances.ts
  - src/components/inbox/ConversationList.tsx
  - src/pages/Inbox.tsx
related_docs:
  - docs/maps/EVOLUTION_EDGES.md
  - docs/maps/BROADCASTS.md
  - docs/maps/INBOX_KANBAN_LEADS.md
---

# WhatsApp — UI, seleção e vínculos

Este mapa cobre a camada **frontend** do WhatsApp. A camada de integração está em [`EVOLUTION_EDGES.md`](./EVOLUTION_EDGES.md).

## 1. Tabela `whatsapp_instances` (29 col)

Campos principais:
- Identidade: `id`, `clinic_id`, `name`, `is_default`.
- Conexão Evolution: `evolution_url`, `evolution_api_key` (sensível), `evolution_instance` (nome interno), `webhook_token` (sensível).
- Estado: `connection_state` (`open|connecting|close|unknown`), `last_qr` (base64), `last_qr_at`.
- Observabilidade: `last_inbound_webhook_at`, `session_stale_since`, `auto_restart_count`, `last_auto_restart_at`, `last_auto_logout_at`.

**RLS + column-level security**: `authenticated` só faz `SELECT` de colunas não-sensíveis. `evolution_api_key` e `webhook_token` são acessíveis apenas via `service_role` (edges).

## 2. Componentes frontend

### `WhatsAppQrDialog` (173 LOC)
- Fluxo: `evolution-provision` → `evolution-qr` (loop de polling 5s enquanto `connection_state != 'open'`).
- Exibe QR base64 em `<img>` + pairing code alternativo.
- Fecha quando webhook `CONNECTION_UPDATE` atualiza `connection_state='open'` (assinatura Realtime em `whatsapp_instances`).

### `useWhatsappInstances` (43 LOC)
Hook que lista instâncias da clínica com Realtime. Usado em:
- Settings (gerenciar).
- Broadcasts (selecionar instância de envio).
- Inbox (`ConversationList` — abas por instância).
- Pipeline settings (vincular pipeline a instância).

### Inbox — seleção de instância
`src/components/inbox/ConversationList.tsx` mostra abas por instância quando a clínica tem mais de uma. Regra: **uma instância selecionada por vez** (não é multi-select), para evitar mistura de conversas de números diferentes na mesma view.

## 3. Vínculos

| Entidade | Coluna | Comportamento |
|---|---|---|
| `leads.whatsapp_instance_id` | Preenchido no ingest (`ingestMessage`). Determina qual instância envia mensagens ao lead. |
| `pipelines.whatsapp_instance_id` | Roteia novos leads: webhook procura pipeline com `whatsapp_instance_id = instância` antes de cair no fallback. |
| `broadcasts.whatsapp_instance_id` | Obrigatório para dar `start`. `broadcast-tick` carrega via `loadInstance(bc.whatsapp_instance_id)`. |

## 4. Onboarding

O passo "Conectar WhatsApp" no onboarding chama `WhatsAppQrDialog`. Se falhar, o usuário pode pular e adicionar depois em **Configurações → WhatsApp**.

## 5. Multi-instância

- Sem limite hard-coded — clínica pode ter N instâncias.
- Sempre exatamente 1 com `is_default=true` (validado no provision).
- Cada instância tem seu próprio `webhook_token` (rotável apagando/recriando).

## 6. Invariantes

1. `is_default` único por `clinic_id`.
2. Deletar instância cascateia via `evolution-delete-instance` — não apagar direto na tabela (deixa Evolution órfão).
3. Ao mudar `whatsapp_instance_id` de um lead, novas mensagens sairão pela nova instância mas histórico permanece.
4. QR expira em ~60s no Evolution — polling em 5s cobre.
5. Não expor `evolution_api_key`/`webhook_token` em nenhuma consulta client-side.

## 7. Débitos técnicos

- Falta UI de rotação de `webhook_token` sem recriar instância.
- Falta métrica visível de "uptime %" por instância nos últimos 7d.
- `WhatsAppQrDialog` não trata timeout final (fica polling indefinidamente).
