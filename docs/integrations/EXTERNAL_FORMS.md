# Integração: External Forms (snippet + WordPress)

> **Quando ler:** antes de mexer no snippet JS embedável, no plugin WordPress, ou no `forms-ingest`.
> **Última atualização:** 2026-05-25

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
        │ <script src="https://<project>.functions.supabase.co/forms-snippet?site_id=...">
        ▼
forms-snippet retorna JS parametrizado (cache 1h)
        │ JS escaneia <form>, intercepta submit
        ▼
POST forms-ingest { site_id, payload, meta:{utm,referrer,anonymous_id} }
        │
        ▼
forms-ingest
   │ 1) valida site_id (existe em form_sites, ativo)
   │ 2) detecta campos: email, phone, name (regex + heurística por name=attr)
   │ 3) findOrCreateLead(clinic_id, phone||email)
   │ 4) salva payload bruto em form_submissions
   │ 5) tracking-identify (se anonymous_id presente)
   │ 6) dispara automations on_form_submit
   ▼
Retorna 200 { ok, lead_id, redirect_url? }
```

---

## Tabelas

| Tabela | Conteúdo |
|---|---|
| `form_sites` | sites cadastrados (site_id, clinic_id, domínios permitidos, config) |
| `form_submissions` | cada envio com payload JSON |
| `forms` | (opcional) forms "criados na plataforma" — landing pages hospedadas |

---

## Snippet (`forms-snippet`)

- Edge function que serve JavaScript dinâmico.
- Headers: `Content-Type: application/javascript`, `Cache-Control: public, max-age=3600`.
- Aceita `?site_id=...&style=embedded|popup`.
- Funcionalidades:
  - Auto-discovery: escaneia `<form>` ao DOMContentLoaded + MutationObserver.
  - Field mapping configurável via `data-mk-field="email"` ou inferência.
  - Anti-double-submit.
  - CORS-safe (POST com `mode: cors`).

---

## Plugin WordPress (`forms-plugin-zip`)

- Edge function que **gera zip on-demand** com PHP boilerplate parametrizado pelo `site_id`.
- Plugin adiciona shortcode `[mkart_form id="..."]`.
- Integração com Contact Form 7 / WPForms via filtro `wpcf7_mail_sent` → POST `forms-ingest`.

Download: UI **Settings → Forms → Plugin WP** chama `forms-plugin-zip?site_id=...` → browser baixa `mkart-forms-<site>.zip`.

---

## Admin (`forms-admin`)

Edge function privada (JWT obrigatório) para:
- CRUD em `form_sites`
- Listar submissions com filtros
- Rotacionar `site_id` (token público)

---

## Pegadinhas

- **CORS**: `forms-ingest` aceita `Origin: *` (intencional — sites externos). Validação real é por `site_id` + `allowed_domains`.
- **Spam**: hoje sem honeypot/captcha. Risco alto se site público viralizar. TODO.
- **Campos não-padrão**: snippet salva tudo em `form_submissions.payload`. Se o lead precisar do campo "data_nascimento", custom field manual.
- **Telefone inválido**: `normalizePhoneBR` falha → ainda cria submission, mas lead fica sem phone (só email).
- **MutationObserver pesado**: em SPAs com mil re-renders, snippet pode degradar perf. Flag `data-mk-disable-observer`.
- **Plugin WP cacheado**: WP costuma cachear scripts. Recomendar versionamento (`?v=`) ou purge ao trocar `site_id`.
- **Redirect pós-submit**: snippet respeita `<form data-mk-redirect="/obrigado">`. Senão, deixa o form default rolar.

---

## Melhorias sugeridas

- Honeypot + reCAPTCHA invisível opcional.
- Builder de formulário hospedado na plataforma (landing pages prontas).
- Webhooks "saída" pós-submit (Zapier-like).
- Métricas: taxa de conversão por site (visit via tracking → submit).

---

## Arquivos-chave

- `supabase/functions/forms-snippet/index.ts`
- `supabase/functions/forms-ingest/index.ts`
- `supabase/functions/forms-admin/index.ts`
- `supabase/functions/forms-plugin-zip/index.ts`
- `supabase/functions/external-lead-capture/index.ts` (variante API direta)
- `features/FORMS.md`
- `flows/TRACKING_TO_LEAD.md`
