---
title: Forms (Captura de leads via formulários externos)
topic: tracking
kind: feature
audience: agent
updated: 2026-06-07
summary: "Três peças cooperam:"
---
# Forms (Captura de leads via formulários externos)

> Domínio: receber submissões de formulários em sites externos (WordPress,
> landing pages, snippet universal) e transformar em leads no CRM, com
> deduplicação, atribuição de tracking e log completo.
>
> Última atualização: 2026‑05‑30

---

## 1. Visão geral

Três peças cooperam:

1. **`forms-snippet`** (edge function pública) — serve um JS de ~2KB
   parametrizado pelo token da integração. O snippet:
   - Intercepta `submit` de qualquer `<form>` na página.
   - Coleta inputs (exclui `password` e hidden suspeitos).
   - Lê `visitor_id`/`session_id` do tracking (`_mk_vid`, `_mk_sid`).
   - Envia para `forms-ingest` via `sendBeacon` (com fallback `fetch keepalive`).

2. **`forms-ingest`** (edge function pública) — recebe a submissão, valida
   token + origin, auto‑descobre `form_definition` no primeiro envio,
   resolve campos por aliases, deduplica e cria/atualiza lead, registra
   `lead_events` e `form_submissions`.

3. **`forms-admin`** (edge function autenticada) — CRUD de
   `form_integrations` e `form_definitions` (mapas, defaults, status,
   rotação de token).

Auxiliares: `forms-plugin-zip` gera um plugin WordPress baixável que
embute o snippet com o token da clínica já preenchido.

---

## 2. Modelo de dados

| Tabela                | Papel                                                                                            |
|-----------------------|--------------------------------------------------------------------------------------------------|
| `form_integrations`   | Uma "instalação" por clínica/site. Campos: `slug`, `token` (`mkf_...`), `previous_token` + `_expires_at` (grace), `allowed_domains[]`, `default_pipeline_stage_id`, `default_tags[]`, `status` (`active|paused`), counters. |
| `form_definitions`    | Um por `(integration_id, form_key)`. `field_map` (jsonb explícito), `default_pipeline_stage_id`, `default_tags`, `active`. Auto‑criada na primeira submissão. |
| `form_submissions`    | Log: `payload` (jsonb), `lead_id`, `is_new_lead`, `status` (`ok|no_contact|error`), `error`, `ip`, `user_agent`. |
| `lead_events`         | Evento `type='form_submission'` linkando ao lead criado/atualizado.                              |
| `tracking_identity_links` | Linka `visitor_id` (tracking pixel) ao `lead_id` recém‑criado.                               |

---

## 3. Fluxo de submissão (`forms-ingest`)

### 3.1 Autenticação
- Token via header `x-form-token` **ou** query `?token=`.
- Lookup: `form_integrations.token = ?` OU `previous_token = ?` (grace de
  24h após `rotate_token`).
- `status != 'active'` → 403.
- `previous_token` expirado → 401.
- `Origin` precisa bater com `allowed_domains[]` (sufixo ou exato). Lista
  vazia = qualquer origin.

### 3.2 Validação (Zod)
```ts
{ form_key, form_name?, source_page?, fields: Record<string, unknown>,
  visitor_id?, session_id? }
```

### 3.3 Auto‑discovery de definição
Se `(integration_id, form_key)` não existe em `form_definitions`, cria
com `name = form_name || form_key`, `field_map = {}` (aprendizagem manual
pelo admin depois).

### 3.4 Resolução de campos (`pickField`)
Para cada campo canônico (`name`, `email`, `phone`, `message`):
1. **Mapa explícito** (`field_map[key]`) — se setado pelo admin.
2. **Alias exato** (case‑insensitive): `phone` ⇐ `["phone","telefone","tel","celular","whatsapp","wpp","your-phone","your-tel","mobile"]`, etc.
3. **Substring match** em chaves restantes (último recurso).

