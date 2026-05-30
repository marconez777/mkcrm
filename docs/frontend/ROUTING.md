# Frontend — Roteamento

> Mapa de URLs, guards e padrões de navegação.
>
> Última atualização: 2026-05-25
> Fonte da verdade: `src/App.tsx`.

---

## 1. Router

`BrowserRouter` (react-router-dom v6). SPA fallback é nativo do Lovable
hosting — **não usar** `_redirects`, `_headers`, `vercel.json` etc.

Estrutura em **2 níveis** de `<Routes>`:

```text
<Routes>
  /auth, /invite/:token, /unsubscribe, /admin, /onboarding   ← públicas/standalone
  /*  → <ProtectedRoute><AppShell><Routes>{rotas internas}</Routes></AppShell></ProtectedRoute>
</Routes>
```

`AppShell` renderiza a sidebar + topbar e envolve TODAS as rotas internas.
`/admin` e `/onboarding` são protegidas mas **fora** do shell (telas full-screen).

---

## 2. Guards

### 2.1 `<ProtectedRoute>` (`src/components/ProtectedRoute.tsx`)
- Aguarda `useAuth().loading`. Sem sessão → `<Navigate to="/auth" state={{from}}/>`.
- Não verifica membership/role. Esse trabalho é do `AppShell` + `FeatureRoute`.

### 2.2 `<FeatureRoute feature="...">` (`src/components/FeatureRoute.tsx`)
- Usa `useAuth().hasFeature(key)`. Se `false`, **toast** + `Navigate to="/"`.
- `super_admin` sempre passa.
- Catálogo de keys em `src/lib/features.ts`. Default = on quando a key não
  está em `clinics.settings.features`.

### 2.3 Role-based gating (manual, dentro do `AppShell`)
- `membership.role === "professional"` → remove `/ai` da sidebar.
- `owner|admin|super_admin` → vê `/tracking`, `/team`, `/admin`.
- `tracking-debug` exige `clinic.settings.tracking.debug_enabled = true`
  ou super admin.

> Importante: gating de **sidebar** NÃO bloqueia o acesso por URL — quem
> protege a URL é o `FeatureRoute`. Quando criar nova rota sensível,
> envolver com `<FeatureRoute>` E adicionar lógica na sidebar.

---

## 3. Mapa de rotas

| Path                                         | Page component                         | Guard                              |
|----------------------------------------------|----------------------------------------|------------------------------------|
| `/auth`                                      | `pages/Auth`                           | público                            |
| `/invite/:token`                             | `pages/Invite`                         | público                            |
| `/unsubscribe`                               | `pages/Unsubscribe`                    | público                            |
| `/admin`                                     | `pages/Admin`                          | Protected (super_admin no body)    |
| `/onboarding`                                | `pages/Onboarding`                     | Protected                          |
| `/`                                          | `pages/Kanban`                         | Protected                          |
| `/inbox`, `/inbox/:leadId`                   | `pages/Inbox`                          | Feature `inbox`                    |
| `/ai`                                        | `pages/ai/AiHub`                       | Protected                          |
| `/ai/agents`, `/agents`                      | `AiHub`                                | Feature `agents`                   |
| `/ai/memories`, `/agents/memories`           | `AiHub`                                | Feature `agents`                   |
| `/ai/insights`                               | `AiHub`                                | Feature `agents`                   |
| `/ai/usage`, `/metrics/ai-usage`             | `AiHub`                                | Feature `metrics_ai_usage`         |
| `/automations`, `/ai/automations`, `/ai/messages/automations` | `AiHub`               | Feature `automations`              |
| `/sequences`, `/ai/sequences`, `/ai/messages/sequences` | `AiHub`                     | Feature `sequences`                |
| `/templates`, `/ai/templates`, `/ai/messages/templates` | `AiHub`                     | Feature `templates`                |
| `/ai/broadcasts`, `/ai/broadcasts/:id`       | `AiHub`                                | Feature `broadcasts`               |
| `/ai/reports`                                | `AiHub`                                | Protected                          |
| `/ai/engagement`, `/metrics/engagement`, `/metrics` | `AiHub`                         | Protected                          |
| `/ai/messages`                               | `AiHub`                                | Protected                          |
| `/email/*` (10 sub-rotas)                    | `pages/email/EmailHub`                 | Feature `email_marketing`          |
| `/email/templates/:id`                       | `pages/email/EmailTemplateEditor`      | Feature `email_marketing`          |
| `/settings`                                  | `pages/Settings`                       | Protected                          |
| `/settings/fields`                           | `pages/SettingsCustomFields`           | Feature `custom_fields`            |
| `/settings/forms`                            | `pages/SettingsForms`                  | Protected                          |
| `/settings/email`                            | `pages/email/SettingsEmailDomain`      | Protected                          |
| `/tracking`                                  | `pages/Tracking`                       | Protected (admin no shell)         |
| `/tracking-debug`                            | `pages/TrackingDebug`                  | Protected (flag)                   |
| `/tasks`                                     | `pages/Tasks`                          | Feature `tasks`                    |
| `/team`                                      | `pages/Team`                           | Feature `team`                     |
| `*`                                          | `pages/NotFound`                       | dentro do AppShell                 |

> Note como `AiHub` concentra ~15 rotas. Ele é um **hub** que faz
> sub-roteamento interno por `useLocation()` para renderizar a tela certa
> (Agents, Memories, Insights, Automations, Sequences, Templates,
> Broadcasts, Messages). Detalhes em `frontend/PAGES.md`.

---

## 4. Padrões de navegação

- **Sempre `<NavLink>` ou `useNavigate`** — nunca `<a href>` para rotas
  internas (perde estado, faz full reload).
- **Drawers/lead detail** são rotas filhas (`/inbox/:leadId`) ou query
  params, não modais sem URL — permite linkar e voltar com o navegador.
- **Persistência de query params**: `?qr=1` em `/settings` abre o
  `WhatsAppQrDialog` automaticamente; `/email/templates/:id` é deep link
  para o editor.
- **TitleSync** (`src/hooks/useUnreadTitle.ts`) injeta `(N)` no
  `document.title` quando há mensagens não lidas — independente da rota.

---

## 5. Pegadinhas

- Adicionar `<Route>` no nível errado quebra o shell (rota aparece sem
  sidebar). Rotas internas vão no `<Routes>` aninhado dentro de
  `AppShell`.
- `<FeatureRoute>` precisa **envolver** o componente. Esquecer dele faz a
  URL ficar acessível por digitação direta mesmo com feature off.
- `NotFound` está dentro do shell — uma 404 em `/auth-mal-digitado` cai
  no `/auth` (página pública). Só rotas internas inexistentes mostram
  `NotFound`.
- `/ai/*` tem muitas duplicações intencionais (`/agents` ↔ `/ai/agents`)
  por compatibilidade histórica. Ao remover, conferir links externos
  (sequence-trigger, emails enviados, etc.).

---

## 6. Melhorias sugeridas

- Migrar para **react-router v6.4 data routers** (`createBrowserRouter`)
  para suportar `loader`/`action` e lazy loading por rota.
- Consolidar rotas legadas (`/agents`, `/automations` etc.) em
  `Navigate` redirects para `/ai/...` e deprecar.
- Code-splitting: hoje todas as páginas são imports estáticos. Bundle
  inicial poderia ser cortado com `lazy()` + `<Suspense>` por feature.
