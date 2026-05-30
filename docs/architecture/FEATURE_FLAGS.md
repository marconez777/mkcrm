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
