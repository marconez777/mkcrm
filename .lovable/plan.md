## Objetivo

Adicionar automações de **lembrete de consulta** lendo a data/hora já armazenada no campo personalizado existente (ex.: `data_horario` na clínica ÓR — tipo `datetime`). Casos típicos:

1. **D-1**: 1 dia antes, segurar envio até ~15h (horário comercial).
2. **D-0**: no mesmo dia, 1 hora antes da consulta.

Reusa toda a infra de Automações que já existe (`automations`, `automation_runs`, cooldown, cron `automations-tick` a cada 5 min, action `send_template`). Só adiciona **1 novo tipo de gatilho**.

## Como a data é lida

O campo já existe no sistema de custom fields (`lead_custom_fields` + `leads.custom_fields jsonb`). Ex.: a clínica ÓR tem `data_horario` (datetime) e `enviar_dia` (date). Não precisa criar tabela nova nem migration.

O gatilho aceita qualquer custom field de tipo `date` ou `datetime` da clínica.

## Mudanças

### 1. Novo trigger `before_appointment` em `supabase/functions/automations-tick/index.ts`

`trigger_config`:
```text
{
  field_key: "data_horario",     // ex.: clínica ÓR
  offset_minutes: 1440,           // 1440 = 1 dia | 60 = 1h
  preferred_time: "15:00",        // opcional — só dispara após essa hora local
  tz: "America/Sao_Paulo",
  business_hours_only: true,      // opcional — seg–sex 08–18
  stage_id: null                  // opcional — filtra por etapa
}
```

Lógica:
- `appt` = `leads.custom_fields[field_key]` parseado como timestamptz
- `target = appt - offset_minutes`
- Dispara se `now >= target` **e** `now <= appt - 5min` (não envia depois da consulta começar)
- Se `preferred_time` setado: só dispara se hora local atual ≥ `preferred_time`
- Se `business_hours_only`: dia útil + entre 08:00–18:00 local
- Cooldown da automação previne duplicação
- Query inicial filtra `custom_fields ? field_key` e `(custom_fields->>field_key)::timestamptz` dentro de uma janela razoável

### 2. UI em `src/pages/Automations.tsx`

Adicionar à lista `TRIGGERS`:
- `{ id: "before_appointment", label: "Lembrete antes de data marcada (consulta)" }`

Form ao selecionar:
- **Campo de data** (select): lista `lead_custom_fields` onde `field_type IN ('date','datetime')`. Mostra `label` + `field_key`. Se vazio, aviso com link para Configurações → Campos personalizados.
- **Antecedência**: número + unidade (minutos/horas/dias) → grava `offset_minutes`.
- **Hora preferencial** (input `time`, opcional): dica "ideal para lembrete D-1 — segura o envio até esse horário."
- **Apenas horário comercial** (Switch, default off): seg–sex 08–18.
- **Etapa** (select, opcional).

Ação recomendada: `send_template` (já existe). Sem mudança.

Default sugerido de `cooldown_hours` ao criar este tipo: **23h** (evita duplicar D-1).

### 3. Sem mudanças no banco

Schema atual já suporta tudo. A automação grava o novo `trigger_type` como string no campo `trigger_type` (já é livre).

## Fluxo do usuário (exemplo ÓR)

1. Em **Mensagens → Templates**, criar 2 templates:
   - "Lembrete D-1": `Oi {{primeiro_nome}}! Lembrete: sua consulta é amanhã. Posso confirmar?`
   - "Lembrete 1h antes": `{{primeiro_nome}}, sua consulta começa em 1 hora.`
2. Em **Mensagens → Automações**, criar 2 automações:
   - **A — Lembrete D-1**
     - Gatilho: `before_appointment`, campo `data_horario`, antecedência **1 dia**, hora preferencial **15:00**, horário comercial **ON**
     - Etapa (opcional): "Consulta Agendada"
     - Ação: enviar template "Lembrete D-1"
     - Cooldown: 23h
   - **B — Lembrete 1h antes**
     - Gatilho: `before_appointment`, campo `data_horario`, antecedência **1 hora**
     - Ação: enviar template "Lembrete 1h antes"
     - Cooldown: 50min (`cooldown_hours = 1` arredondado ou suportar minutos — ver fora do escopo)

## Fora do escopo

- Suportar cooldown em minutos (hoje é só em horas — 1h serve para o caso B).
- Tabela própria de agendamentos / integração Google Calendar.
- Confirmação da consulta via resposta do lead (IA classifica).
- Cancelar lembrete automático se a data for limpa — já funciona, basta esvaziar o campo.

## Critérios de aceite

- Novo gatilho aparece no editor de automação.
- Select de campo só lista custom fields de tipo data/data-hora da clínica logada.
- Lead da ÓR com `data_horario = amanhã 10:00` + automação A: recebe a mensagem hoje a partir das 15:00 (não antes).
- Lead com `data_horario = hoje 16:00` + automação B: recebe a mensagem por volta de 15:00–15:05.
- Lead sem o campo preenchido nunca entra como candidato.
- Cooldown impede reenvio se o cron rodar duas vezes na janela.