### 3.5 Normalização
- `email`: regex básica `^[^\s@]+@[^\s@]+\.[^\s@]+$`, lowercased.
- `phone`: só dígitos, +55 prepended se 10/11 dígitos (BR fallback).

### 3.6 Dedup / upsert do lead
- Se `phone` → busca `leads` por `clinic_id + phone`.
- Senão se `email` → `clinic_id + ilike(email)`.
- Match: faz patch só de campos vazios (`name`, `email`, `phone` se for
  placeholder `email:...`).
- Sem match: cria com `tags = union(integration.tags, def.tags)`,
  `phone = phone ?? "email:" + email` (placeholder p/ leads só‑email),
  `form_source = "form:<name>"`, `custom_fields.form_submission` com payload
  bruto. **Cascata de `stage_id`** (primeiro que existir):
  1. `def.default_pipeline_stage_id`
  2. `integration.default_pipeline_stage_id`
  3. Pipeline `kind='sales' AND is_default=true` da clínica → etapa cujo
     nome casa `/nutri/i` (heurística), senão o primeiro estágio (menor
     `position`). **Este é o caminho padrão hoje** — leads de formulário
     entram no funil de vendas oficial, na nutrição.
  4. Pipeline de sistema `forms_site` → estágio "Novo" (fallback legado).
  5. `null` (lead sem stage).

### 3.7 Atribuição
- `visitor_id` presente → upsert em `tracking_identity_links` com
  `link_source='form_submission'`.

### 3.8 Logs
- Sempre cria `form_submissions` (mesmo se `no_contact` ou `error`).
- Se OK, cria `lead_events.form_submission` e incrementa
  `total_submissions` / `last_submission_at` em integration + definition.

### 3.9 Resposta
```json
{ "ok": true, "status": "ok", "lead_id": "...", "is_new_lead": true }
```
Status pode ser `"no_contact"` (sem phone nem email) ou `"error"`.

---

## 4. Snippet (`forms-snippet`)

`GET /functions/v1/forms-snippet?token=mkf_...` retorna JS pronto:

- `data-mk-form` / `id` / `name` / fallback `auto:<path>` definem `form_key`.
- `data-mk-name` define nome amigável (senão usa `document.title`).
- `data-mk-ignore` ignora formulário.
- `data-mk-field` permite renomear inputs sem `name`.
- Exclui inputs `password` e `hidden` que não casem regex de UTM/contato.
- Envia via `navigator.sendBeacon` (não bloqueia navegação) ou
  `fetch keepalive`.
- Cache: `Cache-Control: public, max-age=300`.

Expõe `window.MKForms.send(formElement)` para integrações custom.

---

## 5. Admin (`forms-admin`)

Endpoint autenticado (JWT validado em código). Resolve clínica do user via
`clinic_members` + super_admin via `user_roles`.

| Action                | Body                                                                          | Notas |
|-----------------------|-------------------------------------------------------------------------------|-------|
| `create_integration`  | `{ clinic_id?, name, allowed_domains[], default_pipeline_stage_id?, default_tags[] }` | Gera `slug` + `token = mkf_<hex16>`. |
| `update_integration`  | `{ id, name?, allowed_domains?, ..., status? }`                               | Patch parcial. |
| `rotate_token`        | `{ id }`                                                                      | Move atual → `previous_token` (grace 24h). |
| `delete_integration`  | `{ id }`                                                                      | Cascata por FK + RLS. |
| `update_definition`   | `{ id, name?, field_map?, default_pipeline_stage_id?, default_tags?, active? }` | Edita mapa de campos descoberto. |
| `delete_definition`   | `{ id }`                                                                      |        |

Permissão: usuário precisa ser `owner|admin` da clínica da integração, ou
`super_admin` global.

---

## 6. Plugin WordPress (`forms-plugin-zip`)

