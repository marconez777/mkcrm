---
title: "Núcleo Frontend — Bootstrap, Rotas, Auth, Shells, i18n"
topic: architecture
kind: map
audience: agent
updated: 2026-07-01
summary: "Como o app inicia, monta providers, faz roteamento, autentica, decide qual shell renderizar (App vs Admin), aplica feature flags e sincroniza i18n/region. Fase 1 do F-DOC-FULL."
code_refs:
  - src/main.tsx
  - src/App.tsx
  - src/components/AppShell.tsx
  - src/layouts/AdminShell.tsx
  - src/components/RootGate.tsx
  - src/components/ProtectedRoute.tsx
  - src/components/ClinicOnlyRoute.tsx
  - src/components/FeatureRoute.tsx
  - src/hooks/useAuth.tsx
  - src/hooks/useRegion.ts
  - src/i18n/index.ts
  - src/i18n/useI18nSync.ts
  - src/lib/features.ts
  - src/lib/region.ts
  - src/lib/app-url.ts
  - src/lib/supabase-env.ts
  - src/integrations/supabase/client.ts
  - src/pages/Auth.tsx
  - src/pages/ResetPassword.tsx
related_docs:
  - docs/i18n/REGION_CONFIG.md
  - docs/i18n/TRANSLATION_PROCESS.md
  - docs/_audit/INVENTORY.md
  - docs/_audit/PROGRESS.md
---

# Núcleo Frontend

Este mapa cobre a espinha dorsal do frontend do Chat Funnel AI — desde `main.tsx` até o momento em que uma rota autenticada renderiza. É a referência canônica para entender **quem monta o quê** antes de qualquer feature específica (Inbox, Kanban, IA, Email, etc.).

## 1. Bootstrap

`src/main.tsx` é o entrypoint. Ordem exata:

1. Importa `./index.css` (Tailwind + tokens semânticos).
2. Importa `./i18n` — inicializa `react-i18next` uma única vez (guardado por `i18n.isInitialized`) com 3 idiomas: `pt-BR` (default+fallback), `es-ES`, `en-US`.
3. Chama `installSupportRuntimeWatcher()` (registra listener global para erros de runtime do SupportPanel).
4. Renderiza `<App />` em `#root` via `createRoot`.

Nenhum `StrictMode` — foi removido intencionalmente para evitar duplo-mount de canais Realtime.

## 2. Camada de providers (`src/App.tsx`)

Hierarquia (de fora para dentro):

```text
QueryClientProvider (react-query)
└── TooltipProvider
    ├── Toaster (shadcn) + Sonner
    └── BrowserRouter
        └── ErrorBoundary
            └── AuthProvider
                └── DialogsProvider
                    ├── TitleSync (useUnreadTitle)
                    ├── ShortcutsDialog
                    ├── CommandPalette
                    └── Routes
```

Config do `QueryClient`:
- `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false`, `retry: 1`, `mutations.retry: 0`.

**Invariante:** `AuthProvider` precisa envolver `Routes` porque `ProtectedRoute`, `ClinicOnlyRoute`, `FeatureRoute`, `RootGate` e `AdminShell` chamam `useAuth()` no primeiro render.

## 3. Roteamento — `src/App.tsx`

Estrutura em três camadas: **públicas**, **admin**, **operacionais autenticadas**.

### 3.1 Públicas / auth
| Rota | Componente | Notas |
|---|---|---|
| `/` | `<RootGate />` | Decide entre `MarketingSite`, `AppShell+Kanban` ou redirect para `/admin`. |
| `/site` | `MarketingSite` | Acesso direto ao site institucional. |
| `/apn` | `Apn` | Proposta comercial (slides). |
| `/auth` | `Auth` | Login + forgot-password (via edge `auth-login` para brute-force lock). |
| `/reset-password` | `ResetPassword` | Fluxo `type=recovery` do Supabase. **Não** protegido. |
| `/invite/:token` | `Invite` | Aceite de convite de empresa. |
| `/unsubscribe` | `Unsubscribe` | Opt-out de email. |
| `/checkout/:priceId` | `Checkout` | Stripe embedded. |
| `/checkout/return` | `CheckoutReturn` | Return URL do Stripe. |

