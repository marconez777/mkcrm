# Atualização da Documentação — Junho/2026

Objetivo: alinhar `docs/` ao estado atual do código após as mudanças desta sessão (Admin v2, catálogo `plans`, limites por plano, redesign Agentes/AppShell). Nenhuma mudança em código de runtime — só `docs/*.md`.

Data de bump em todos os arquivos tocados: **2026-06-03**.

---

## Frente 1 — Admin v2 + Catálogo de Planos + Limites

### 1.1 Novo arquivo: `docs/architecture/PLANS_LIMITS.md`
Documento de referência para o modelo de planos/limites. Conteúdo:
- Modelo da tabela `public.plans` (colunas, defaults, RLS, GRANTS).
- Relação `plans.features` ↔ `clinics.settings.features` (defaults aplicáveis via `admin-apply-plan`).
- Tabela completa do `LIMIT_DEFS` (chave, label, unidade, fonte de uso correspondente em `USAGE_KEY_MAP`).
- Hierarquia de override: `plans.limits` → `clinics.settings.limits` (clínica sobrepõe plano; `null` = ilimitado).
- Enforcement: nota explícita que **fase 1 só persiste/exibe**; wiring nas edge functions de criação fica como roadmap.
- Cross-links com `FEATURE_FLAGS.md` e `operations/COSTS_LIMITS.md`.

### 1.2 `docs/database/SCHEMA.md`
- Adicionar bloco da tabela `plans` (colunas, índices, unique em `code`, seed `free`/`starter`/`pro`/`enterprise`).
- Adicionar nota em `clinics`: campos `settings.features` e `settings.limits` agora derivam de `plans` (continua jsonb livre).

### 1.3 `docs/database/RLS_POLICIES.md`
- Adicionar bloco `plans`: SELECT para `authenticated`, ALL gated por `is_super_admin()`, GRANTS explícitos.

### 1.4 `docs/database/FUNCTIONS_TRIGGERS.md`
- Documentar 3 RPCs novos (assinatura, retorno, gate `is_super_admin()`):
  - `admin_overview_metrics()` → jsonb (clinics/users/ai/email)
  - `admin_top_clinics(_metric text, _limit int)` → setof record
  - `admin_clinic_usage(_clinic uuid, _from date, _to date)` → jsonb

### 1.5 `docs/edge-functions/INDEX.md`
- Adicionar 3 entradas (path, método, auth, payload, resposta):
  - `admin-users-list` — paginação cross-tenant em `auth.users` + joins.
  - `admin-user-action` — `set_password`, `unlock`, `sign_out`, `toggle_super_admin`.
  - `admin-apply-plan` — copia `features`/`limits` do plano para clínicas selecionadas.
- Atualizar tabela-índice. Marcar todas como super-admin-only (verificação em código, não só `verify_jwt`).

### 1.6 `docs/frontend/PAGES.md`
- Reescrever a linha de `Admin.tsx`: deixar de ser one-liner e virar subseção própria com as 8 abas:
  ```text
  /admin
   ├─ Dashboard        (DashboardPanel)
   ├─ Clínicas         (existente)
   ├─ Usuários         (UsersPanel)
   ├─ Planos           (PlansPanel + PlanEditorDialog)
   ├─ Uso & Limites    (UsageLimitsPanel)
   ├─ Integrações      (existente)
   ├─ Auditoria        (AuditPanel)
   └─ Manual do Builder
  ```
- Listar edge functions invocadas por cada aba.

### 1.7 `docs/frontend/COMPONENTS.md`
- Seção "Admin" passa a listar: `DashboardPanel`, `UsersPanel`, `PlansPanel`, `PlanEditorDialog` (tabs Geral/Recursos/Limites), `UsageLimitsPanel`, `AuditPanel`, além dos existentes (`AiSpendLimitCard`, `IntegrationsKeysCard`, `IntegrationsDomainsTable`, `IntegrationsQuotaTable`, `BuilderManualPanel`).

### 1.8 `docs/frontend/HOOKS_LIB.md`
- Adicionar entrada para `src/lib/admin-plans.ts` (export `LIMIT_DEFS`, `USAGE_KEY_MAP`).

