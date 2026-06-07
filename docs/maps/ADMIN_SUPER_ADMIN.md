---
title: "Mapa: Admin / Super Admin"
topic: admin
kind: map
audience: agent
updated: 2026-06-07
summary: "Painel `/admin` (super_admin only) para gestão cross-clínica: dashboard global, clínicas, usuários, planos & assinaturas, limites de uso, financeiro (faturas/KPIs), observabilidade (feature_events/error_events), suporte (chat Alfred + monit"
---
# Mapa: Admin / Super Admin

> **Para localizar edições.** Para entender *por quê*, leia [`docs/architecture/SUPER_ADMIN.md`](../architecture/SUPER_ADMIN.md) (fonte canônica do papel).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Painel `/admin` (super_admin only) para gestão cross-clínica: dashboard global, clínicas, usuários, planos & assinaturas, limites de uso, financeiro (faturas/KPIs), observabilidade (feature_events/error_events), suporte (chat Alfred + monitor ao vivo + KB), integrações (Evolution/Resend), domínios, auditoria, manual do Builder, controle de gastos IA.

> Para o sub-domínio **billing/financeiro/observabilidade** existe um mapa dedicado: [`docs/maps/BILLING_PLANS.md`](./BILLING_PLANS.md). Para **suporte/Alfred**, ver fluxo nos componentes `Support*` e edges `support-*` listados abaixo.

## 2. Rotas / pontos de entrada

| Rota | Componente | Acesso |
|---|---|---|
| `/admin` | `src/pages/Admin.tsx` | `has_role(auth.uid(), 'super_admin')` |
| `/admin` → abas | painéis em `src/components/admin/*` | mesmo gate |

## 3. Frontend

### Componentes (`src/components/admin/`)
| Arquivo | Função |
|---|---|
| `DashboardPanel.tsx` | Visão geral cross-clínica |
| `UsersPanel.tsx` | Lista usuários + ações (ban, promover, reset) |
| `PlansPanel.tsx` | CRUD planos disponíveis |
| `UsageLimitsPanel.tsx` | Limites por clínica (msgs/mês, IA, email) |
| `AiSpendLimitCard.tsx` | `ai_spend_limits.monthly_cap_usd` por clínica |
| `FinancePanel.tsx` | KPIs financeiros, gráfico de receita, inadimplentes, distribuição de planos, CRUD de faturas |
| `ObservabilityPanel.tsx` | Uso por feature, dead features (>30d sem uso), erros recentes |
| `SupportPanel.tsx` | Aba Suporte: agrega monitor + telemetria + pins + status KB |
| `SupportLiveMonitor.tsx` | Conversas Alfred em tempo real (realtime channel) com takeover/pin |
| `SupportTelemetry.tsx` | Threads históricas + viewer com resposta manual do admin |
| `SupportPinsCard.tsx` | Mensagens fixadas para revisão posterior |
| `IntegrationsKeysCard.tsx` | Chaves globais (Evolution, Resend) |
| `IntegrationsDomainsTable.tsx` | Domínios verificados (cross-clínica) |
| `IntegrationsQuotaTable.tsx` | Quotas usadas vs disponíveis |
| `ClinicDetailsDialog.tsx` | Drilldown por clínica (inclui aba "Plano & Assinatura") |
| `BuilderManualPanel.tsx` | Editor do manual do Builder (versionado em `builder_manual_versions`) |
| `AuditPanel.tsx` | Eventos de auditoria |

### Libs
- `src/lib/admin-plans.ts` — helpers de plano.

### Auth gate
- `src/hooks/useAuth.tsx` expõe `isSuperAdmin`.
- `src/components/ProtectedRoute.tsx` + `src/components/FeatureRoute.tsx` aplicam gate em `/admin`.

## 4. Edge functions

### Puro super_admin
| Function | Função |
|---|---|
| `admin-users-list/index.ts` | lista usuários (cross-clínica) |
| `admin-user-action/index.ts` | ban/unban/promote/reset/delete |
| `admin-apply-plan/index.ts` | aplica plano a clínica (cria `clinic_subscriptions` manual) |
| `admin-revoke-plan/index.ts` | revoga assinatura corrente → fallback Starter `past_due` |
| `admin-invoice/index.ts` | `create` / `mark_paid` / `void` / `delete` de fatura |
| `cron-expire-manual-grants/index.ts` | cron diário: expira `manual_grant`/`trialing` vencidos |
| `support-admin-reply/index.ts` | admin assume/libera thread Alfred e envia resposta humana |
| `support-kb-sync/index.ts` | sincroniza KB do Alfred a partir dos `.md` do repo |
| `support-kb-status/index.ts` | diff de hashes (in_sync / stale / missing / deleted) |
| `support-test-connection/index.ts` | sanity check do provedor de IA do Alfred |
| `integrations-status/index.ts` | status das integrações |
| `backfill-resend-events/index.ts` | reconciliação histórica de eventos |
| `email-domain-manage/index.ts` | CRUD domínios |

### Misto (super_admin OU clinic admin OU usuário autenticado)
| Function | Notas |
|---|---|
| `clinic-invite/index.ts` | convida usuário (super_admin ou owner/admin da clínica) |
| `clinic-create-user/index.ts` | cria user direto (idem) |
| `evolution-provision/index.ts` | provisiona instância WhatsApp |
| `evolution-delete-instance/index.ts` | remove instância |
| `forms-admin/index.ts` | CRUD forms |
| `dispatch-campaign/index.ts` | dispara campanha (clinic admin no caso normal) |
| `send-email/index.ts` | envio app email |
| `support-chat/index.ts` | chat Alfred — qualquer autenticado; bloqueia com `423` quando thread em takeover humano |
| `track-event/index.ts` | qualquer autenticado — insere batch em `feature_events` |
| `log-frontend-error/index.ts` | aceita anônimo (ErrorBoundary global) — insere em `error_events` |
| `tracking-event/index.ts` / `tracking-identify/index.ts` | público com `clinic_id`; super_admin só p/ inspeção |

