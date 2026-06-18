---
title: "Classifier LLM (pipeline-classify) — runtime V2"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Edge function pipeline-classify V2: arquitetura modular (context → agent-core → date-parser → apply), 1 chamada gpt-5-mini, schema enxuto, parser de datas determinístico, strict no-move (exceto B2B com guards rígidos), G10 implementado via trigger PG + RPC apply_lead_automation_patch."
code_refs:
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-classify/index.v1.ts
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/functions/pipeline-classify/context.ts
  - supabase/functions/pipeline-classify/agent-core.ts
  - supabase/functions/pipeline-classify/date-parser.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-classify/rules/first-consult.ts
  - supabase/functions/pipeline-classify/rules/intent-effects.ts
  - supabase/functions/_shared/dates.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-fase4.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-summarize-core.ts
related_docs:
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/pipeline/runtime/DATABASE_LIVE.md
---

# Classifier `pipeline-classify` — V2

> Reconstrução multi-step (junho/2026). Substitui o monolito V1 de 696 linhas por
> uma estrutura modular focada em **strict no-move**: o classificador **NÃO move
> cards** (exceto B2B com guards rígidos). Os agendamentos passam a ser
> autoridade de webhooks deterministas (SumUp + appointment-extractor — Fase 2).

## Resumo

| | |
|---|---|
| Entry | `supabase/functions/pipeline-classify/index.ts` (dispatcher v1/v2) |
| Fallback V1 | `supabase/functions/pipeline-classify/index.v1.ts` (intacto, sem `Deno.serve`) |
| Modelo | `gpt-5-mini` (1 chamada por classificação) |
| Cron | `pipeline-classify-tick` — `* * * * *` |
| Toggle global | `automation.classifier.enabled` |
| Toggle versão | `automation.classifier.version` (`'v1'` default; `'v2'` rollout) |
| Override de teste | body `{ "force_version": "v2" }` na invocação manual |
| Batch | 50 leads/tick |
| Watermark | `leads.last_processed_message_id_classifier` |
| Telemetria | `lead_events.type='auto:classifier'` com `payload.version=2` |

## Arquivos

```text
pipeline-classify/
├── index.ts             dispatcher (lê automation.classifier.version) + cron tick
├── index.v1.ts          handler V1 antigo, exporta handleV1(req)
├── schema.ts            Zod único + canon names, intents, tags protegidas, G10_WINDOW_MS
├── context.ts           loadLeadContext: lê lead + ai_summary + watermark; early-return
├── agent-core.ts        1 chamada gpt-5-mini com prompt enxuto + tool A3 opcional
├── date-parser.ts       wrapper sobre parseFutureDateInTZ (ZERO LLM)
├── apply.ts             ordem de aplicação: first-consult → datas (G10) → fields (G10) → tags (whitelist) → strict-no-move (exceto B2B) → intent-effects → summarizer → telemetria → watermark
├── rules/first-consult.ts   regra "1ª consulta" com fallback no ai_summary
├── rules/intent-effects.ts  wrapper sobre runNfTask / runPaymentAlleged / runJudicializacao / runRenovacaoReceita / runObjectionSuggest
├── date-parser_test.ts      4 testes Deno
└── first-consult_test.ts    5 testes Deno
```

## Schema do agente (`schema.ts`)

```ts
z.object({
  mentioned_dates: z.array(z.object({
    raw: z.string().max(120),       // string crua, NÃO ISO
    anchor_iso: z.string(),         // timestamp da mensagem que cita
    kind: z.enum(["consulta","procedimento"])
  })).max(4),
  mentioned_intents: z.array(z.enum(INTENT_VALUES)).max(3),
  stage_suggestion: z.enum(CANON_NAMES),
  intent: z.enum(INTENT_VALUES).default("outro"),
  confidence: z.number().min(0).max(1),
  is_b2b: z.boolean(),
  tags_suggested: z.array(z.string().max(40)).max(8),
  custom_fields_patch: z.record(z.string(), z.union([z.string(),z.number(),z.boolean(),z.null()])),
  reasons: z.array(z.string()).min(1).max(5)
})
```

> **`tags_remove` removido do LLM** (V2). O `apply.ts` computa removeções como
> `currentTags − tags_suggested − PROTECTED_TAGS` (quando `tag_replace.enabled`),
> além de forçar a remoção de "1ª consulta" quando a regra bloqueia.

## Datas — extração + parser determinístico

O LLM **NUNCA converte data**. Devolve apenas a string crua + o timestamp ISO da
mensagem que cita (`anchor_iso`). O `date-parser.ts` chama
`parseFutureDateInTZ(raw, "America/Sao_Paulo", anchor)` e gera:

- `resolved`: ISO UTC quando determinístico.
- `rejected_reason`: `"anchor_invalid" | "ambiguous_or_past" | "too_far_future"`.

