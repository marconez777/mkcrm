# Rebranding UI: "Clínica" → "Empresa"

## Objetivo
Remover o termo "clínica/clínicas" de toda a copy visível ao usuário, trocando por **"empresa/empresas"**. Mantém intacto: nomes de tabela (`clinics`), colunas (`clinic_id`), rotas (`/admin/clinics`), variáveis, tipos e nomes de componentes/arquivos (`AdminClinics.tsx`, `ClinicOnlyRoute`, etc.).

## Exceções (não tocar)
- Skill/knowledge de nicho `supabase/functions/_shared/builder-knowledge/niches/clinic.md` e demais arquivos sob `supabase/functions/_shared/builder-knowledge/` — são conteúdo de domínio usado por tenants que ainda atendem clínicas (ex.: "Clínica OR", "Sanapta").
- Documentação interna em `docs/`, `dry-run-pr2/`, `.lovable/memories/` — histórico técnico, não é UI.
- Tabela `clinics` e colunas `clinic_*` no banco — só código interno.
- Edge functions e nomes técnicos (`admin-delete-clinic`, `clinic-invite`, `clinic-openai-key`, etc.).
- Dados já cadastrados pelos tenants (nome da empresa que cada cliente digitou continua como está).

## Fase 1 — Onboarding e fluxos de entrada (prioridade alta)
Arquivos com copy crítica no primeiro contato:
- `src/pages/Onboarding.tsx` — "Configurar sua clínica", "Dados da clínica", "Nome da clínica", "profissionais da clínica", "Sua clínica está configurada", label do stepper "Clínica", placeholder `email@clinica.com` → `email@empresa.com`.
- `src/pages/Auth.tsx` — textos de cadastro/login mencionando clínica.
- `src/pages/Invite.tsx` — `"Bem-vindo(a) à ${invite.clinic_name ?? "clínica"}!"` → fallback "empresa".
- `src/components/site/*` (Hero, Features, Pricing, About, Capabilities, Services, Integrations, SiteNav, SiteFooter) — varrer copy do site institucional.

## Fase 2 — App shell e navegação
- `src/components/AppShell.tsx` — labels de menu/usuário.
- `src/layouts/AdminShell.tsx` — manter rota `/admin/clinics` mas trocar o **label** do item de menu (ex.: "Clínicas" → "Empresas").
- `src/components/CommandPalette.tsx` e `src/components/admin/AdminCommandPalette.tsx` — entradas/atalhos.

## Fase 3 — Settings, Team, Broadcasts e ferramentas operacionais
- `src/pages/Settings.tsx`, `src/pages/Team.tsx`, `src/pages/Tasks.tsx`, `src/pages/Broadcasts.tsx`, `src/pages/SettingsForms.tsx`, `src/pages/SettingsAppointmentTypes.tsx`, `src/pages/QueueLogs.tsx`, `src/pages/PipelineRuns.tsx`, `src/pages/MetricsAiUsage.tsx`, `src/pages/Tracking.tsx`, `src/pages/TrackingDebug.tsx`, `src/pages/Unsubscribe.tsx`.
- Componentes em `src/components/settings/`, `src/components/agents/`, `src/components/admin/`, `src/components/ai/usage/`, `src/components/email/` — só textos visíveis (títulos de Card, descrições, toasts, tooltips).
- Mensagens em `src/lib/pipeline-skip-reasons.ts`, `src/lib/service-types-mutations.ts`, `src/lib/tracking-identify.ts` — apenas strings exibidas ao usuário (não mudar chaves/IDs).

## Fase 4 — Painel Admin
- `src/pages/admin/AdminClinics.tsx` (25 ocorrências), `AdminUsers.tsx`, `AdminDashboard.tsx`, `AdminPanels.tsx`, `AdminEduzz.tsx`, `AdminPipelineAutomations.tsx`.
- Componentes admin (`UsersPanel`, `UsageLimitsPanel`, `FinancePanel`, `DashboardPanel`, `AuditPanel`, `IntegrationsDomainsTable`, `IntegrationsQuotaTable`, `ProviderHealthCard`, `ClinicDetailsDialog`).
- Dialog de exclusão: continua pedindo "slug da empresa" no lugar de "slug da clínica".

## Regras de substituição
Aplicar somente em **strings literais** (JSX text nodes, valores de `placeholder`, `title`, `aria-label`, `toast.*`, descrições):
| Original | Novo |
|---|---|
| clínica | empresa |
| Clínica | Empresa |
| clínicas | empresas |
| Clínicas | Empresas |
| da clínica / na clínica / à clínica | da empresa / na empresa / à empresa |
| email@clinica.com | email@empresa.com |

Não trocar quando o termo faz parte de:
- Identificadores de código (`clinic_id`, `clinicId`, `useClinicTeam`, `ClinicOnlyRoute`).
- Conteúdo dentro de `supabase/functions/_shared/builder-knowledge/**` (skill de nicho clínico permanece).
- Comentários técnicos referenciando a tabela `clinics`.
- Dados dinâmicos vindos do banco (nome que o tenant cadastrou).

## Validação
1. `rg -in "clínica|clinica" src/` deve retornar apenas:
   - Identificadores de código (clinicId, clinic_id, ClinicOnlyRoute, etc.).
   - Strings em arquivos intencionalmente preservados (nenhum esperado).
2. Smoke test visual: abrir `/`, `/auth`, `/onboarding`, `/admin/clinics` (label do menu deve dizer "Empresas"), `/settings` — confirmar que nenhum texto exibido contém "clínica".
3. Verificar que rotas, login, convite e exclusão de tenant continuam funcionando (nenhuma mudança em lógica/IDs).

## Não escopo
- Nenhuma migração de banco.
- Nenhuma renomeação de arquivo, componente, rota ou função.
- Nenhuma alteração em edge functions ou no schema.
- Skill `clinic.md` e knowledge de nicho permanecem (servem Clínica OR / Sanapta).
