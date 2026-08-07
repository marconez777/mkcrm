---
title: "Formulários (Ingest Público)"
topic: tracking
kind: map
audience: agent
updated: 2026-07-01
summary: "Ingest público de formulários via snippet JS, plugin WordPress ou POST direto — upsert de lead + auto-descoberta de definitions."
code_refs:
  - src/pages/SettingsForms.tsx
  - supabase/functions/forms-ingest/
  - supabase/functions/forms-admin/
  - supabase/functions/forms-snippet/
  - supabase/functions/forms-plugin-zip/
related_docs:
  - docs/maps/TRACKING.md
  - docs/maps/INBOX_KANBAN_LEADS.md
---

# Formulários — Mapa Runtime

Sistema universal de captura de formulários externos (sites, landing
pages, CF7, Elementor, WPForms, Gravity, Fluent). Ingest é público
autenticado por **token de integração** (`x-form-token` header).

## 1. Frontend

`/settings/forms` e `/settings/integration` → `src/pages/SettingsForms.tsx`
(869 LOC). CRUD de `form_integrations`, exibe token (buscado via
`forms-admin` `get_token`; nunca vem do banco), lista `form_definitions`
descobertas, mostra últimas `form_submissions` e permite baixar o plugin
WordPress + copiar snippet.

## 2. Edge functions (4)

### 2.1 `forms-ingest` (333 LOC) — POST público

CORS **echoing origin** com `credentials: true` (spec proíbe `*` +
credentials — bug documentado em `docs/known-issues/PITFALLS.md`).

Header obrigatório: `x-form-token` (validado contra
`form_integrations.token`). Verifica `allowed_domains` (se configurado).

Fluxo:

1. Valida token + domínio.
2. Identifica `form_key` (data-mk-form / id / name / action).
3. **Auto-descoberta**: se `form_definitions` não existe para esse
   `form_key`, cria uma com heurística de `field_map` (email/name/phone/
   message por keywords).
4. Aplica `field_map` para extrair `email/name/phone`.
5. Upsert em `leads` (matching por email OU phone).
6. Insere `form_submissions` com raw fields + UTMs + visitor_id/session_id.
7. Aplica `default_tags` da integração ao lead.
8. Incrementa `form_integrations.total_submissions` +
   `form_definitions.total_submissions`.
9. Se lead novo, dispara `email-automations-tick` triggers do tipo
   `lead_created` no próximo ciclo.

### 2.2 `forms-admin` (173 LOC) — POST autenticado

Valida JWT in-code (owner/admin da clínica ou super_admin). Actions:

- `list` / `create` / `update` / `delete` de integrações.
- `rotate_token` — gera novo token, invalida o antigo.
- `get_token` — retorna token em claro (single-use disclosure).
- `list_definitions` / `update_definition` / `delete_definition` — mapeia
  field_map manualmente sobrepondo a auto-descoberta.
- `list_submissions` — pager com filtros.

### 2.3 `forms-snippet` (77 LOC) — GET público

Serve `forms.js?token=<T>` inline. Detecta submits de qualquer `<form>`,
lê cookies `_mk_vid`/`_mk_sid` (do tracker), coleta campos e envia via
`navigator.sendBeacon` + fallback fetch. Suporta atributo `data-mk-form`
para nomear formulários.

### 2.4 `forms-plugin-zip` (174 LOC) — GET público

Gera `.zip` do plugin WordPress on-the-fly (JSZip). O PHP hooks em
`wpcf7_before_send_mail`, `elementor_pro/forms/new_record`,
`wpforms_process_complete`, `gform_after_submission`,
`fluentform/submission_inserted` e envia para `forms-ingest` com o token
salvo em options. Instalável em qualquer WP.

## 3. Modelo de dados

- `form_integrations` (18 cols) — 1 por site cliente. Coluna `token`
  privada (não sai via API pública — só `forms-admin get_token`).
- `form_definitions` (15 cols) — 1 por form_key único; `field_map` JSONB.
- `form_submissions` (14 cols) — raw_fields JSONB + UTMs + IP + UA.

## 4. Invariantes / gotchas

- **CORS**: `forms-ingest` deve ecoar `Origin` (não `*`) quando o
  snippet manda `credentials: true`. Regressão comum — testado em
  `PITFALLS.md`.
- Token de integração NUNCA sai de queries diretas ao banco (RLS
  bloqueia coluna, `forms-admin get_token` é o único caminho).
- Auto-descoberta só cria `form_definitions` na primeira submissão.
  Ajustes de `field_map` devem sobrescrever, não recriar.
- `default_tags` são aplicadas por append (`array_append`), sem dedup —
  cuidado com duplicatas.
- Plugin WP não faz retry local; se `forms-ingest` cair, submissão é
  perdida (planeje idempotência client-side se crítico).
