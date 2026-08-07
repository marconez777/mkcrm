---
title: "Compliance multi-região (LGPD / GDPR / CCPA / TCPA)"
topic: operations
kind: reference
audience: agent
updated: 2026-06-30
summary: "Checklist de compliance por região: LGPD (BR), GDPR (ES/UE), CCPA (US-CA) e TCPA (US) — direitos do titular, opt-in e impacto no produto."
code_refs:
  - supabase/functions/admin-delete-clinic/
  - src/pages/Unsubscribe.tsx
related_docs:
  - docs/i18n/IMPORT_TEMPLATES.md
  - docs/i18n/REGION_CONFIG.md
---

# Compliance por região

## BR — LGPD (atual)

Já implementado:
- `admin-delete-clinic` (right-to-erasure)
- `email_unsubscribes` + `/unsubscribe`
- Política em `/legal/br/privacy`

Pendente: nenhum item crítico.

## ES / UE — GDPR (F-INTL-7)

| Requisito | Implementação |
|---|---|
| Consentimento granular cookies | Banner `CookieBanner.tsx` com toggles: necessary / analytics / marketing |
| Data export (Art. 20) | Endpoint `clinic-data-export` (JSON + CSV de leads, mensagens, agendamentos) |
| Right-to-erasure (Art. 17) | Reaproveitar `admin-delete-clinic` |
| DPA assinável | Página `/legal/es/dpa` com versão PDF + aceite registrado em `clinic_legal_acceptances` |
| Base legal documentada | Coluna `consent_basis` em `leads` (`consent` / `contract` / `legitimate_interest`) |
| Notificação de breach < 72h | Runbook em `docs/i18n/BREACH_RUNBOOK.md` |
| DPO email | Configurável em `app_settings.dpo_email` |

**Decisão pendente**: residência de dados na UE (projeto Supabase EU separado).

## US-CA — CCPA / CPRA (F-INTL-7)

| Requisito | Implementação |
|---|---|
| "Do Not Sell My Info" | Link no footer US + endpoint que marca `do_not_sell=true` no lead |
| Privacy notice | `/legal/us/privacy` |
| Data access request | Mesmo endpoint do GDPR |

## US — TCPA (impacto em Broadcasts)

| Requisito | Implementação |
|---|---|
| Opt-in escrito antes de SMS/WhatsApp marketing | Coluna `opt_in_date` **obrigatória** no template de disparo US (ver `IMPORT_TEMPLATES.md`) |
| Quiet hours (8h–21h local) | Scheduler bloqueia envio fora da janela conforme `lead.timezone` ou fallback `clinic.timezone` |
| STOP/HELP handling | Webhook detecta `STOP` / `UNSUBSCRIBE` e marca `email_unsubscribes` + `whatsapp_optouts` |
| Identificação do remetente | Primeira mensagem deve incluir nome da empresa (validar no template) |
| Registro de prova | `broadcast_recipients.opt_in_proof` (URL/screenshot/contrato) |

## Matriz por região

| Feature | BR | ES | US |
|---|---|---|---|
| Cookie banner | opcional | obrigatório (GDPR) | obrigatório (CCPA-CA) |
| `opt_in_date` no disparo | recomendado | recomendado | **obrigatório** |
| Quiet hours | não | recomendado | **obrigatório 8h–21h** |
| Data export | sim | sim (Art. 20) | sim (CCPA) |
| Right-to-erasure | sim (LGPD) | sim (Art. 17) | sim (CPRA) |
| DPA assinável | opcional | obrigatório B2B | opcional |
