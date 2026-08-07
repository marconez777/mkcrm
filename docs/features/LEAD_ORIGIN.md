---
title: "Origem do lead (campo nativo)"
topic: tracking
kind: feature
audience: agent
updated: 2026-07-31
summary: "Campo nativo de origem em leads, preenchido automaticamente pelo tracking, formulários, e-mail e WhatsApp."
code_refs:
  - supabase/functions/_shared/lead-origin.ts
  - supabase/functions/tracking-identify/
  - supabase/functions/forms-ingest/
  - supabase/functions/external-lead-capture/
  - src/lib/lead-origin.ts
  - src/components/inbox/LeadOriginField.tsx
---

# Origem do lead (campo nativo)

Antes: `custom_fields.origem` (campo personalizado por clínica, preenchido à mão
ou inferido pela IA). Agora: colunas nativas em `leads`, iguais para todos os
tenants, alimentadas pelo tracking.

## Colunas

| Coluna | Descrição |
|---|---|
| `origin_channel` | canal canônico (`google_organic`, `google_ads`, `meta_ads`, `instagram`, `facebook`, `youtube`, `email`, `referral`, `form`, `whatsapp_direct`, `test`, `other`, `unknown`) |
| `origin_label` | rótulo exibido (PT-BR) |
| `origin_detail` | source / medium / campanha, ou nome do formulário |
| `origin_source_type` | de onde veio a dedução (`tracking:conversion_touch`, `form`, `email`, `whatsapp_direct`, `manual:user`, `manual:legacy_custom_field`) |
| `origin_locked_by_user` | edição humana — automação nunca sobrescreve |
| `origin_updated_at` | última atualização |

## Prioridade

`tracking` (4) > `form` / `email` (3) > `whatsapp_direct` / `test` (2) > fallback (1).
Uma origem só é substituída por outra de prioridade igual ou maior, e nunca
quando `origin_locked_by_user = true`.

## Onde é escrita

- `tracking-identify` — após congelar `tracking_lead_sources` (cobre o `(ref=...)` do WhatsApp).
- `evolution-webhook` — fallback `whatsapp_direct` quando nenhum visitante casa.
- `forms-ingest` / `external-lead-capture` — chamam `tracking-identify` (quando há `visitor_id`) e caem para `form`.
- `resend-webhook` — clique em campanha marca `email`.
- UI (`LeadOriginField`) — edição manual, marca `origin_locked_by_user`.

## Invariantes

- A IA **nunca** escreve origem: `pipeline-classify/apply.ts` rejeita a chave `origem`
  com motivo `field_owned_by_tracking`.
- O catálogo de canais é fixo no código (`_shared/lead-origin.ts` + `src/lib/lead-origin.ts`);
  não criar campo personalizado "origem" por clínica de novo.