### 3.2 Admin (super admin) — `AdminShell` via `<Outlet />`

Todas em `lazy(() => import(...))` com `Suspense fallback={<AdminFallback />}`. Prefixo `/admin/*`:

- `/admin/login` → `AdminLogin` (fora do shell)
- `/admin` (index) → `AdminDashboard`
- `/admin/clinics`, `/admin/users`, `/admin/plans`, `/admin/usage`, `/admin/finance`, `/admin/observability`, `/admin/support`, `/admin/integrations`, `/admin/integrations/eduzz`, `/admin/audit`, `/admin/builder-manual`, `/admin/branding`, `/admin/pipeline-automations`, `/admin/pipeline-health`.

`AdminShell` bloqueia acesso: `!session || !isSuperAdmin` → `Navigate("/admin/login")`.

### 3.3 Operacionais — catch-all `*`

Envelopadas por `ProtectedRoute > ClinicOnlyRoute > AppShell > Routes` (subrouter). Cobrem Kanban (`/`), Inbox (`/inbox`, `/inbox/:leadId`), IA Hub (`/ai/*`, `/agents/*`), Automations, Sequences, Templates, Broadcasts (todos dentro de `AiHub` que faz sub-routing interno), Email (`/email/*`), Tracking (`/tracking`, `/tracking-debug`), Tasks, Pipeline Runs, Team, Settings (`/settings/*`), Billing.

Cada rota potencialmente restringível é envolta em `<FeatureRoute feature="...">` — ver seção 5.

`/onboarding` é uma exceção: fica **fora** do catch-all, envolta apenas por `ProtectedRoute` (usuário sem clínica precisa poder criar uma).

## 4. Gates de autenticação

### 4.1 `ProtectedRoute` (`src/components/ProtectedRoute.tsx`)
- Requer `session`.
- Sem sessão: `Navigate("/auth", { state: { from: location }, replace: true })`.
- Enquanto `loading`, mostra spinner full-screen.

### 4.2 `ClinicOnlyRoute` (`src/components/ClinicOnlyRoute.tsx`)
- Bloqueia super admins **sem** `membership` (contas "puras" da plataforma) de acessar rotas operacionais.
- Redireciona para `/admin`.
- Super admin **com** membership (ex.: dono da própria conta) passa normalmente.

### 4.3 `RootGate` (`src/components/RootGate.tsx`)
Rota `/` inteligente:
1. `loading` → spinner.
2. Sem `session` → `<MarketingSite />` (site institucional).
3. `isSuperAdmin && !membership` → `Navigate("/admin")`.
4. Caso contrário → `<AppShell><Kanban /></AppShell>`.

### 4.4 `FeatureRoute` (`src/components/FeatureRoute.tsx`)
Restringe rota por feature-flag da empresa. Se `hasFeature(feature)` é falso: toast "Recurso indisponível" (uma única vez via `useRef`) e `Navigate("/")`.

## 5. `useAuth` — o hook central

Arquivo: `src/hooks/useAuth.tsx`.

Estado exposto:
- `session`, `user`
- `loading` (só o bootstrap inicial)
- `membership`: `{ clinic_id, role, clinic: { id, name, slug, status, settings } } | null`
- `isSuperAdmin: boolean`
- `hasFeature(key)`: super admin sempre `true`, caso contrário consulta `membership.clinic.settings.features`.
- `refreshMembership()`

Comportamento crítico:

- **`onAuthStateChange`**: Em `SIGNED_OUT`/sem sessão limpa membership+role. Em qualquer outro evento, agenda `loadCtx()` via `setTimeout(0)` — evita deadlock com o próprio callback do supabase.
- **`loadCtx(uid)`**: consulta em paralelo `clinic_members` (com join em `clinics`) e `user_roles`. Popula `membership` e `isSuperAdmin`.
- **Auto-refresh de sessão**: listener em `visibilitychange` + `focus` + `setInterval(4min)`. Se a sessão expira em <5min, chama `refreshSession()`. Falha → `signOut()` + redirect para `/auth?reason=expired`.
- **Feature flags**: `features == null` significa "tudo liberado" (default-on). `features[key] === false` bloqueia.

