## Objetivo

Quando uma consulta for reagendada, a automação `before_appointment` deve disparar novamente para a nova data, mesmo que já tenha enviado lembrete para a data anterior. Hoje o `cooldown_hours` bloqueia o reenvio.

## Abordagem

Rastrear **qual data de consulta** foi usada em cada `automation_run`. Se a data atual do lead for diferente da data do último run de sucesso, ignorar o cooldown.

## Mudanças

### 1. Banco — `automation_runs`
Adicionar coluna `appointment_at timestamptz` (nullable, para não quebrar runs antigos e runs de triggers que não usam data).

### 2. Worker — `supabase/functions/automations-tick/index.ts`

**Trigger `before_appointment`:**
- Ao gravar `automation_runs` (success/skipped/failed), incluir `appointment_at` com a data da consulta usada no cálculo.
- Substituir a checagem atual `recentlyRan()` por uma lógica nova só para esse trigger:
  - Buscar último run com `status='success'` para `(automation_id, lead_id)`.
  - Se `appointment_at` do último run **for igual** à data atual do lead → aplicar cooldown normal (bloqueia reenvio).
  - Se `appointment_at` **for diferente** (reagendou) → ignorar cooldown e permitir disparo.
  - Se não houver run anterior → disparar normalmente.
- Para outros triggers (`on_stage_enter`, `no_reply_after`, etc.) → comportamento atual inalterado.

### 3. Documentação
Atualizar `docs/features/APPOINTMENT_REMINDERS.md`:
- Nova seção "Reagendamento" explicando o comportamento.
- Tabela de troubleshooting: adicionar linha "Lead reagendou e não recebeu lembrete novo".

## Comportamento resultante

| Cenário | Antes | Depois |
|---|---|---|
| Reagendou para mesmo dia/hora | Bloqueado por cooldown ✅ | Bloqueado por cooldown ✅ |
| Reagendou para nova data (qualquer) | Bloqueado por cooldown ❌ | **Reenvia na janela da nova data** ✅ |
| Sem reagendamento | Cooldown normal | Cooldown normal |

## Edge cases tratados

- **Reagendamento múltiplo no mesmo dia:** se o lead reagendar A→B→C, cada mudança gera novo envio quando entrar na janela. Pode gerar 2-3 mensagens — aceitável (usuário escolheu "sempre reenviar quando a data mudar").
- **Runs antigos sem `appointment_at`:** tratados como "data desconhecida" → cooldown clássico aplicado (não reenvia), para não fazer broadcast retroativo.
- **Runs com status `failed`/`skipped`:** continuam não bloqueando reenvio (igual hoje).

## Arquivos afetados

- `supabase/functions/automations-tick/index.ts` (lógica de checagem + insert de runs)
- Migração SQL: `ALTER TABLE automation_runs ADD COLUMN appointment_at timestamptz`
- `docs/features/APPOINTMENT_REMINDERS.md` (documentação)

## Não incluído

- Mensagem de "seu horário foi alterado" (você escolheu apenas reenviar o lembrete).
- Mudanças em outros triggers.
- UI nova — tudo automático.
