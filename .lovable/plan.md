# Email Marketing na clínica + Assistente de DNS

Duas entregas combinadas: (1) assistente de verificação de DNS no super admin com status detalhado de SPF/DKIM/DMARC, e (2) menu "Email Marketing" para a clínica com Settings, Dashboard, Templates, Automações e Campanhas.

---

## Parte 1 — Assistente de DNS (Super Admin e Clínica)

Componente reutilizável `DnsWizard` que substitui a tabela crua de DNS do diálogo "Ver DNS" e também aparece na página de Domínio da clínica.

**Comportamento:**
- Lê `email_domains.dns_records` (já vem do Resend).
- Agrupa os registros em três passos:
  1. **SPF** — registros TXT do tipo SPF (`type` contém `TXT` e `value` contém `spf`).
  2. **DKIM** — registros do tipo `TXT`/`CNAME` com selectors do Resend (`resend._domainkey` etc).
  3. **DMARC** — TXT em `_dmarc`. Se ausente nos `dns_records`, mostrar um valor sugerido `v=DMARC1; p=none; rua=mailto:dmarc@<dominio>` (recomendação) com nota explicando que é opcional mas recomendado.
- Para cada passo: badge de status (Pendente / Verificado / Falhou) baseada em `record.status` retornado pelo Resend. Botão "Copiar" para Nome e para Valor.
- Polling automático: enquanto o status geral do domínio for `pending`/`temporary_failure` e o diálogo estiver aberto, dispara `email-domain-manage action=verify` a cada 20 segundos (máx. 15 tentativas). Botão "Verificar agora" força check imediato.
- Status global no topo: anel de progresso textual (ex.: "2 de 3 registros verificados") + último horário verificado.
- Quando atinge `verified`: estado de sucesso com checkmark e botão "Concluir".

**Arquivos:**
- `src/components/email/DnsWizard.tsx` — novo.
- `src/components/admin/IntegrationsDomainsTable.tsx` — diálogo "Ver DNS" passa a renderizar `<DnsWizard />` no lugar da tabela crua.

Nenhuma mudança de backend é necessária — o edge function `email-domain-manage` já faz `verify` e devolve `dns_records` atualizados.

---

## Parte 2 — Menu "Email Marketing" na clínica

### Navegação (`src/components/AppShell.tsx`)

Adicionar item pai "Email" com filhos (aparece só quando `hasFeature("email_marketing")`):
- `/email` → Dashboard
- `/email/templates` → Templates
- `/email/automations` → Automações
- `/email/campaigns` → Campanhas

A página de **Domínio** mora dentro de **Configurações** (não no menu Email), conforme decidido anteriormente.

### Rotas (`src/App.tsx`)

Quatro novas rotas, todas envolvidas em `<FeatureRoute feature="email_marketing">`:
- `/email` → `EmailDashboard`
- `/email/templates` → `EmailTemplates`
- `/email/automations` → `EmailAutomations`
- `/email/campaigns` → `EmailCampaigns`
- `/settings/email` → `SettingsEmailDomain` (sem feature gate; mostra "ative o recurso" se desligado)

### Páginas (em `src/pages/email/`)

**1. `SettingsEmailDomain.tsx`** (linkada a partir de `Settings.tsx` por card)
- Lista o(s) domínio(s) da clínica (`email_domains` filtrado por `clinic_id`).
- Se nenhum domínio: card explicando "Peça ao suporte para liberar o domínio da sua clínica" (criação só pelo super admin).
- Se existe: card com status do domínio + `<DnsWizard />` embutido (mesmo componente da Parte 1).
- Inputs editáveis pela clínica: `from_name` padrão e `reply_to` padrão, salvos em `clinics.settings.email`.

**2. `EmailDashboard.tsx`** — `/email`
- 4 stat cards (últimos 7 dias, agregado de `email_logs`): enviados, entregues, abertura %, clicks %.
- Gráfico simples (Recharts barras) por dia.
- Tabela últimos 50 envios (template, destinatário, status com badge, timestamp). Filtro por status e template (igual padrão usado em outras telas do projeto).
- Card "Cota": `sent_today` vs `quota_daily` (lido de `email_send_state` + `clinics.settings.email.quota_daily`).

**3. `EmailTemplates.tsx`** — `/email/templates`
- Lista de `email_templates` agrupados por `email_template_folders` (sidebar de pastas).
- CRUD básico: criar/editar/duplicar/excluir. Campos do form: nome, slug, assunto, preheader, from_name, from_email (select dos domínios verificados), html_body (textarea monoespaçada), text_body.
- Botão "Enviar teste" → invoca `send-email` com `template_slug` + email de teste.
- Sem editor visual nesta fase (drag-and-drop fica para depois). Variáveis com sintaxe `{{ nome }}` documentadas em painel lateral.

**4. `EmailAutomations.tsx`** — `/email/automations`
- Duas abas: **Receitas prontas** (3 cards: boas-vindas, aquecimento, reativação) com toggle "Ativar/Desativar" — cria/atualiza `email_automations` com `preset_key`.
- **Personalizado**: CRUD livre. Trigger dropdown (lead criado, mudou para estágio X, tag adicionada), passos como `[{ template_slug, delay_minutes }]`. UI tipo lista de passos.

**5. `EmailCampaigns.tsx`** — `/email/campaigns`
- Tabela de `email_campaigns`: nome, template, segmento, status, enviados/total, ações.
- Wizard de criação (Dialog em 3 passos): info básica → escolher template + segmento (`email_segments`) → revisar e agendar/enviar agora.
- Ações: enviar teste, agendar, enviar agora (chama `dispatch-campaign`), cancelar.

### Card em `Settings.tsx`

Adicionar card "Email Marketing" entre os existentes apontando para `/settings/email`. Visível só se `hasFeature("email_marketing")`.

---

## Detalhes técnicos

**Componentes UI compartilhados:**
- `src/components/email/StatusBadge.tsx` — mapa status → variant + label PT.
- `src/components/email/TemplatePicker.tsx` — usado em automações, campanhas, send-test.
- `src/components/email/SegmentPicker.tsx` — usado em campanhas.

**Permissões:**
- RLS já gate por `email_marketing`. Frontend complementa com `<FeatureRoute>`.
- Edição/criação no `email_templates`/`email_automations`/`email_campaigns` é livre para qualquer membro da clínica (RLS atual). Se quiser restringir a admin, marcar para fazer numa próxima migração — fora do escopo desta UI.

**Estado server:**
- Reuso de `supabase.from(...)` direto + `useEffect` (padrão das outras telas do projeto). Sem React Query novo.

**Não inclui (fora do escopo):**
- Editor visual de email (blocks/drag-and-drop).
- Configuração do webhook na Resend (manual).
- Construção visual de segmento (`email_segments` neste momento aceita apenas filtros via JSON salvo direto).
- Métricas avançadas (heatmap de cliques, A/B).

---

## Ordem de execução

1. `DnsWizard` (Parte 1) e plugar no diálogo do super admin.
2. Rotas e navegação no `AppShell`/`App.tsx`.
3. `SettingsEmailDomain` + card em `Settings.tsx`.
4. `EmailDashboard`.
5. `EmailTemplates`.
6. `EmailAutomations`.
7. `EmailCampaigns`.
