
# Integração de formulários → CRM

Hoje já existe a edge function `external-lead-capture` (token global `EXTERNAL_LEAD_CAPTURE_TOKEN`). Vamos evoluir para uma integração de formulários **por clínica**, com plugin WordPress oficial, snippet para sites Lovable/HTML e uma tela completa no CRM.

## 1. Backend

### Tabelas novas (migration)

- **`form_integrations`** — uma fonte de formulários por clínica
  - clínica, nome, slug, `token` (gerado, único, rotacionável), domínio permitido, status (ativo/pausado), `default_pipeline_stage_id`, `default_tags`, `created_at`.
- **`form_definitions`** — cada formulário detectado/configurado
  - integration, `form_key` (ex.: `cf7-id-42`, `elementor-widget-x`, `lovable-contato`), nome amigável, página/URL, `field_map` (jsonb: `{ name: "your-name", email: "your-email", phone: "tel-123", custom: {...} }`), última submissão, total recebido, ativo.
- **`form_submissions`** — log bruto de cada envio
  - integration, form_definition, payload original, ip/UA, lead criado/atualizado, status (ok/erro/dedupe), erro, created_at.

RLS: tudo escopado por `clinic_id` via `has_clinic_access`. Token validado server-side (não exposto ao cliente).

### Edge functions

- **`forms-ingest`** (nova, pública, CORS aberto): substitui o uso direto de `external-lead-capture` para formulários. Valida `x-form-token`, identifica `form_integration`, faz upsert de `form_definitions` (auto-descoberta quando `form_key` novo aparece), aplica `field_map`, chama a mesma lógica de upsert de lead + `lead_events` (`form_submission`), grava `form_submissions`, retorna `{ ok, lead_id, deduped }`.
- **`forms-admin`** (autenticada): CRUD de integrações/forms (criar integração, rotacionar token, pausar, editar field_map, deletar form_definition).
- `external-lead-capture` continua funcionando para compatibilidade.

Segurança: rate-limit por token (ex.: 60 req/min por IP), validação Zod, normalização de telefone BR já existente, dedupe (clinic_id + phone/email) 60s já existente.

## 2. Plugin WordPress

Pasta `wp-plugin/mk-crm-forms/` (entregue como zip para download na tela do CRM).

- Tela de configurações em `Settings → MK CRM`: campos `API URL` (fixo do projeto), `Form Token` (cola da integração criada no CRM).
- Hooks automáticos para os principais form builders:
  - **Contact Form 7**: `wpcf7_mail_sent`
  - **Elementor Forms**: `elementor_pro/forms/new_record`
  - **WPForms**: `wpforms_process_complete`
  - **Gravity Forms**: `gform_after_submission`
  - **Fluent Forms**: `fluentform/submission_inserted`
- Envia `{ form_key, form_name, source_page, fields }` para `forms-ingest` com header `x-form-token`.
- Mapeamento padrão de campos comuns (name/email/phone/tel/telefone/whatsapp/mensagem); campos extras vão em `extra`.
- Log local opcional + reenvio automático em caso de falha (3 tentativas).

## 3. Snippet para sites Lovable / HTML puro

Snippet `<script>` curto (servido inline na UI), variante do tracking-pixel atual:
- Anexa `submit` listener em `document` para qualquer `<form>`.
- Detecta inputs por `name`/`type` (email, tel, name) ou `data-mk-field="phone"`.
- Não bloqueia o submit original — envia em paralelo via `navigator.sendBeacon` ou `fetch keepalive`.
- Lê `visitor_id`/`session_id` do cookie do tracking-pixel para atribuição.
- Atributos opcionais no `<form>`: `data-mk-form="contato-home"`, `data-mk-ignore` para pular.

## 4. UI no CRM — tela completa

Nova aba **"Formulários"** dentro de **Settings → Integrações** (ou rota dedicada `/settings/forms`).

**Lista de integrações:**
- Cards por integração: nome, domínio, status, total recebido nos últimos 7d, último envio.
- Botões: **Criar integração**, **Editar**, **Rotacionar token**, **Pausar**, **Excluir**.

**Detalhe da integração** (drawer/página):
- Aba **Visão geral**: token (com copy + olho/esconder), URL do endpoint, contadores.
- Aba **Como instalar**:
  - Tab "WordPress": botão de download do `.zip` + passo a passo (instalar plugin → colar token).
  - Tab "Lovable/HTML": bloco copiável com `<script src="…/forms.js" data-token="…">` + exemplo de `<form>`.
  - Tab "API direta": exemplo `curl` para devs.
- Aba **Formulários detectados**: tabela das `form_definitions` (auto-descobertas na primeira submissão). Editar nome, field_map (mapear campo bruto → name/email/phone/custom_field), stage padrão de Kanban, tags padrão, pausar.
- Aba **Submissões**: log das últimas 200 com payload bruto, status, link para o lead gerado, reprocessar.

**Lead drawer**: nova entrada na timeline `form_submission` com nome do formulário e payload (já cabe na timeline existente via `lead_events`).

## 5. Detalhes técnicos

- Token: `mkf_` + 32 chars random hex, único, rotacionável (mantém o antigo válido por 24h pós-rotação).
- CORS no `forms-ingest`: `Access-Control-Allow-Origin` valida contra `allowed_domains` da integração (ou `*` se vazio).
- Validação Zod no payload; limite 64KB.
- `form_submissions.payload` truncado a 32KB para não estourar.
- Atribuição: se `visitor_id` vier, reaproveita lógica existente (`tracking_identity_links` + UTMs da última sessão).
- Tipos Supabase regerados após a migration.

## 6. Ordem de entrega

1. Migration (3 tabelas + RLS + índices).
2. Edge function `forms-ingest` + `forms-admin`.
3. Tela "Formulários" no CRM (lista, criação, detalhe, log).
4. Snippet JS hospedado + bloco copy-paste na UI.
5. Plugin WordPress (`.zip` baixável pela UI).
6. Atualizar `docs/TRACKING.md` com a nova seção "Formulários".

Aprovando, eu começo pela migration e depois sigo a ordem acima.
