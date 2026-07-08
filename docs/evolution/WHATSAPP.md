---
title: "Mapa â€” WhatsApp (multi-instÃ¢ncia, QR, health, seleÃ§Ã£o)"
topic: integracao
kind: map
audience: agent
updated: 2026-07-01
summary: "SuperfÃ­cie de UI + hooks + tabela whatsapp_instances. Cobre provisionamento no onboarding, gerenciamento em Settings, seleÃ§Ã£o de instÃ¢ncia no Inbox e vÃ­nculo com pipelines/broadcasts."
code_refs:
  - src/components/settings/WhatsAppQrDialog.tsx
  - src/hooks/useWhatsappInstances.ts
  - src/components/inbox/ConversationList.tsx
  - src/pages/Inbox.tsx
related_docs:
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/maps/BROADCASTS.md
  - docs/maps/INBOX_KANBAN_LEADS.md
---

# WhatsApp â€” UI, seleÃ§Ã£o e vÃ­nculos

Este mapa cobre a camada **frontend** do WhatsApp. A camada de integraÃ§Ã£o estÃ¡ em [`EVOLUTION_EDGES.md`](./EVOLUTION_EDGES.md).

## 1. Tabela `whatsapp_instances` (29 col)

Campos principais:
- Identidade: `id`, `clinic_id`, `name`, `is_default`.
- ConexÃ£o Evolution: `evolution_url`, `evolution_api_key` (sensÃ­vel), `evolution_instance` (nome interno), `webhook_token` (sensÃ­vel).
- Estado: `connection_state` (`open|connecting|close|unknown`), `last_qr` (base64), `last_qr_at`.
- Observabilidade: `last_inbound_webhook_at`, `session_stale_since`, `auto_restart_count`, `last_auto_restart_at`, `last_auto_logout_at`.

**RLS + column-level security**: `authenticated` sÃ³ faz `SELECT` de colunas nÃ£o-sensÃ­veis. `evolution_api_key` e `webhook_token` sÃ£o acessÃ­veis apenas via `service_role` (edges).

## 2. Componentes frontend

### `WhatsAppQrDialog` (173 LOC)
- Fluxo: `evolution-provision` â†’ `evolution-qr` (loop de polling 5s enquanto `connection_state != 'open'`).
- Exibe QR base64 em `<img>` + pairing code alternativo.
- Fecha quando webhook `CONNECTION_UPDATE` atualiza `connection_state='open'` (assinatura Realtime em `whatsapp_instances`).

### `useWhatsappInstances` (43 LOC)
Hook que lista instÃ¢ncias da clÃ­nica com Realtime. Usado em:
- Settings (gerenciar).
- Broadcasts (selecionar instÃ¢ncia de envio).
- Inbox (`ConversationList` â€” abas por instÃ¢ncia).
- Pipeline settings (vincular pipeline a instÃ¢ncia).

### Inbox â€” seleÃ§Ã£o de instÃ¢ncia
`src/components/inbox/ConversationList.tsx` mostra abas por instÃ¢ncia quando a clÃ­nica tem mais de uma. Regra: **uma instÃ¢ncia selecionada por vez** (nÃ£o Ã© multi-select), para evitar mistura de conversas de nÃºmeros diferentes na mesma view.

## 3. VÃ­nculos

| Entidade | Coluna | Comportamento |
|---|---|---|
| `leads.whatsapp_instance_id` | Preenchido no ingest (`ingestMessage`). Determina qual instÃ¢ncia envia mensagens ao lead. |
| `pipelines.whatsapp_instance_id` | Roteia novos leads: webhook procura pipeline com `whatsapp_instance_id = instÃ¢ncia` antes de cair no fallback. |
| `broadcasts.whatsapp_instance_id` | ObrigatÃ³rio para dar `start`. `broadcast-tick` carrega via `loadInstance(bc.whatsapp_instance_id)`. |

## 4. Onboarding

O passo "Conectar WhatsApp" no onboarding chama `WhatsAppQrDialog`. Se falhar, o usuÃ¡rio pode pular e adicionar depois em **ConfiguraÃ§Ãµes â†’ WhatsApp**.

## 5. Multi-instÃ¢ncia

- Sem limite hard-coded â€” clÃ­nica pode ter N instÃ¢ncias.
- Sempre exatamente 1 com `is_default=true` (validado no provision).
- Cada instÃ¢ncia tem seu prÃ³prio `webhook_token` (rotÃ¡vel apagando/recriando).

## 6. Invariantes

1. `is_default` Ãºnico por `clinic_id`.
2. Deletar instÃ¢ncia cascateia via `evolution-delete-instance` â€” nÃ£o apagar direto na tabela (deixa Evolution Ã³rfÃ£o).
3. Ao mudar `whatsapp_instance_id` de um lead, novas mensagens sairÃ£o pela nova instÃ¢ncia mas histÃ³rico permanece.
4. QR expira em ~60s no Evolution â€” polling em 5s cobre.
5. NÃ£o expor `evolution_api_key`/`webhook_token` em nenhuma consulta client-side.

## 7. DÃ©bitos tÃ©cnicos

- Falta UI de rotaÃ§Ã£o de `webhook_token` sem recriar instÃ¢ncia.
- Falta mÃ©trica visÃ­vel de "uptime %" por instÃ¢ncia nos Ãºltimos 7d.
- `WhatsAppQrDialog` nÃ£o trata timeout final (fica polling indefinidamente).
