## Objetivo

Quando um lead chega via formulário do site:
1. Vai para um **pipeline "Formulário Site"** (sistema, não removível) por padrão.
2. Para formulários específicos (ex: webinar), o destino é configurável — não fixo no código.
3. É inscrito automaticamente em uma **lista de e-mail "Leads Site"** (sistema, não removível) com nome + email.
4. Telefone entra se vier no payload, senão usa placeholder existente.

Tudo continua passando pela edge function `forms-ingest` que já existe — só ganha roteamento extra.

---

## 1. Banco de dados (migration única)

### 1.1. Flag de sistema em `pipelines`
- `ALTER TABLE pipelines ADD COLUMN is_system boolean NOT NULL DEFAULT false`
- `ALTER TABLE pipelines ADD COLUMN system_key text` (ex: `"forms_site"`, `"webinar"`)
- Índice único `(clinic_id, system_key) WHERE system_key IS NOT NULL`
- Trigger `BEFORE DELETE` em `pipelines` que bloqueia se `is_system = true`

### 1.2. Flag de sistema em `email_segments`
- `ALTER TABLE email_segments ADD COLUMN is_system boolean NOT NULL DEFAULT false`
- `ALTER TABLE email_segments ADD COLUMN system_key text`
- Índice único `(clinic_id, system_key) WHERE system_key IS NOT NULL`
- Trigger `BEFORE DELETE` que bloqueia se `is_system = true`

### 1.3. Campo de roteamento em `form_definitions`
Já existe `default_pipeline_stage_id` — basta usar. Adicionar:
- `ALTER TABLE form_definitions ADD COLUMN default_email_segment_id uuid REFERENCES email_segments(id) ON DELETE SET NULL`

Assim cada formulário pode sobrescrever pipeline/lista; quando nulo, cai no padrão "Formulário Site" / "Leads Site".

### 1.4. Seed automático por clínica
Função `ensure_system_form_assets(_clinic_id uuid)` que cria (idempotente):
- Pipeline `is_system=true, system_key='forms_site', name='Formulário Site', kind='sales'`
- Stage inicial "Novo" dentro dele
- Segment `is_system=true, system_key='leads_site', name='Leads Site', filters={kind:'static'}`

Chamadas:
- Backfill: rodar para todas as clínicas existentes na própria migration
- Novas clínicas: trigger `AFTER INSERT ON clinics` que chama a função

---

## 2. Edge function `forms-ingest` (ajuste)

No fluxo de lead novo, quando `def.default_pipeline_stage_id` for nulo, resolver o stage inicial do pipeline `system_key='forms_site'` da clínica e usar como fallback. (Hoje o código já lê `def.default_pipeline_stage_id || integration.default_pipeline_stage_id`; só ampliar para incluir o fallback do sistema.)

Após criar/atualizar o lead, se `email` existe:
1. Inserir em `email_segment_contacts` na lista `system_key='leads_site'` (com `lead_id`, `email`, `name`).
2. Se `def.default_email_segment_id` for setado, inserir também nessa segunda lista.
3. Usar `ON CONFLICT DO NOTHING` (já tem unique `(segment_id, email)`).

Nenhuma mudança nos contratos público da function — só comportamento interno.

---

## 3. UI

### 3.1. `Kanban` / `PipelineSidebar` e `EditPipelineDialog`
- Badge "Sistema" ao lado do nome quando `is_system`.
- Botão Excluir desabilitado com tooltip "Pipeline do sistema, criado para receber leads do site."
- Bloqueio de rename do `system_key`, mas permite renomear o `name` se a clínica quiser.

### 3.2. `SettingsForms.tsx` — aba de formulários
Por formulário descoberto (`form_definitions`), adicionar dois selects:
- **Pipeline / etapa de destino** (padrão: "Formulário Site → Novo")
- **Lista de e-mail** (padrão: "Leads Site")

Permite, por exemplo, mapear o form `webinar-xyz` para um pipeline "Webinar" criado pela própria clínica. Persiste em `form_definitions.default_pipeline_stage_id` e `default_email_segment_id`.

### 3.3. Página de Listas/Segmentos de e-mail
- Mesma proteção visual de "Sistema" + bloqueio de exclusão na lista "Leads Site".

---

## 4. Estrutura técnica

```text
forms-ingest (recebe submissão)
  ├── resolve pipeline_stage:
  │     def.default_pipeline_stage_id
  │  ?? integration.default_pipeline_stage_id
  │  ?? stage inicial do pipeline system_key='forms_site'
  ├── upsert lead (com telefone se presente)
  ├── insere em email_segment_contacts:
  │     - sempre na lista system_key='leads_site'
  │     - + def.default_email_segment_id (se setado)
  └── log normal (form_submissions, lead_events)
```

---

## 5. O que NÃO muda

- Contratos da edge function (`form_key`, `fields`, headers).
- Snippet/pixel/token no site da clínica.
- Tabelas existentes de tracking, leads, RLS.
- Pipelines não-sistema continuam editáveis/removíveis como hoje.

---

## 6. Entrega

1. Migration (schema + triggers + função `ensure_system_form_assets` + backfill).
2. Patch em `supabase/functions/forms-ingest/index.ts` (fallback de stage + inserir em segment).
3. UI: badges de sistema + bloqueio de delete em pipelines e segments.
4. `SettingsForms.tsx`: selects de pipeline/stage e lista por formulário, salvando em `form_definitions`.