## 6. Feature flags (`src/lib/features.ts`)

Catálogo estático em `FEATURES[]`. Chaves suportadas: `inbox`, `tasks`, `agents`, `automations`, `sequences`, `templates`, `metrics`, `metrics_ai`, `metrics_ai_usage`, `custom_fields`, `team`, `email_marketing`, `broadcasts`.

Função canônica: `isFeatureEnabled(features, key)` — trata `undefined`/`null` como habilitado.

Persistência: `clinics.settings.features` (jsonb). Editado pelo super admin em `/admin/clinics`.

## 7. Shells

### 7.1 `AppShell` (`src/components/AppShell.tsx`)

Layout de usuário final. Sidebar preta de 240px + main scrollable. Responsabilidades:

- **`useI18nSync()`** — troca idioma quando `membership.clinic.locale` muda.
- **Nav dinâmica**: construída em `useMemo` a partir de `BASE_ITEMS` + condicionais por role/feature/allowlist:
  - Base: Pipeline, Conversas, Tarefas, IA.
  - `email_marketing` → Email.
  - `isClinicAdmin || isSuperAdmin` → Tracking (+ Tracking Debug se `settings.tracking.debug_enabled` ou super admin).
  - `isClinicAdmin && team` → Equipe.
  - `isClinicAdmin && pipelineAllowlist` → Agente Pipeline (`/pipeline-runs`).
  - Sempre: Configurações.
  - `isSuperAdmin` → Super Admin (link para `/admin`).
  - Profissionais (`role === "professional"`) perdem `/ai`.
- **Badge de não-lidas**: `useUnreadTotal()` inscreve num Realtime channel de `postgres_changes` sobre `leads.unread_count` (INSERT/UPDATE/DELETE) e mostra na aba Conversas.
- **Status WhatsApp**: `useHealth().overall` (`ok`/`warn`/`down`/desconhecido) alimenta o pill "Conectado/Conectando/Desconectado". Clique com `down` leva a `/settings?qr=1`.
- **Menu de perfil**: DropdownMenu com avatar (busca `profiles.full_name/avatar_url`), atalhos para Perfil/Configurações e Sign-out.
- **`SupportChatFab`** montado sempre no canto.

### 7.2 `AdminShell` (`src/layouts/AdminShell.tsx`)

Layout do super admin — dark, largura fixa collapsable (68px ↔ 244px). Responsabilidades:

- **`useBrandingSync()`**: lê `app_settings.platform_branding` (JSON) e aplica CSS vars `--admin-primary/--admin-accent/--admin-positive/--admin-negative` no `<html>` (whitelabel).
- **`useTheme()`**: toggle dark local (persistido no `<html>` via `.dark`).
- **Command palette**: `Cmd/Ctrl+K` → `AdminCommandPalette`.
- **Nav estática** agrupada em: Visão Geral, Clientes, Receita, Operações, Plataforma.
- **Topbar**: breadcrumb, search trigger, theme toggle, bell placeholder, botão "Voltar ao app" (`navigate("/")`), Sign-out (retorna a `/admin/login`).
- Exporta helpers `AdminPageHeader` e `AdminCard` reusados por todas as páginas admin.

## 8. i18n & Multi-região

### 8.1 Bootstrap (`src/i18n/index.ts`)
`react-i18next` com 3 bundles JSON (`locales/pt-BR.json`, `es-ES.json`, `en-US.json`). Idioma inicial: `pt-BR` (default) e fallback também `pt-BR`. `escapeValue: false`, `returnNull: false`.

### 8.2 Sincronização (`src/i18n/useI18nSync.ts`)
Hook chamado por `AppShell`. Lê `useRegion().locale`, normaliza contra `SUPPORTED_LOCALES` e chama `i18n.changeLanguage()` se divergir.

