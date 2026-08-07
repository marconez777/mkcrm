---
title: "Playbook — Adicionar uma regra de automação"
topic: kanban
kind: howto
audience: agent
updated: 2026-08-07
summary: "Checklist para criar uma regra auto:*. O passo do toggle é obrigatório — G3 é fail-closed e regra sem toggle seedado nasce morta."
related_docs:
  - docs/pipeline/runtime/_registry/triggers.md
  - docs/pipeline/runtime/_registry/toggles.md
---

# Playbook — Adicionar regra de automação

> **Por que existe este playbook.** Hoje há **4 `ruleKey` em código sem toggle seedado**
> (`classifier.stage_move`, `monthly_sweep_paciente_antigo`, `or_monthly_cycle`,
> `paciente_antigo_canonical`). Cada um é uma regra que roda, bate no G3 e retorna
> `gate_g3_disabled` — sem erro, sem alerta, sem ninguém perceber.

## Checklist

### 1. Escolher `source`
Prefixo define a política de gates em `pipelineMove`:

| Prefixo | Gates aplicados |
|---|---|
| `auto:*` | **todos** (G3, allowlist, G2, D3) |
| `reator:*` · `system:*` · `manual` · `ui` | pulam G3, allowlist, G2 e D3 |

Regra automática usa `auto:` — sempre. Use os outros só para ação humana ou de sistema.

### 2. ⚠️ Seedar o toggle na MESMA migration
```sql
INSERT INTO public.app_settings (key, value)
VALUES ('automation.<minha_regra>.enabled', 'false')
ON CONFLICT (key) DO NOTHING;
```

Nasce `'false'`: ligue conscientemente depois de validar. O G3 compara com a string `'true'`:

```ts
if (!setting || String(setting.value).toLowerCase() !== "true")
  return { moved: false, reason: `gate_g3_disabled:${ruleKey}` };
```

**Chave ausente é indistinguível de desligada.** Não existe "default gracioso".

### 3. Definir a idempotência
`idempotencyKey` combina entidade + estado. Grava um `pipeline_move_attempted`; repetição vira
`idempotent:<key>`.

| Cadência | Padrão | Exemplo |
|---|---|---|
| Uma vez por entidade | `{regra}:{id}` | `ciclo:{lead}` |
| Uma vez por estado | `{regra}:{id}:{estado}` | `appt:{id}:agendado` |
| Uma vez por dia | `{regra}:{lead}:{YYYY-MM-DD}` | `inactivity:{lead}:7d:2026-08-07` |
| Uma vez por mês | `{regra}:{lead}:{YYYY-MM}` | `monthly-sweep:{lead}:2026-08` |

Cron **sempre** leva data na chave — senão roda uma vez e nunca mais.

### 4. Chamar o `pipelineMove`
```ts
const res = await pipelineMove(client, {
  leadId, toStageId,
  source: "auto:minha-regra",
  reason: "texto de auditoria legível",
  ruleKey: "automation.minha_regra.enabled",
  idempotencyKey: `minha-regra:${leadId}:${estado}`,
  metadata: { /* contexto */ },
});
```

Nunca escreva `leads.stage_id` direto. Omitir `ruleKey` pula o G3 — só faça isso com decisão
explícita e documentada (hoje o único caso é o `general` move do classifier, e é um problema
conhecido, não um exemplo a seguir).

### 5. Logar o resultado
`logEvent(client, clinicId, leadId, "auto:minha-regra", { res })` — sem isso a regra é
invisível na timeline e no debug.

### 6. Agendar, se for cron
⚠️ Nenhum cron de pipeline está versionado em migration. Ao criar via
`cron.schedule`, **registre em `_registry/triggers.md`** — senão ninguém sabe que existe.

### 7. Atualizar os registries
| Arquivo | O quê |
|---|---|
| `_registry/triggers.md` | linha nova: gatilho, de→para, source, toggle, idempotência |
| `_registry/toggles.md` | linha nova na tabela "seedados e em uso" |
| `_registry/events.md` | se emitir um `lead_events.type` novo |

### 8. Verificar
```bash
node scripts/docs-verify.mjs
```
```sql
SELECT key, value FROM app_settings WHERE key = 'automation.<minha_regra>.enabled';
```

## Teste de fumaça

```bash
curl -X POST "$SUPABASE_URL/functions/v1/pipeline-deterministic" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"action":"minha-regra","lead_id":"<uuid>"}'
```

Leia o `reason` antes de comemorar: `gate_g3_disabled` (passo 2), `clinic_not_allowlisted`
(clínica fora de `pipeline_automation_allowlist`), `stage_not_found` (ver
[`add-stage.md`](./add-stage.md)), `idempotent:` (esperado na 2ª chamada).