Gera um `.zip` baixável (ver `src/pages/SettingsForms.tsx` botão "Plugin
WordPress") com PHP que adiciona o snippet via `wp_enqueue_script` no
footer, já parametrizado com o token. Atualizações de versão exigem
re‑download e re‑install no WP.

---

## 7. Frontend (`src/pages/SettingsForms.tsx`)

- Lista de integrações por clínica.
- Criar/editar/pausar/rotacionar token.
- Exibe snippet `<script src="/forms-snippet?token=...">` para colar no site.
- Lista `form_definitions` descobertas, permite mapear campos e definir
  defaults por formulário.
- Mostra últimas `form_submissions` (status, payload, lead vinculado).

---

## 8. Erros comuns / troubleshooting

| Sintoma                                          | Causa / fix                                                                          |
|--------------------------------------------------|--------------------------------------------------------------------------------------|
| Submissão devolve 401 `invalid token`            | Token errado ou integration deletada. Conferir snippet.                              |
| 403 `origin not allowed`                         | Site não está em `allowed_domains`. Adicionar com ou sem `www.`.                     |
| Lead criado sem `name`                           | Campo não casa alias. Adicionar mapping em `form_definitions.field_map`.             |
| Telefone duplicado / mal formatado               | `normalizePhone` assume BR para 10/11 dígitos. Para internacional, enviar com `+`/DDI. |
| `no_contact` em todas as submissões              | Form não tem campo phone/email reconhecível. Verificar com `payload` de `form_submissions`. |
| Lead criado com `phone = email:foo@bar.com`      | Não tinha phone — placeholder. Será sobrescrito quando o lead enviar WhatsApp.       |
| Rotação de token quebrou o site por minutos      | Aproveitar a grace de 24h: deploy do novo token no site **antes** de revogar a grace. |
| Tracking visitor não vinculou                    | Snippet não leu `_mk_vid` (cookie/localStorage); verificar se o tracking pixel está instalado. |

---

## 9. Segurança

- **RLS**: `form_submissions`, `form_definitions`, `form_integrations`
  escopados por `clinic_id` via `current_clinic_id()` (ver
  [`docs/database/RLS_POLICIES.md`](../database/RLS_POLICIES.md)).
- **`forms-ingest`** roda com **service role** mas valida token + origin
  antes de qualquer escrita.
- **Token rotation** é obrigatória se um snippet vazar (use `rotate_token`,
  publique novo `<script>` em até 24h).
- **Endurecimento de tokens (2026‑05‑28):** `GRANT` de `SELECT` em colunas
  sensíveis de `form_integrations` (`token`, `previous_token`) foi
  **revogado** para `anon` e restrito a `authenticated` apenas via RLS por
  `clinic_id`. O snippet público (`forms-snippet`) continua funcionando
  porque resolve o token via service role na edge function — clientes do
  Data API não conseguem mais listar tokens sem JWT da clínica dona.
- **PII**: payload bruto vai em `form_submissions.payload` e
  `leads.custom_fields.form_submission`. Evitar formulários com dados
  sensíveis (saúde, financeiro) sem revisão de retenção.

---

## 10. Limitações / melhorias futuras

- **Sem reCAPTCHA / honeypot integrado** — anti‑spam fica a cargo do site.
  Adicionar suporte opt‑in via `g-recaptcha-response` no snippet.
- **Sem deduplicação por `visitor_id`** quando lead não tem phone/email
  conhecido — sempre cria placeholder.
- **`pickField` substring match** pode pegar errado (`email_marketing` →
  email). Mitigar com mapping explícito no admin.
- **`forms-plugin-zip`** não auto‑atualiza no WP; idealmente publicar no
  repositório oficial.
- **Sem webhook outbound** — integrar com Zapier/Make exige polling em
  `form_submissions`.

---

## 11. Links

- Schema: [`docs/database/SCHEMA.md`](../database/SCHEMA.md) (domínio Forms).
- RLS: [`docs/database/RLS_POLICIES.md`](../database/RLS_POLICIES.md) (políticas para `form_*`).
- Tracking: [`docs/edge-functions/TRACKING.md`](../edge-functions/TRACKING.md) (visitor_id, session_id).
- Edge functions index: [`docs/edge-functions/INDEX.md`](../edge-functions/INDEX.md).