Todas as funções "puro super_admin" verificam `has_role`/`is_super_admin` no início, antes de qualquer side effect.

## 5. Banco de dados

### Tabelas
| Tabela | Função |
|---|---|
| `user_roles` | `user_id`, `role` (`super_admin`, `admin`, `member`). RLS: read próprio + super_admin. |
| `clinics` | tenants. `settings` jsonb com `ai.*`, `email.*`. Coluna `plan_id` FK → `plans(id)`; `plan` text é espelho via trigger. |
| `clinic_members` | vinculação user ↔ clinic |
| `plans` | catálogo de planos (+ `stripe_*` reservados) |
| `clinic_subscriptions` | assinatura corrente/histórica por clínica (1 com `is_current=true` por clínica, índice único parcial) |
| `plan_change_log` | auditoria automática de mudanças de plano (trigger) |
| `invoices` | faturas manuais (`paid`/`open`/`overdue`/`void`) |
| `payment_receipts` | comprovantes de pagamento |
| `feature_events` | telemetria de uso por feature (insert do próprio usuário ou super_admin) |
| `error_events` | erros de frontend (ErrorBoundary → `log-frontend-error`, aceita anônimo) |
| `usage_counters` | contadores correntes (espelhos) |
| `ai_spend_limits` | cap mensal de IA |
| `audit_log` | eventos sensíveis |
| `builder_manual_versions` | versionamento do manual do Builder |
| `support_chat_threads` | threads do Alfred (com `taken_over_by`/`taken_over_at` para handoff humano) |
| `support_chat_messages` | mensagens do Alfred (com `pinned_*` para revisão posterior) |
| `support_documents` | KB indexada (com `hash` p/ diff via `support-kb-status`) |
| `integration_secrets` (ou similar) | chaves globais (criptografadas) |

### Funções
- `has_role(_user_id uuid, _role app_role) RETURNS boolean` — SECURITY DEFINER, fonte da verdade do gate.
- `is_super_admin()` — wrapper conveniente.
- `current_user_clinic()` — clinic_id do user logado.

### RLS — dois padrões
1. **Tenant + bypass**: política `clinic_id = current_user_clinic() OR has_role(auth.uid(), 'super_admin')`.
2. **Super_admin only**: política `has_role(auth.uid(), 'super_admin')`.

## 6. Integrações externas

- Nenhuma direta — admin apenas configura chaves globais que outras features usam.

## 7. Invariantes — "não toque sem ler"

1. **Roles SEMPRE em `user_roles`.** Nunca em `profiles` ou coluna direta — risco de privilege escalation.
2. **Gate via `has_role()` (SECURITY DEFINER).** Não testar role em RLS lendo coluna direto (recursão).
3. **Verificação no servidor.** Frontend `isSuperAdmin` é apenas UX; toda edge sensível re-verifica via `has_role` no banco.
4. **Mudança de plano** passa por `admin-apply-plan` — não UPDATE direto em `clinic_plans` (trigger de auditoria + ajuste de `usage_limits`).
5. **Chaves globais criptografadas** — não logar nem retornar plain no GET.
6. **Auditoria obrigatória** em: ban user, mudar plano, apagar instância, rotacionar chave global.
7. **Manual do Builder** é cross-clínica (super_admin), versionado. Activar nova versão flipa `active=true` na nova e `false` nas demais via trigger.

## 8. Pegadinhas

- Adicionou tabela sem `has_role` na policy → super_admin não vê dados de outras clínicas (perde visão cross-tenant).
- `clinic_members` vs `user_roles`: membros são por clínica; roles são globais. Não confundir.
- Cache de plano: `usage_limits` é snapshot — mudar `plans` não recalcula automaticamente, precisa de `admin-apply-plan` ou job.
- `audit_log` cresce rápido — não fazer SELECT * sem filtro.

## 9. Receitas

### Adicionar nova ação admin (ex: "exportar dados da clínica")
1. Edge nova: `supabase/functions/admin-export-clinic/index.ts` com `has_role` check.
2. UI: novo botão/painel em `src/components/admin/`.
3. Auditoria: insert em `audit_log` com `actor_id`, `action`, `target_clinic_id`.
4. Documentar em `architecture/SUPER_ADMIN.md`.

### Adicionar coluna de limite no plano
1. Migration: `ALTER TABLE plans ADD COLUMN ...`.
2. `usage_limits` espelha — adicionar coluna lá também.
3. `admin-apply-plan` copia novo campo.
4. UI: `PlansPanel.tsx` + `UsageLimitsPanel.tsx`.
5. Enforcement: edge function relevante (ex: `_shared/spend-guard.ts` para IA) checa o novo limite.

### Promover usuário para super_admin
1. UI: `UsersPanel.tsx` → ação "promover".
2. Edge `admin-user-action` insere em `user_roles` com role='super_admin'.
3. Auditar.

### Adicionar policy nova com bypass super_admin
```sql
CREATE POLICY "tenant_or_super" ON public.<table>
  FOR SELECT USING (
    clinic_id = current_user_clinic()
    OR has_role(auth.uid(), 'super_admin')
  );
```

### Debug "super_admin não vê dados de outra clínica"
1. RLS da tabela tem `OR has_role(auth.uid(), 'super_admin')`?
2. `user_roles` tem a row correta (`role='super_admin'`)?
3. `useAuth.isSuperAdmin` no frontend retorna true?
4. Edge function relevante chama `has_role` antes do query?
