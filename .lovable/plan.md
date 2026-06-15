## Decisões confirmadas

1. Fuso fixo `America/Sao_Paulo` (sem nova coluna em `clinics`/`settings` por enquanto).
2. Backfill: rodar nos leads existentes com data possivelmente "shiftada" nas últimas 60 dias.
3. Corte de 5h para o lembrete de 1h: mantido.

## Implementação

### 1. `supabase/functions/_shared/dates.ts`
- Novo `parseFutureDateInTZ(raw, tz, now)` que interpreta strings ISO **sem offset** como wall-clock no `tz` (usa o truque `Intl.DateTimeFormat` para descobrir o offset correto na data, resolvendo DST). Strings com `Z` ou `±HH:MM` continuam sendo instante absoluto.
- `parseFutureDate` antigo passa a delegar para `parseFutureDateInTZ(raw, "UTC", now)` → comportamento idêntico para chamadas legadas.

### 2. `supabase/functions/extractor-tick/index.ts`
- Constante `CLINIC_TZ = "America/Sao_Paulo"`.
- `buildSystemPrompt`: adiciona bloco "FORMATO DE DATA" instruindo o modelo a devolver `AAAA-MM-DDTHH:mm` **sem `Z` e sem offset**, sempre em horário local da clínica.
- Trocar `parseFutureDate(...)` por `parseFutureDateInTZ(..., CLINIC_TZ)` em `applyFields` e `applyClinicFieldMapping`. Os `.toISOString()` continuam corretos porque o `Date` retornado já é o instante UTC certo.

### 3. `supabase/functions/automations-tick/index.ts`
- Adicionar helper local `ymdInTZ(date, tz)`.
- Buscar `updated_at` do lead na query do `before_appointment`.
- Após calcular `target` e antes de adicionar o lead em `out`:
  - `apptDay = ymdInTZ(appt, tz)`, `nowDay = ymdInTZ(now, tz)`, `bookedDay = ymdInTZ(updated_at, tz)`.
  - Se `bookedDay === apptDay` (o agendamento foi marcado no mesmo dia da consulta):
    - bloqueia qualquer offset ≥ 360 min (D-1/longo).
    - permite o lembrete só se faltam **mais de 5h** para a consulta.
- Quando bloqueado, registra `automation_runs` com `status='skipped', detail='same_day_short_notice'` (auditável).

### 4. Backfill (via tool de insert)
- SQL que, em `leads.custom_fields` com chaves `data_horario`, `consulta_agendada_em`, `procedimento_agendado_em`:
  - candidato = valor termina em `:00:00.000Z` (hora redonda em UTC, típico do parsing errado anterior) E foi modificado nos últimos 60 dias E ainda está no futuro.
  - ação: soma `+3 horas` no valor (ajustando para `America/Sao_Paulo`). Sem DST relevante hoje no Brasil, +3h é seguro.
  - registra `lead_events` `type='date_tz_backfill'` por lead afetado.
- Antes do UPDATE em massa, rodar um `SELECT` para mostrar contagem; se a contagem for absurdamente alta (>500), pausa e pergunta antes de aplicar.

## Validação
1. Reprocessar lead "Ps" com `force=true` → `data_horario` salvo como `…T21:00:00.000Z`, render no Inbox volta a 18:00.
2. Simular tick com lead `data_horario` para hoje +30min e `updated_at` de hoje → `automation_runs` registra `skipped/same_day_short_notice`.
3. Eval do extractor continua passando (chamadas existentes só ganharam interpretação TZ-aware).

Aguardando build mode para começar.