### 1.9 `docs/architecture/FEATURE_FLAGS.md`
- Nova seção "Defaults via planos" explicando: catálogo continua em `src/lib/features.ts`, mas o **valor default por clínica** pode vir de `plans.features` aplicado por `admin-apply-plan`. Override por clínica em `clinics.settings.features` (já documentado) permanece a fonte de verdade em runtime.

### 1.10 `docs/OVERVIEW.md`
- Lista de edge functions: adicionar `admin-users-list`, `admin-user-action`, `admin-apply-plan`.
- Seção "Multi-clínica": citar `plans` como catálogo configurável.

---

## Frente 2 — Design (Agentes + AppShell premium dark)

### 2.1 `docs/frontend/DESIGN_SYSTEM.md`
- Nova subseção "Premium dark" descrevendo:
  - Direção visual aplicada ao AppShell (cor + badges + grupos da sidebar).
  - Token de accent por categoria (`--tab-*` mapeados em `--accent`).
- Nova subseção "SectionAccordion" (componente em `src/components/ui/section-accordion.tsx`):
  - Props (`title`, `subtitle`, `badge`, `accent`, `flagship`).
  - Padrão visual: barra indicadora 3px à esquerda, icon plate tintada (`0.10`), bg tintado (`0.04`), shadow colorida.
  - Mapa de accents usado na página Agentes:
    - slate → Geral, Provedor, Auditoria, Histórico
    - info → RAG avançado, Base de conhecimento
    - primary (flagship) → Co-piloto
    - violet → Personas
    - cyan → Estágios
    - fuchsia → Aprender, Insights
    - teal → MCP
    - emerald → Ferramentas, Custos
    - amber → Evals, Testar

### 2.2 `docs/features/BUILDER_AGENTS.md`
- Nova seção "UX da página /ai/agents": agrupamento por categoria, accordion único expansível, subtítulos descritivos, accents.
- Atualizar screenshot/diagrama mental do layout (descrição textual, sem imagem).

---

## Frente 3 — CHANGELOG + housekeeping

### 3.1 `docs/CHANGELOG.md`
Nova entry no topo:

```text
## 2026-06-03 — Admin v2 + catálogo de Planos + redesigns

### Adicionado
- docs/architecture/PLANS_LIMITS.md (novo) — modelo plans/limites + override por clínica.
- docs/database/SCHEMA.md, RLS_POLICIES.md, FUNCTIONS_TRIGGERS.md — tabela `plans`,
  policies, 3 RPCs `admin_*_metrics`/`admin_top_clinics`/`admin_clinic_usage`.
- docs/edge-functions/INDEX.md — `admin-users-list`, `admin-user-action`,
  `admin-apply-plan`.
- docs/frontend/PAGES.md — Admin.tsx reescrito com 8 abas.
- docs/frontend/COMPONENTS.md — DashboardPanel/UsersPanel/PlansPanel/
  UsageLimitsPanel/AuditPanel.
- docs/frontend/HOOKS_LIB.md — src/lib/admin-plans.ts.
- docs/architecture/FEATURE_FLAGS.md — relação plans.features ↔ clinic settings.
- docs/frontend/DESIGN_SYSTEM.md — Premium dark + SectionAccordion + accents.
- docs/features/BUILDER_AGENTS.md — nova UX da página Agentes.
```

### 3.2 `docs/README.md`
- Bump da data para 2026-06-03 e atualização do contador de arquivos (novo `PLANS_LIMITS.md`).

### 3.3 `docs/OVERVIEW.md`
- Bump da data.

---

## Fora de escopo

- Documentar enforcement de limites em runtime (continua roadmap em `PLANS_LIMITS.md`).
- Documentação de cobrança / Stripe (será tratada quando a integração for ativada).
- Tradução para inglês.
- Imagens/screenshots — só descrição textual.

---

## Ordem de execução sugerida

1. Frente 1 (10 arquivos) — maior gap, base para o resto.
2. Frente 2 (2 arquivos).
3. Frente 3 (CHANGELOG + bumps).

Total: **~13 arquivos editados, 1 criado**.
