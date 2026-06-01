## Causa raiz

As duas automations de lembrete (`Lembrete — 1 dia antes` e `Lembrete — 1 hora antes`) estão com `cooldown_hours = 0`. No worker `automations-tick`:

- `recentlyRan` faz `created_at >= now() - 0h` → nunca acha run anterior.
- `shouldSkipForAppointment` usa a mesma janela `now - 0h` → também nunca acha.

Resultado: a cada tick do cron (5 em 5 min), enquanto o lead estiver dentro da janela `[appt - offset, appt - 5min]`, dispara de novo. Confirmado nos `automation_runs`: lead `48b7c1c0…` recebeu **5 disparos em 20 minutos** para a mesma consulta de 02/06 13:00.

Os lembretes hoje estão `enabled = false` (devem ter sido desligados depois do incidente), mas o bug volta no momento que reativarem.

## Correção

### 1. Worker `supabase/functions/automations-tick/index.ts`
Endurecer para nunca aceitar cooldown 0/negativo em `before_appointment`. Aplicar um piso seguro derivado do `offset_minutes`:

```ts
const effectiveCooldownH = Math.max(
  a.cooldown_hours ?? 0,
  Math.ceil((Number(a.trigger_config?.offset_minutes ?? 60) / 60) * 1.5),
);
```

Usar `effectiveCooldownH` em `shouldSkipForAppointment` e `recentlyRan`. Isso garante:
- Lembrete 1h antes (offset 60) → cooldown mínimo 2h.
- Lembrete 24h antes (offset 1440) → cooldown mínimo 36h.

A lógica de reagendamento (comparar `appointment_at` do último run com a data atual do lead) continua funcionando — se o paciente reagendar, dispara de novo mesmo dentro do cooldown.

### 2. Migration de dados
Corrigir as duas automations existentes para valores sãos:

```sql
UPDATE automations SET cooldown_hours = 20  WHERE id = '65e28148-c2eb-439f-ae3d-694f9acda28e'; -- 1 dia antes
UPDATE automations SET cooldown_hours = 3   WHERE id = 'c3111dc7-30de-4d5e-92d6-e8f557423b60'; -- 1 hora antes
```

Valores baseados no que `docs/features/APPOINTMENT_REMINDERS.md` recomenda.

### 3. UI `src/pages/Automations.tsx` (defensivo)
No form de criação/edição de automation, quando `trigger_type = before_appointment`, validar `cooldown_hours >= 1` e mostrar hint:
> "Defina um cooldown maior que a janela de disparo (recomendado: ~`offset_minutes/60 * 1.5`h) para não enviar o mesmo lembrete várias vezes."

## Fora de escopo
- Mudar o intervalo do cron.
- Refatorar o modelo de fila para idempotência forte (overkill aqui — o piso de cooldown resolve).
- Reativar as automations (o usuário decide quando).
