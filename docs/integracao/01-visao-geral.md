# 01 — Visão geral da arquitetura

> **Pré-requisito:** nenhum. Comece por aqui.

---

## O big picture

```text
                              SITE EXTERNO
                       (WordPress, Next.js, etc.)
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
 [tracking-pixel.js]      [forms-snippet.js]          [seu backend]
   carrega 1× no <head>     carrega 1× no <head>     (opcional)
        │                          │                          │
        │ POST page_view,          │ intercepta <form>        │ POST direto
        │ click, custom            │ submit                   │
        ▼                          ▼                          ▼
 ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐
 │ tracking-event  │      │  forms-ingest   │      │ external-lead-capture│
 └─────────────────┘      └─────────────────┘      └─────────────────────┘
        │                          │                          │
        │                          │                          │
        ▼                          ▼                          ▼
 ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
 │ tracking_visitors│     │ form_submissions │     │     leads       │
 │ tracking_sessions│     │ form_definitions │◄────┤                 │
 │ tracking_events  │     └──────────────────┘     └─────────────────┘
 └──────────────────┘              │                       │
        │                          │                       │
        │                          │  cria/atualiza lead   │
        │                          └───────────────────────┤
        │                                                  │
        └─────────► tracking-identify (visitor→lead) ──────┤
                                                           │
                                                           ▼
                                              ┌────────────────────────┐
                                              │ automations / sequence │
                                              │ email / WhatsApp       │
                                              └────────────────────────┘
                                                           │
                                                           ▼
                                                    CRM (inbox, kanban)
```

---

## As 3 camadas

### 1. **Tracking** — quem visitou, de onde, o que fez

- **Script:** `tracking-pixel.js`
- **Cookies/storage:** `_mk_vid` (cookie, 365d), `_mk_sid` (sessionStorage, 30min)
- **Eventos automáticos:** `page_view`, `page_exit`, captura de UTMs (`utm_source`, `utm_medium`, `gclid`, `fbclid`, `ctwa_clid`, etc.)
- **Eventos custom:** `window.MK.track('clicou_cta', { ... })`
- **Onde grava:** `tracking_visitors`, `tracking_sessions`, `tracking_events`

### 2. **Forms** — capturar dados de contato

- **Script:** `forms-snippet.js`
- **Como funciona:** escuta `submit` de qualquer `<form>` da página; extrai `name`, `email`, `phone`, `message` por heurística + `data-mk-field`
- **Validação:** telefone normalizado para BR (E.164 sem `+`), email lowercase
- **Onde grava:** `form_submissions` (sempre o payload bruto), `leads` (se conseguir extrair email ou phone)
- **Bonus:** linka o `visitor_id` ao `lead` recém-criado → todos os eventos passados do visitante ficam associados ao lead

### 3. **API direta** — server-to-server

- **Endpoint:** `external-lead-capture`
- **Auth:** token privado em `x-capture-token`
- **Quando usar:** quando você não consegue (ou não quer) colocar JS no site — ex.: chatbot, CRM próprio, integração via Zapier/n8n

---

## O ciclo de vida de um lead

```text
1. Pessoa clica em anúncio FB → chega no site com ?fbclid=ABC&utm_source=facebook
                  ↓
2. tracking-pixel cria visitor_id "v_a1b2..." + session_id, salva UTMs
                  ↓
3. tracking-event registra page_view (referrer=facebook.com, utm capturados)
                  ↓
4. Pessoa navega 3 páginas — cada uma vira um page_view
                  ↓
5. Pessoa preenche form de contato (email + telefone)
                  ↓
6. forms-snippet intercepta submit → POST forms-ingest
                  ↓
7. forms-ingest:
   - Cria lead (clinic_id, email, phone, landing_page)
   - Linka visitor_id → lead (tabela tracking_identity_links)
   - Backfill: os 4 page_views anteriores agora pertencem ao lead
   - Loga lead_event = "form_submission"
   - Dispara automações on_form_submit (email de boas-vindas, etc.)
                  ↓
8. Lead aparece no kanban + inbox do CRM com toda a jornada visível
```

---

## O que cada peça resolve

| Problema | Quem resolve |
|---|---|
| Saber quantas visitas tive de cada canal | tracking-event + tracking_events |
| Saber de qual anúncio veio o lead | tracking-pixel captura UTMs, forms-ingest grava em `leads.landing_page` |
| Não criar lead duplicado quando a pessoa envia 2 forms | forms-ingest busca por `(clinic_id, phone)` ou `(clinic_id, email)` |
| Saber todas as páginas que o lead visitou antes de virar lead | tracking-identify faz backfill via `tracking_identity_links` |
| Disparar email automático no submit | automation `on_form_submit` (módulo email) |
| Bloquear que outro site use meu token | `form_integrations.allowed_domains` |

---

## Próximo passo

➡ [02 — Instalação dos snippets](./02-instalacao-snippets.md)
