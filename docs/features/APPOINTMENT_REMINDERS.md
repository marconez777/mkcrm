# Lembretes de Consulta (Appointment Reminders)

> **Quando ler:** ao configurar lembretes automáticos antes de uma consulta
> agendada, ou ao debugar lembretes que não disparam / disparam errado.
> **Última atualização:** 2026-06-01

---

## 1. Visão geral

Lembretes de consulta **não são uma feature dedicada** — são implementados
em cima do motor genérico de **Automations** usando o trigger
`before_appointment`. Não há tabela específica de "reminders".

- Worker: `supabase/functions/automations-tick`
- Cron: a cada **5 minutos** (pg_cron)
- Fonte da data: `leads.custom_fields[field_key]` — **não** a tabela
  `appointments`
- Limite por tick: 200 leads candidatos por automation

Para o motor completo de Automations, ver
[`SEQUENCES_AUTOMATIONS.md`](./SEQUENCES_AUTOMATIONS.md) §2.

---

## 2. Pré-requisitos

Antes de criar a automation:

1. **Custom field datetime** no lead, ex.: `data_consulta`.
   - Criar em `/settings/custom-fields` com tipo `datetime`.
   - Valor precisa ser **ISO 8601 parseável** por `new Date()`:
     `2026-06-15T14:30:00-03:00` ✅
     `15/06/2026 14:30` ❌
2. **Template de mensagem** já criado em `/templates` (ou um agente de IA
   habilitado, se for usar `ai_followup`).
3. **Instância de WhatsApp** conectada ao lead (`leads.whatsapp_instance_id`).
4. (Opcional) **Stage** específico para filtrar quem recebe o lembrete
   (ex.: só "Agendado", não "Confirmado").

---

## 3. Como o trigger `before_appointment` funciona

Resumo da lógica em `automations-tick/index.ts`:

| Campo                  | Tipo     | Default              | Descrição                                                             |
|------------------------|----------|----------------------|-----------------------------------------------------------------------|
| `field_key`            | string   | **obrigatório**      | Nome do custom field datetime no lead.                                |
| `offset_minutes`       | number   | `60`                 | Quanto antes da consulta disparar (em minutos).                       |
| `tz`                   | string   | `America/Sao_Paulo`  | Timezone para `preferred_time` e `business_hours_only`.               |
| `preferred_time`       | `HH:MM`  | —                    | Hora local mínima para disparar (24h). Útil para lembrete D-1 às 09h. |
| `business_hours_only`  | boolean  | `false`              | Se `true`, só dispara seg-sex entre 08:00 e 17:59 no `tz`.            |
| `stage_id`             | uuid     | —                    | Restringe ao estágio.                                                 |

**Regra de disparo:** o lead entra na janela quando
`now ∈ [appt - offset_minutes, appt - 5min]`.
Os últimos 5 minutos antes da consulta são ignorados (tarde demais).

**Pegadinha do `preferred_time`:** quando definido, o `target`
(`appt - offset_minutes`) precisa cair no **mesmo dia local** do `now` no
`tz` configurado. Isso evita que o lembrete D-1 dispare na madrugada do
dia anterior.

**Cooldown:** controlado por `automations.cooldown_hours` —
`automation_runs` com `status='success'` no intervalo bloqueiam re-execução
para o mesmo lead.

---

## 4. Passo a passo na UI

1. Ir para `/ai/messages/automations`.
2. **Nova automation**.
3. Trigger: `before_appointment`.
4. Preencher `trigger_config`:
   - `field_key` = nome do seu custom field (ex.: `data_consulta`)
   - `offset_minutes` = quantos minutos antes (24h = `1440`, 2h = `120`)
   - `tz` = `America/Sao_Paulo`
   - opcionais: `preferred_time`, `business_hours_only`, `stage_id`
5. Ação: `send_template` (recomendado para lembretes) ou `ai_followup`
   (para mensagem personalizada via agente).
6. `cooldown_hours` = um pouco menor que o `offset_minutes/60` para evitar
   reenvio no mesmo dia.
7. Salvar e habilitar (`enabled = true`).

---

## 5. Exemplo completo: lembrete 24h + 2h antes

### Automation A — Lembrete D-1 às 09:00

```json
{
  "trigger_type": "before_appointment",
  "trigger_config": {
    "field_key": "data_consulta",
    "offset_minutes": 1440,
    "tz": "America/Sao_Paulo",
    "preferred_time": "09:00",
    "business_hours_only": true
  },
  "action_type": "send_template",
  "action_config": { "template_id": "<uuid do template 24h>" },
  "cooldown_hours": 20,
  "enabled": true
}
```

**Template sugerido (24h):**

```
Olá, {{primeiro_nome}}! Passando para lembrar da sua consulta amanhã.
Se precisar reagendar, é só responder por aqui. Até lá! 😊
```

### Automation B — Lembrete D-0, 2 horas antes

```json
{
  "trigger_type": "before_appointment",
  "trigger_config": {
    "field_key": "data_consulta",
    "offset_minutes": 120,
    "tz": "America/Sao_Paulo"
  },
  "action_type": "send_template",
  "action_config": { "template_id": "<uuid do template 2h>" },
  "cooldown_hours": 3,
  "enabled": true
}
```

