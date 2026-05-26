# 10 — Referência técnica

> Schemas, tabelas, edge functions, limites. Para devs que vão integrar fundo.

---

## Base URL

```
https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1
```

---

## Edge functions

| Função | Método | Auth | Pública | Responsabilidade |
|---|---|---|---|---|
| `tracking-pixel` | GET | — | ✅ | Serve `tracker.js` parametrizado |
| `tracking-event` | POST | — | ✅ | Recebe eventos, grava `tracking_visitors`/`sessions`/`events` |
| `tracking-config` | GET | — | ✅ | Config dinâmica (timeout de sessão, regras de atribuição) |
| `tracking-identify` | POST | service role | ⚠ Interno | Vincula `visitor_id` ↔ `lead_id`, backfill de eventos |
| `forms-snippet` | GET | — | ✅ | Serve `forms.js` parametrizado |
| `forms-ingest` | POST | token público | ✅ | Recebe form submission, cria lead |
| `forms-admin` | * | JWT | ⚠ Painel | CRUD de integrações e form_definitions |
| `forms-plugin-zip` | GET | token | ✅ | Gera plugin WordPress on-demand |
| `external-lead-capture` | POST | token privado | ✅ | API direta server-to-server |
| `wa-redirect` | GET | — | ✅ | Redirect com `ctwa_clid` captura |

---

## Schemas Zod

### `POST /forms-ingest`

```ts
BodySchema = z.object({
  form_key:    z.string().min(1).max(128),
  form_name:   z.string().max(200).optional(),
  source_page: z.string().max(500).optional(),
  fields:      z.record(z.unknown()).default({}),
  visitor_id:  z.string().max(64).optional(),
  session_id:  z.string().max(64).optional(),
});
```

Headers obrigatórios: `Content-Type: application/json`, `x-form-token: <TOKEN>` (ou query `?token=`).

### `POST /tracking-event`

```ts
{
  project_id:  string,           // slug da clinic
  visitor_id:  string,
  session_id:  string,
  event:       string,           // "page_view" | "click" | custom
  url?:        string,
  title?:      string,
  referrer?:   string,
  properties?: Record<string, unknown>,
  utm?:        { source?, medium?, campaign?, content?, term? },
  click_ids?:  { gclid?, fbclid?, ttclid?, msclkid?, li_fat_id?, ctwa_clid? },
}
```

### `POST /tracking-identify`

```ts
{
  clinic_id:     string (uuid),
  visitor_id:    string,
  lead_id?:      string (uuid),
  email?:        string,
  phone?:        string,
  whatsapp_id?:  string,
  source_event?: string,
  session_id?:   string,
  project_id:    string,
  properties?:   Record<string, unknown>,
}
```

### `POST /external-lead-capture`

```ts
BodySchema = z.object({
  clinic_id:    z.string().uuid(),
  visitor_id:   z.string().min(1).max(64).optional(),
  session_id:   z.string().min(1).max(64).optional(),
  name:         z.string().trim().max(120).optional(),
  email:        z.string().trim().email().max(255).optional(),
  phone:        z.string().trim().max(32).optional(),
  source_page:  z.string().max(255).optional(),
  form_kind:    z.string().max(64).optional(),
  extra:        z.record(z.unknown()).optional(),
}).refine(d => d.email || d.phone, { message: "email or phone is required" });
```

Headers obrigatórios: `Content-Type: application/json`, `x-capture-token: <TOKEN>`.

---

## Tabelas

### `form_integrations`
| Campo | Tipo | |
|---|---|---|
| id | uuid PK | |
| clinic_id | uuid FK | |
| name | text | "Site institucional" |
| token | text | público, usado no `<script>` |
| previous_token | text | grace period |
| previous_token_expires_at | timestamptz | |
| allowed_domains | text[] | ex.: `{"clinicaohrpsiquiatria.com"}` |
| status | text | `active` \| `paused` |
| default_pipeline_stage_id | uuid | |
| default_tags | text[] | |
| total_submissions | int | contador |
| last_submission_at | timestamptz | |

### `form_definitions`
1 por `form_key` dentro de uma integration. Criado automaticamente.
| Campo | Tipo |
|---|---|
| id | uuid PK |
| clinic_id, integration_id | uuid |
| form_key | text |
| name | text |
| source_page | text |
| field_map | jsonb |
| default_pipeline_stage_id | uuid |
| default_tags | text[] |
| total_submissions | int |
| last_submission_at | timestamptz |

### `form_submissions`
1 por POST recebido (mesmo se falhou em criar lead).
| Campo | Tipo |
|---|---|
| id | uuid PK |
| clinic_id, integration_id, form_definition_id | uuid |
| form_key, source_page | text |
| payload | jsonb (campos brutos) |
| ip, user_agent | text |
| lead_id | uuid (null se erro) |
| is_new_lead | bool |
| status | text — `ok` \| `no_contact` \| `error` |
| error | text |
| created_at | timestamptz |

### `tracking_visitors` / `tracking_sessions` / `tracking_events`
Conforme [docs/TRACKING.md](../TRACKING.md).

### `tracking_identity_links`
| Campo | Tipo |
|---|---|
| clinic_id, visitor_id, lead_id | (UNIQUE) |
| link_source | text — `form_submission` \| `identify_api` \| `whatsapp_match` |
| created_at | timestamptz |

### `leads`
Campos relevantes para integração:
| Campo | Tipo | Notas |
|---|---|---|
| clinic_id | uuid | |
| phone | text | normalizado E.164 sem `+`, ou `email:...` placeholder |
| email | text | lowercase |
| name | text | |
| landing_page | text | URL onde o lead começou |
| form_source | text | `form:<name>` \| `external_api` \| `whatsapp` |
| tags | text[] | |
| custom_fields | jsonb | inclui `form_submission`, `first_touch`, `last_touch` |
| stage_id | uuid | |

### `lead_events`
1 por interação. Tipos relevantes:
- `form_submission`
- `lead_created`
- `tag_added`
- `stage_changed`

---

## Limites

| Recurso | Limite |
|---|---|
| Payload tracking-event | 64 KB |
| Payload forms-ingest | 256 KB |
| Payload external-lead-capture | 64 KB |
| `properties` por evento | 8 KB |
| `extra` em external-lead-capture | 8 KB |
| Eventos/min (tracking) por IP+clinic | 120 |
| Forms-ingest req/min | sem limite (TODO) |
| Token público — chars | 32 |
| Token privado — chars | 64+ |
| Retenção de eventos | indefinida (ajustável por clinic) |
| Retenção de logs edge | 7 dias |

---

## Códigos HTTP

| Status | Significado |
|---|---|
| 200 | OK |
| 400 | Payload inválido (ver `error.fieldErrors`) |
| 401 | Token ausente ou errado |
| 403 | Origin não permitido OU integração pausada OU token expirou |
| 405 | Método errado (use POST exceto onde marcado GET) |
| 429 | Rate limit |
| 5xx | Erro interno — retentar com backoff |

---

## Versionamento

A API hoje é **v1 implícita** — sem prefixo. Mudanças quebram-compatíveis serão lançadas como `/v2/...` ou via novo endpoint paralelo, com aviso prévio de 30 dias e janela de coexistência mínima de 90 dias.

---

## Changelog rápido

Mantemos `docs/CHANGELOG.md` com mudanças por release.

Mudanças impactantes a essa integração serão também anunciadas via email do CRM aos admins.

---

## Suporte

- Logs de edge function: painel Supabase → Edge Functions → escolha a função → Logs.
- Status do projeto: `cloud_status` (interno).
- Dúvidas: suporte do CRM com `clinic_id` + `integration_id`.
