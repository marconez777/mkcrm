---
title: "Integração: External Forms (snippet + WordPress)"
topic: tracking
kind: reference
audience: agent
updated: 2026-06-07
summary: "Sistema que permite **qualquer site externo** (WordPress, Wix, Webflow, HTML cru) capturar leads e enviar para o mkart. Duas formas:"
---
# Integração: External Forms (snippet + WordPress)

> **Quando ler:** antes de mexer no snippet JS embedável, no plugin WordPress, ou no `forms-ingest`.
> **Última atualização:** 2026-06-03

---

## O que é

Sistema que permite **qualquer site externo** (WordPress, Wix, Webflow, HTML cru) capturar leads e enviar para o mkart. Duas formas:

1. **Snippet JS auto-discovery** (`forms-snippet`): cola 1 linha no `<head>`; intercepta `<form>` da página.
2. **Plugin WordPress** (`forms-plugin-zip`): zip baixável, integra via shortcode.

Ambos terminam batendo em `forms-ingest`.

---

## Fluxo

```text
Site externo (qualquer)
        │
        │ <script src="https://<project>.functions.supabase.co/forms-snippet?integration_id=...">
        ▼
forms-snippet retorna JS parametrizado (cache)
        │ JS escaneia <form>, intercepta submit
        ▼
POST forms-ingest { integration_id, fields, meta:{ utm, referrer, visitor_id } }
        │
        ▼
forms-ingest
   │ 1) resolve form_integrations por slug/token + form_definitions (campos)
   │ 2) detecta campos: email, phone, name (regex + heurística por name=attr — ver fieldMap em forms-ingest)
   │ 3) dedupe inline (clinic_id, phone) ou (clinic_id, ilike(email)) — não há helper findOrCreateLead
   │ 4) salva payload bruto em form_submissions
   │ 5) chama tracking-identify (se visitor_id presente)
   │ 6) dispara automations on_form_submit
   ▼
Retorna 200 { ok, lead_id, redirect_url? }
```

---

## Tabelas reais

| Tabela | Conteúdo |
|---|---|
| `form_definitions` | definição lógica do form (clinic_id, slug, campos, default_email_segment_id) |
| `form_integrations` | instância de integração (token público, allowed domains, configurações por canal) |
| `form_submissions` | cada envio com payload JSON |

> ⚠️ **Não existem** tabelas `form_sites` nem `forms` no schema atual. O par `form_definitions` (template) + `form_integrations` (endpoint público) cumpre esse papel.

---

## Snippet (`forms-snippet`)

- Edge function que serve JavaScript dinâmico.
- Headers: `Content-Type: application/javascript`, `Cache-Control: public, max-age=3600`.
- Aceita `?integration_id=...&style=embedded|popup`.
- Funcionalidades:
  - Auto-discovery: escaneia `<form>` ao DOMContentLoaded + MutationObserver.
  - Field mapping configurável via `data-mk-field="email"` ou inferência (`fieldMap` em `forms-ingest`).
  - Anti-double-submit.
  - CORS-safe (POST com `mode: cors`).

---

## Plugin WordPress (`forms-plugin-zip`)

- Edge function que **gera zip on-demand** com PHP boilerplate parametrizado pela integração.
- Plugin adiciona shortcode `[mkart_form id="..."]`.
- Integração com Contact Form 7 / WPForms via filtro `wpcf7_mail_sent` → POST `forms-ingest`.

Download: UI **Settings → Forms → Plugin WP** chama `forms-plugin-zip?integration_id=...` → browser baixa `mkart-forms-<slug>.zip`.

---

## Admin (`forms-admin`)

Edge function privada (JWT obrigatório) para:
- CRUD em `form_definitions` / `form_integrations`
- Listar submissions com filtros
- Rotacionar token público da integração

---

## Pegadinhas

- **CORS**: `forms-ingest` aceita `Origin: *` (intencional — sites externos). Validação real é por `integration_id` + `allowed_domains` em `form_integrations`.
- **Spam**: hoje sem honeypot/captcha. Risco alto se site público viralizar. TODO.
- **Campos não-padrão**: snippet salva tudo em `form_submissions.payload`. Se o lead precisar do campo "data_nascimento", custom field manual.
- **Telefone inválido**: `normalizePhone` falha → ainda cria submission, mas lead pode ficar com placeholder `email:<addr>` no `phone` ou sem phone.
- **MutationObserver pesado**: em SPAs com mil re-renders, snippet pode degradar perf. Flag `data-mk-disable-observer`.
- **Plugin WP cacheado**: WP costuma cachear scripts. Recomendar versionamento (`?v=`) ou purge ao trocar `integration_id`.
- **Redirect pós-submit**: snippet respeita `<form data-mk-redirect="/obrigado">`. Senão, deixa o form default rolar.
- **Dedupe inline**: cada entrypoint (`forms-ingest`, `external-lead-capture`, `evolution-webhook`) implementa a própria lógica de "achar ou criar lead". Helper compartilhado `findOrCreateLead` é TODO.

---

## Melhorias sugeridas

- Honeypot + reCAPTCHA invisível opcional.
- Builder de formulário hospedado na plataforma (landing pages prontas).
- Webhooks "saída" pós-submit (Zapier-like).
- Métricas: taxa de conversão por integração (visit via tracking → submit).
- Consolidar dedupe em `_shared/lead.ts`.

---

## Arquivos-chave

- `supabase/functions/forms-snippet/index.ts`
- `supabase/functions/forms-ingest/index.ts`
- `supabase/functions/forms-admin/index.ts`
- `supabase/functions/forms-plugin-zip/index.ts`
- `supabase/functions/external-lead-capture/index.ts` (variante API direta)
- `docs/features/FORMS.md`
- `docs/flows/TRACKING_TO_LEAD.md`
