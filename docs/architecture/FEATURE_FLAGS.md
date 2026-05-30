# Feature Flags

> **Quando ler:** ao adicionar/ocultar uma funcionalidade do produto por clínica, ou ao criar uma rota nova.
> **Última atualização:** 2026-05-30

---

## Modelo

Flags ficam em `clinics.settings.features` (jsonb), no formato:

```json
{ "features": { "broadcasts": false, "metrics_ai": true } }
```

**Convenção:** chave **ausente = liberada** (default-on). Só desabilita explicitamente quem coloca `false`.

---

## Catálogo (`src/lib/features.ts`)

| Key | Label | Notas |
|---|---|---|
| `inbox` | Conversas (Inbox) | |
| `tasks` | Tarefas | Board tipo Trello |
| `agents` | Agentes IA | Habilita `/ai/*` |
| `automations` | Automações | |
| `sequences` | Sequências | |
| `templates` | Templates | Quick replies |
| `metrics` | Métricas (Operação) | |
| `metrics_ai` | Métricas IA | |
| `metrics_ai_usage` | Custos IA | Inclui novo sistema de spend limit |
| `custom_fields` | Campos personalizados | |
| `team` | Equipe | |
| `email_marketing` | Email Marketing | Templates + automações + campanhas |
| `broadcasts` | Disparo em massa WhatsApp | |

> Para adicionar uma flag nova: editar `FEATURES` em `src/lib/features.ts`. **Não** é preciso migração — `clinics.settings` é jsonb livre.

> **Não confundir com configurações de domínio.** O módulo de email tem ligas/desligas por clínica que **não são feature flags globais**, e sim colunas de configuração:
> - `email_campaigns.variant_strategy` (`none|ab|multi`) — ativa A/B por campanha (R-20). Sem catálogo em `features.ts`.
> - `email_campaigns.from_domain_pool` (text) — opta por rotação de domínio quando um pool em `email_domains.rotation_pool` existir (R-21).
> - `clinics.settings.email.throttle_recipient_enabled` (bool, default `true`) — desliga a RPC `claim_recipient_throttle` para clientes em alto volume (R-23).
> - `clinics.settings.email.quota_daily` (int, default 1000) — override do cap diário consumido por `claim_email_quota`.
>
> Use `clinic_settings` / coluna dedicada para estas; reserve `features.*` para gates de **produto** (esconde rota, esconde menu).

---

## Como usar

### No frontend

```ts
const { hasFeature } = useAuth();
if (!hasFeature("broadcasts")) return null;
```

Para rotas:

```tsx
<Route element={<FeatureRoute feature="broadcasts" />}>
  <Route path="/ai/broadcasts" element={<Broadcasts />} />
</Route>
```

`FeatureRoute.tsx` redireciona para `/` se a feature está off (super admin passa direto).

Sidebar (`AppShell.tsx`) esconde itens automaticamente via `hasFeature(key)`.

### No backend (SQL / edge)

```sql
IF NOT public.clinic_has_feature(_clinic_id, 'email_marketing') THEN
  RETURN NULL;
END IF;
```

Edge function:
```ts
const { data: ok } = await supabase.rpc("clinic_has_feature", {
  _clinic_id: clinicId, _key: "broadcasts",
});
if (!ok) return new Response("feature_disabled", { status: 403 });
```

---

## Quem altera

Apenas **super admin**. Garantido por trigger `guard_clinic_features()` em `clinics`:

```sql
IF settings->'features' mudou AND NOT is_super_admin()
  THEN RAISE EXCEPTION 'only super admin can change clinic features';
```

UI: `/admin` → tabela de clínicas → toggles por feature.

---

## Pegadinhas

- **Feature default-on** significa que clinics novas têm tudo liberado. Se quiser restringir, super admin precisa desligar manualmente.
- Esconder na sidebar **não basta** — sempre proteger com `FeatureRoute` E checar no backend se há operação sensível.
- `super_admin` **bypassa** todas as flags (`hasFeature` retorna `true` se `isSuperAdmin`).
