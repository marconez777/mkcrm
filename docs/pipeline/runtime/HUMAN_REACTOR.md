---
title: "Reator humano e lock manual — runtime"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Comportamento do lock manual (manual_lock_until = 7d quando humano move card no Kanban), botão Destravar no LockManualChip, e ruleHumanReactorTick (cron diário cria task para leads com tag precisa_atencao_humana parados 7d)."
code_refs:
  - src/lib/manual-stage-move.ts
  - src/pages/Kanban.tsx
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
related_docs:
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
---

# Reator humano + lock manual

## Lock manual (G1)

Quando humano move um card no Kanban (`src/pages/Kanban.tsx`) ou via dialog, o move grava:

```sql
UPDATE leads SET
  stage_id = <novo>,
  manual_lock_until = now() + interval '7 days',
  position = <pos>,
  -- se destino for stage "não qualificado":
  custom_fields = custom_fields || {qualificacao:'desqualificado', motivo_desqualificacao:'outro'}
WHERE id = <leadId>;
```

`manualLockUntilIso()` está em `src/lib/manual-stage-move.ts:13`:

```ts
export const MANUAL_LOCK_MS = 7 * 24 * 60 * 60 * 1000;
export function manualLockUntilIso(): string {
  return new Date(Date.now() + MANUAL_LOCK_MS).toISOString();
}
```

O helper `pipelineMove()` aplica gate **G1**: para qualquer `source LIKE 'auto:%'`, se `manual_lock_until > now()`, retorna `{moved:false, reason:'gate_g1_manual_lock_until:<iso>'}`. Lock NÃO bloqueia tags, custom_fields ou summary — só moves automáticos.

### Exceção D3-ciclo

A regra `auto:ciclo-concluido` (quando humano marca `ciclo_concluido=true`) move o lead para "Paciente antigo" **e** estende o lock para **90 dias** (`now()+90d`), efetivamente congelando.

## Chip "Lock manual" no Kanban

Componente `LockManualChip` em `src/pages/Kanban.tsx:315` aparece em todo card cujo `manual_lock_until > now()`. Behavior:

- Render padrão: chip cinza "Lock manual" + ícone.
- Hover: muda para "Destravar" + ícone unlock.
- Click: abre `AlertDialog` "Remover lock manual?" com data de expiração.
- Confirma → chama `unlockLeadManually(supabase, leadId)`.

### `unlockLeadManually` (src/lib/manual-stage-move.ts:21-51)

```ts
1. SELECT manual_lock_until, clinic_id FROM leads WHERE id=<leadId>;
2. UPDATE leads SET manual_lock_until = NULL WHERE id=<leadId>;
3. INSERT INTO lead_events (type='manual:unlock', payload={
     previous_lock_until, by_user_id: auth.user.id
   });  // best-effort, try/catch
```

Realtime na tabela `leads` faz o chip sumir do Kanban automaticamente.

## Auto-desqualificação em moves manuais

`customFieldsPatchForStage()` (linhas 67–83): se o destino é um stage cujo nome contém "nao qualificado" (normalizado sem acentos), o move manual também aplica:

```jsonc
{
  qualificacao: "desqualificado",
  motivo_desqualificacao: "outro"   // só se não já existir
}
```

Isso garante que o trigger `I6` (motivo obrigatório quando desqualificado) não rejeite o UPDATE.

> Nota: hoje **nenhum stage** da Clínica ÓR tem nome contendo "nao qualificado" — o stage de descarte é "Desqualificado / Fora de escopo". A função existe para outras clínicas; aqui ela retorna `undefined`.

## Reator humano (D7) — ação automática

`ruleHumanReactorTick` em `pipeline-deterministic/index.ts:546-580`.

| | |
|---|---|
| Cron | `pipeline-human-reactor-tick` — `0 8 * * *` UTC = 05:00 BRT |
| Toggle | `automation.human_reactor.enabled` = true |
| Critério | `tags @> ARRAY['precisa_atencao_humana']` AND `updated_at < now()-7d` AND `archived_at IS NULL` |
| Limit | 500 leads/tick |
| Idempotência | só cria task se não existe `lead_tasks` aberta com prefixo `Revisar lead travado%` |
| Ação | INSERT `lead_tasks {title:'Revisar lead travado (D7)', due_at: now()+24h}` + event `auto:human-reactor` |

> O nome "reator humano" no plano original (D7) previa um reator de **ação** humana — algo que respondesse imediatamente após o humano editar/mover. **A implementação atual é mais simples**: é apenas um cron diário que vira `precisa_atencao_humana` em tasks. Não há reator síncrono que infira "humano fez X → IA faz Y".

## Quem aplica `precisa_atencao_humana`

| Origem | Quando |
|---|---|
| Classifier (`pipeline-classify`) | `confidence < 0.6` |
| A1 (`pipeline-position-auditor`) | discordância c/ `conf ≥ 0.75` |
| A2 (`pipeline-post-move-verifier`) | verdict='nao' c/ `conf ≥ 0.8` |
| `auto:followup-7d` (move p/ Nutrição inativa) | sempre, em moves bem-sucedidos |
| `auto:judicializacao` | sempre |
| Manual (humano) | via UI |

## Quem remove `precisa_atencao_humana`

**Ninguém automaticamente**. Está na `PROTECTED_TAGS` do classifier — `tags_remove` não pode descartá-la. Só humano via UI.