### 8.3 Region config
- `src/lib/region.ts` define `REGION_DEFAULTS` para `br|es|us` (locale, timezone, currency, phoneCountry, paymentProvider, whatsappProvider, legalFramework, routePrefix).
- `src/hooks/useRegion.ts` consulta `clinics.{region,locale,timezone,currency,phone_country}` via react-query (staleTime 5min), aplica `buildRegionConfig()` para mesclar defaults+overrides, e mantém `<html lang>` sincronizado.
- Sem `clinicId` (super admin puro / carregando) → cai no default `br`.

Referências detalhadas: `docs/i18n/REGION_CONFIG.md`, `docs/i18n/TRANSLATION_PROCESS.md`.

## 9. Cliente Supabase & URLs

- **`src/integrations/supabase/client.ts`** (auto-gerado — **não editar**): cria `supabase` com `localStorage`, `persistSession`, `autoRefreshToken`. Envs `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **`src/lib/supabase-env.ts`**: expõe `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FUNCTIONS_URL` e `getFunctionHeaders()` para chamadas `fetch()` diretas (streaming) que não usam o SDK.
- **`src/lib/app-url.ts`**: `APP_BASE_URL = "https://chatfunnelai.com"` — usado sempre que o destino não pode depender de `window.location.origin` (ex.: `resetPasswordForEmail(redirectTo)`).

## 10. Fluxo de login (`src/pages/Auth.tsx`)

Diferente de um `signInWithPassword` cru — usa a edge `auth-login`:

1. Chama `supabase.functions.invoke("auth-login", { email, password })`.
2. Se resposta `error === "locked"` → toast com tempo restante (`retry_after_seconds`).
3. Se `ok && session` → `supabase.auth.setSession({ access_token, refresh_token })`.
4. Se usuário tem `user_roles = super_admin` **e** não tem `clinic_members` → força `signOut` + toast "portal errado" (super admins puros devem entrar em `/admin/login`).
5. `nav(from, { replace: true })` para a rota original.

Reset de senha: `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${APP_BASE_URL}/reset-password\` })`.

## 11. Utilitários montados globalmente

- **`TitleSync`** (`useUnreadTitle`) — atualiza `document.title` com contagem de não-lidas.
- **`ShortcutsDialog`** — dispara em `?` (evento `open-shortcuts`).
- **`CommandPalette`** — atalho global (usuário final).
- **`DialogsProvider`** — provider de diálogos imperativos (`useDialogs()`).
- **`ErrorBoundary`** — envolve toda a árvore autenticada, mostra fallback amigável e loga em `error_events`.

## 12. Invariantes (não quebrar sem revisar)

1. `AuthProvider` **precisa** estar dentro de `BrowserRouter` (usa `Navigate` implicitamente via gates).
2. `loadCtx` **deve** rodar via `setTimeout(0)` dentro de `onAuthStateChange` — chamada síncrona causa deadlock no cliente supabase-js.
3. `/reset-password` **não pode** virar rota protegida — o Supabase auto-loga o usuário via `type=recovery` mesmo sem UI.
4. `RootGate` decide o destino de `/` — qualquer nova rota "raiz" deve ser adicionada antes do catch-all `*`.
5. Feature flag ausente = habilitada. Nunca inverter para default-off sem migração de `clinics.settings.features`.
6. `AppShell` sub-router usa `<Routes>` interno — rotas novas de área operacional entram lá, **não** no `<Routes>` externo.
7. Nunca editar `src/integrations/supabase/client.ts`, `types.ts`, `.env` (auto-gerados).
8. Super admin sem membership **não** pode ver rotas operacionais (garantia dupla: `RootGate` + `ClinicOnlyRoute`).

## 13. Gaps identificados nesta auditoria

- `src/components/CommandPalette.tsx` e `ShortcutsDialog.tsx` não têm doc — cobrir em Fase 2 (Inbox/Kanban) já que operam sobre leads.
- `src/hooks/useUnreadTitle.ts` sem doc — trivial, incluir em Fase 2.
- `src/components/ErrorBoundary.tsx` sem doc — cobrir em Fase 10 (observabilidade).
- `AppShell` ainda tem labels hardcoded em PT ("Trabalho", "Marketing", "Administração") em `GROUP_LABELS` — não estão no bundle i18n. Não é bug funcional (labels não são renderizados no visual atual, só usados como key), mas registrar em Fase 13.
