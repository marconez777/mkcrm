
## Objetivo

Permitir que o **Super Admin** ligue/desligue telas e recursos para cada clínica do CRM. As clínicas só veem (e só conseguem acessar) o que estiver liberado.

## Modelo de dados

Reaproveitar a coluna existente `clinics.settings jsonb` (já existe, default `{}`) — sem nova tabela.

Convenção:
```json
{
  "features": {
    "inbox": true,
    "tasks": true,
    "agents": true,
    "automations": true,
    "sequences": true,
    "templates": true,
    "metrics": true,
    "metrics_ai": true,
    "metrics_ai_usage": true,
    "tracking": true,
    "custom_fields": true,
    "team": true
  }
}
```

Regra: **flag ausente = liberada** (compatível com clínicas atuais). `Pipeline` e `Configurações` ficam sempre disponíveis (não bloqueáveis), assim como `/admin` (super admin) e `/auth`.

Catálogo das features (fonte única) em `src/lib/features.ts`:
- `key` → `{ label, route(s), navMatch }`
- Inclui também as features sem rota dedicada que queremos governar futuramente (ex.: `tracking` controla o card no Settings).

## Backend

Migration:

1. Função `has_feature(_clinic uuid, _key text) returns boolean` `SECURITY DEFINER`:
   - lê `clinics.settings->'features'->>_key`;
   - retorna `true` quando ausente/`null` ou `'true'`, `false` quando `'false'`.
2. Helper `current_clinic_has_feature(_key text)` que combina com `current_clinic_id()`.
3. Reforço em RLS de tabelas “feature-gated” como camada extra (defense in depth):
   - `automations`, `message_sequences`, `message_sequence_steps`, `message_sequence_enrollments`, `message_templates`, `ai_agents`.
   - Adicionar a cada policy `clinic_scoped` existente uma policy adicional `feature_gated` que exige `current_clinic_has_feature('<key>')`. Mantém a policy original (políticas são OR-uma-com-outra → trocar a existing por uma combinada usando `AND` é o caminho correto: dropar e recriar com `clinic_id = current_clinic_id() AND current_clinic_has_feature('automations')` etc.).
4. Política do `clinics.settings`: já coberta por `clinics_admin_update`. Adicionar trigger que **bloqueia** updates em `settings.features` quando `NOT is_super_admin()` (admin de clínica não pode auto-liberar features).

## UI — Super Admin (`src/pages/Admin.tsx`)

Nova ação na linha de cada clínica: botão **Recursos** abre `Dialog` com a lista do catálogo + `Switch` por feature. Ao salvar:
```ts
await supabase.from("clinics").update({
  settings: { ...c.settings, features: nextFeatures }
}).eq("id", c.id);
```
Mostrar contagem `N/M habilitadas` na tabela.

## UI — clínica

1. **`useAuth`**: estender `Membership.clinic` com `settings: { features?: Record<string, boolean> }` (já vem do select, basta incluir `settings` no `select`). Expor helper `hasFeature(key)` no contexto.
2. **`AppShell`**: filtrar `navItems` pelo `hasFeature(item.featureKey)`. Mapear cada item do `items[]` para sua `featureKey` (Pipeline e Settings sem key = sempre).
3. **Guard de rota**: novo componente `<FeatureRoute feature="...">` que redireciona para `/` com toast “Recurso indisponível” quando bloqueado. Aplicar em `App.tsx` nas rotas correspondentes.
4. **Settings**: esconder o card *Tracking* / *Custom fields* quando a feature respectiva estiver off.

## Gating extra

- Edge functions sensíveis (`ai-chat`, `ai-auto-reply`, `automations-tick`, `sequence-tick`) consultam `current_clinic_has_feature` antes de processar — retornam `403` se desligado. Evita execução server-side mesmo se alguém chamar direto.

## Entregáveis

```text
supabase/migrations/<ts>_clinic_features.sql
src/lib/features.ts                  (catálogo)
src/hooks/useAuth.tsx                (+ settings, hasFeature)
src/components/FeatureRoute.tsx      (novo)
src/components/AppShell.tsx          (filtro do menu)
src/App.tsx                          (envolver rotas)
src/pages/Admin.tsx                  (botão + dialog "Recursos")
src/pages/Settings.tsx               (esconde cards bloqueados)
supabase/functions/ai-chat/index.ts          (+ check)
supabase/functions/ai-auto-reply/index.ts    (+ check)
supabase/functions/automations-tick/index.ts (+ check)
supabase/functions/sequence-tick/index.ts    (+ check)
```

## Comportamento default

- Toda clínica existente continua com tudo liberado (chave ausente = on).
- Super admin pode desligar individualmente sem migração de dados.
- Admin/owner da clínica **vê** o estado atual das features (read-only) na tela Equipe/Configurações? → Fora do escopo desta entrega; só super admin gerencia.