Cobre DST, DD/MM, DD/MM/AAAA, ISO. Datas resolvidas viram `consulta_agendada_em` ou
`procedimento_agendado_em` (mapeado por `kind`).

## Gate G10 — implementado via DB

Estado V1: G10 era apenas mitigação por prompt. V2:

1. **Migration `20260618...g10_human_edits.sql`** adiciona
   `leads.custom_fields_last_human_edit jsonb DEFAULT '{}'`.
2. **Trigger PG `track_custom_fields_human_edits`** dispara BEFORE UPDATE OF
   `custom_fields`. Para cada chave alterada, grava `{key: now_iso}` no jsonb,
   **exceto** quando `current_setting('app.actor') = 'system'`.
3. **RPC `apply_lead_automation_patch(p_lead_id, p_custom_fields, p_tags)`**
   (SECURITY DEFINER) seta `app.actor='system'` dentro da transação e aplica o
   UPDATE. O classifier V2 sempre usa essa RPC para persistir mudanças.
4. **`apply.ts`** lê `lead.custom_fields_last_human_edit[key]`; se o timestamp
   for mais novo que `now − 7d`, descarta a sugestão da IA para essa chave e
   registra em `applied.custom_fields.blocked_by_g10`.

> Edições humanas via PostgREST (frontend, inbox, lead drawer) **não setam**
> `app.actor` → o trigger as marca corretamente como humanas. Outras edge
> functions automáticas (pipeline-deterministic, fase4, pipeline-move) que
> escrevem em `custom_fields` ainda **não** usam a RPC → seus writes também
> serão marcados como "humanos", o que na prática faz o classifier respeitar
> regras determinísticas (comportamento desejável). Ver KNOWN_ISSUES.

## Strict no-move

Caminho **genérico** (`stage_suggestion ≠ current`): **NUNCA move**. Registra em
`applied.stage_suggestion_only` com `reason: "strict_no_move"`. Os cards ficam
estacionados na coluna atual até a Fase 2 (webhook SumUp +
`appointment-extractor`).

Caminho **B2B** (único move automático): exige **TODOS** os guards:

- `is_b2b === true`
- `confidence ≥ 0.95`
- `tags_suggested.includes("b2b")`
- Lead **nunca** passou por `Em tratamento | Consulta finalizada | Paciente antigo`
- `automation.b2b_move.enabled = true`

Falha em qualquer guard → `reason: "b2b_guard_failed:<...>"` em telemetria.

## Regra "1ª consulta"

`rules/first-consult.ts::evaluateFirstConsult` bloqueia a tag quando:

- Lead com mais de 90 dias, OU
- Passou por stage tratado, OU
- Tem tag `paciente_antigo`, OU
- `ai_summary` cita atendimento prévio (regex: `já realizou | paciente antig | retorno | tratamento anterior | sessão anterior | já atend | alta médica | alta do tratamento`).

Se bloqueada e a tag está presente, `apply.ts` força `removeComputed += ["1ª consulta"]`.

## Side-effects por intent

Inalterados em relação a V1. `rules/intent-effects.ts` chama:

| intent | função |
|---|---|
| `nf_reembolso` | `runNfTask` |
| `pagamento_alegado` | `runPaymentAlleged` |
| `judicializacao` | `runJudicializacao` |
| `renovacao_receita` | `runRenovacaoReceita` |
| `objecao` | `runObjectionSuggest` |

## Summarizer

Inalterado: `runSummarize(leadId, { force: intent !== 'outro' })`.

## Dispatcher (`index.ts`)

```ts
// 1. Lê body uma vez (clona request)
// 2. Se body.force_version === 'v2' OU 'v1' → usa esse (override de teste)
// 3. Senão lê app_settings 'automation.classifier.version' (default 'v1')
// 4. Roteia para handleV2(req) ou handleV1(req)
```

Cron `pipeline-classify-tick` continua chamando `action:'tick'` a cada minuto.

## Smoke test (V2)

```bash
# Tick V2 forçado:
curl -X POST <function_url>/pipeline-classify \
  -d '{"action":"tick","force_version":"v2"}'

# Lead específico V2:
curl -X POST <function_url>/pipeline-classify \
  -d '{"action":"lead","lead_id":"<uuid>","force_version":"v2"}'
```

## Rollout

1. Migration aplicada → trigger G10 ativo.
2. Função deployada com `version` flag default `'v1'`.
3. Smoke V2 em N leads via `force_version:'v2'`.
4. Validar `payload.version=2` em `lead_events`.
5. `UPDATE app_settings SET value='"v2"' WHERE key='automation.classifier.version'`.
6. Após 24h estáveis, deletar `index.v1.ts` em PR separado.

## Rollback

```sql
UPDATE app_settings SET value='"v1"' WHERE key='automation.classifier.version';
-- ou: DELETE FROM app_settings WHERE key='automation.classifier.version';
```

Próximo tick volta a V1 imediatamente.