**Template sugerido (2h):**

```
Oi, {{primeiro_nome}}! Sua consulta é daqui a pouco (em ~2 horas).
Nos vemos em breve! 💙
```

### Por que `cooldown_hours` diferente?

- A (24h antes): `cooldown=20` garante que mesmo se o lead aparecer várias
  vezes na varredura do cron (a cada 5 min), só recebe uma vez no dia.
- B (2h antes): `cooldown=3` é suficiente porque a janela de disparo dura
  no máximo `120 - 5 = 115` minutos.

---

## 6. Diferenças vs outras features

### vs Sequences

- Sequences suportam `stop_on_reply` — Automations **não**.
- Lembrete `before_appointment` dispara **mesmo se o lead já confirmou**.
- Workarounds:
  - Mover lead para estágio "Confirmado" e filtrar com `stage_id` no
    trigger_config (só dispara para quem ainda está em "Agendado").
  - Usar `ai_followup` com prompt que leia o histórico antes de mandar.

### vs `scheduled_messages` (`src/lib/scheduled-messages.ts`)

| `scheduled_messages`                       | `before_appointment` automation             |
|--------------------------------------------|---------------------------------------------|
| Mensagem **única**, manual                 | Regra **recorrente** por lead               |
| Agendada pelo atendente no Inbox           | Configurada pelo admin                      |
| Datetime absoluto                          | Relativo à data da consulta do lead         |
| Tabela: `scheduled_messages`               | Tabela: `automations` + `automation_runs`   |

### vs tabela `appointments`

A tabela `appointments` existe e é referenciada em
[`LEAD_LIFECYCLE.md`](../flows/LEAD_LIFECYCLE.md), mas o trigger
`before_appointment` **não a consulta**. Sempre lê de
`leads.custom_fields[field_key]`.

Se a data de origem vier para `appointments.scheduled_at`, sincronizar
manualmente (trigger DB ou no ponto de criação) para
`leads.custom_fields.data_consulta`.

---

## 7. Reagendamento

Quando o `custom_fields[field_key]` do lead é atualizado para uma **nova data**,
a automation considera isso como reagendamento e **dispara o lembrete de novo**,
mesmo que já tenha enviado para a data anterior.

### Como funciona

Cada `automation_run` grava em `appointment_at` a data da consulta usada no
disparo. No tick seguinte, em vez de checar só o cooldown, o worker compara:

- Última `appointment_at` registrada **=** data atual do lead → cooldown clássico
  (não reenvia).
- Última `appointment_at` registrada **≠** data atual do lead → reagendou,
  ignora cooldown e dispara na próxima janela válida.
- Sem run anterior → dispara normalmente.

### Implicações

- Reagendar A → B → C dentro do mesmo dia pode gerar até 3 mensagens
  (uma por nova data). Esperado.
- Runs antigos (anteriores à coluna `appointment_at`) sem data gravada caem
  no cooldown clássico para evitar broadcast retroativo.
- Cancelar (limpar o custom field) impede novos disparos, mas não cancela
  mensagens já enviadas.

---

## 8. Troubleshooting

| Sintoma                                    | Causa provável / fix                                                                 |
|--------------------------------------------|--------------------------------------------------------------------------------------|
| Lembrete não dispara                       | `custom_fields[field_key]` não é ISO; `tz` errado; já passou de `appt-5min`; lead arquivado (`archived_at` set); cooldown ainda ativo. |
| Dispara na madrugada                       | Faltou `preferred_time` (lembrete D-1) ou `business_hours_only`.                     |
| Dispara duas vezes no mesmo dia            | `cooldown_hours` muito baixo **ou** lead foi reagendado (esperado — ver §7).         |
| Lead reagendou e não recebeu lembrete novo | Run antigo sem `appointment_at`; só vale para runs gravados após a migração.         |
| Dispara só para alguns leads               | Mais de 200 candidatos no tick — outros entram no próximo. Considerar `stage_id`.    |
| Lead que já confirmou ainda recebe         | Filtrar `stage_id` no trigger; mover confirmados para outro estágio.                 |
| `preferred_time` ignorado                  | Formato precisa ser `HH:MM` 24h (ex.: `09:00`, não `9:00 AM`).                       |
| `send_template` falha silenciosamente      | Conferir `automation_runs.detail`; template deletado ou sem `content`.               |
| `ai_followup` retorna 429                  | `spend-guard` bloqueou — ver `docs/architecture/FEATURE_FLAGS.md`.                   |

Para inspecionar runs:

```sql
select created_at, status, appointment_at, detail
from automation_runs
where automation_id = '<id>'
order by created_at desc
limit 50;
```

---

## 8. Links

- Motor de Automations: [`SEQUENCES_AUTOMATIONS.md`](./SEQUENCES_AUTOMATIONS.md) §2
- Lifecycle do lead: [`../flows/LEAD_LIFECYCLE.md`](../flows/LEAD_LIFECYCLE.md)
- Worker: `supabase/functions/automations-tick/index.ts`
- Mensagens agendadas manualmente: `src/lib/scheduled-messages.ts`
- Custom fields: [`SETTINGS_CUSTOM_FIELDS`](../frontend/PAGES.md)
