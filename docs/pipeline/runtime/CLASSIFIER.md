---
title: "Classifier LLM (pipeline-classify) — runtime V6 (5 Agentes)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-23
summary: "Edge function pipeline-classify V6: Linha de montagem de 5 agentes (Resumidor → [Agendador ∥ Tipificador ∥ Movimentador] → Maestro). Provider default = Lovable AI Gateway (Gemini 2.5 Flash / Flash-Lite); OpenAI BYOK (gpt-4o, gpt-5-*) é fallback de rollback via CLASSIFIER_PROVIDER=openai. Parser de datas determinístico, General Move com fallback, lock em Paciente antigo, G10 via trigger PG + RPC apply_lead_automation_patch. Telemetria individual por agente em ai_usage + lead_events.payload.agents."

code_refs:
  - supabase/functions/pipeline-classify/index.ts
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

# Classifier `pipeline-classify` — V6 (5 Agentes)

> Reconstrução multi-step (junho/2026). Substitui o monolito V2 e a linha de 3 agentes (V5) por uma **Linha de Montagem de 5 Agentes** com fase paralela no meio:
>
> ```text
>          Resumidor (gpt-4o, fallback gpt-5-mini)
>                       │
>                       ▼
>   ┌──────────────────────────────────────────────────────┐
>   │  Agendador  ∥  Tipificador  ∥  Movimentador          │
>   │  (gpt-5-mini)   (gpt-5-mini)   (gpt-5-mini)          │
>   │  Promise.all — 3 chamadas concorrentes               │
>   └──────────────────────────────────────────────────────┘
>                       │
>                       ▼
>                Maestro (gpt-5)
>           decide intent + stage + confiança
> ```
>
> O Maestro recebe os 3 outputs paralelos + o resumo e emite o veredicto final.
> O classifier possui **General Move** (auto-move) ativado para cenários de alta
> confiança, faz override de G10 para datas extraídas do chat e suporta uma
> whitelist de tags expandida.

## Resumo

| | |
|---|---|
| Entry | `supabase/functions/pipeline-classify/index.ts` |
| Modelos | `gpt-4o` (Resumidor) + `gpt-5-nano` (Agendador) + `gpt-5-mini` (Tipificador) + `gpt-5-nano` (Movimentador), os 3 paralelos + `gpt-5` (Maestro). **PR11.9**: Agendador/Movimentador rebaixados de mini→nano (schemas triviais; ~5× mais barato; latência igual ou melhor). |
| Chamadas LLM por execução | até **5** (3 fases: serial → paralela → serial) |
| Cron | `pipeline-classify-tick` — `* * * * *` |
| Toggle global | `automation.classifier.enabled` |
| Toggle versão | `automation.classifier.version` (`'v1'` default; `'v2'` rollout — `'v2'` hoje serve o motor V6) |
| Override de teste | body `{ "force_version": "v2" }` na invocação manual |
| `only_agent` (smoke) | aceita `"summarizer" \| "typifier" \| "maestro"` em `index.ts:188` (modos `agendador`/`movimentador`/`parallel` **ainda não implementados** — TODO se a UI `/pipeline-runs` precisar) |
| Batch | 50 leads/tick |
| Watermark | `leads.last_processed_message_id_classifier` |
| Telemetria | `lead_events.type='auto:classifier'` com `payload.version=3` (envelope V6) — ver `EVENTS_TELEMETRY.md` |
| Operations em `ai_usage` | `classifier:summarizer`, `classifier:agendador`, `classifier:typifier`, `classifier:movimentador`, `classifier:maestro` (1 row por agente por execução) |

## Arquivos

```text
pipeline-classify/
├── index.ts             dispatcher v1/v2 + cron tick + smoke only_agent
├── schema.ts            Zod schemas dos 5 Agentes + canon names, intents, tags protegidas
├── context.ts           loadLeadContext: lê lead + ai_summary + watermark; early-return
├── agent-core.ts        Orquestra a linha de montagem (runSummarizer → Promise.all([runAgendador, runTypifier, runMovimentador]) → runMaestro)
├── date-parser.ts       wrapper sobre parseFutureDateInTZ (ZERO LLM)
├── apply.ts             ordem: first-consult → datas (G10) → fields (G10) → tags (whitelist) → B2B/General Move → intent-effects → telemetria → watermark
├── rules/first-consult.ts   regra "1ª consulta" com fallback no ai_summary
├── rules/intent-effects.ts  wrapper sobre runNfTask / runPaymentAlleged / runJudicializacao / runRenovacaoReceita / runObjectionSuggest
├── date-parser_test.ts      4 testes Deno
└── first-consult_test.ts    5 testes Deno
```

## Schemas dos Agentes (`schema.ts`)

A saída é dividida em 5 partes, refletindo os 5 Agentes:

**Agente 1 — Resumidor** (`gpt-4o`, fallback `gpt-5-mini`)
```ts
z.object({
  summary: z.string(),
  mentioned_dates: z.array(z.object({
    raw: z.string().max(120),       // string crua, NÃO ISO
    anchor_iso: z.string(),         // timestamp da mensagem que cita
    kind: z.string()                // "consulta" | "procedimento"
  })).max(4)
})
```

**Agente 2a — Agendador** (`gpt-5-nano`, paralelo)
- Foca em sinais de agendamento/reagendamento: extrai candidatos a `consulta_agendada_em` / `procedimento_agendado_em` em formato cru + intent de agendamento.

**Agente 2b — Tipificador** (`gpt-5-mini`, paralelo)
```ts
z.object({
  tags_suggested: z.array(z.string().max(40)).max(8),
  // Relaxado p/ z.any() (PR11.9): gpt-5-mini estourava o union antigo
  // (string|number|boolean|string[]|null). Validação por chave acontece
  // em apply.ts::tryApplyField contra clinicFieldSchema.
  custom_fields_patch: z.record(z.string(), z.any()).default({})
})
```

**Agente 2c — Movimentador** (`gpt-5-nano`, paralelo)
- Avalia, com base no resumo, se há sinal suficiente para sugerir mudança de stage e qual stage canônico seria o destino.


**Agente 3 — Maestro** (`gpt-5`)
```ts
z.object({
  stage_suggestion: z.string(),                    // coercido p/ Canon (fallback "Qualificação")
  intent: z.string().default("outro"),             // coercido p/ INTENT_VALUES
  confidence: z.number().min(0).max(1),
  is_b2b: z.boolean(),
  reasons: z.array(z.string()).min(1).max(5),
  mentioned_intents: z.array(z.string()).max(3)
})
```

O Maestro recebe `summary + outAgendador + outTipificador + outMovimentador` e emite o veredicto final resolvendo inconsistências entre os paralelos. `mergeV6Outputs(summarizerOut, maestroOut)` no `agent-core.ts:414` combina tudo no `ClassificationV2` consumido por `apply.ts`.

> **Enums relaxados (junho/2026)**: `gpt-5-mini` rejeitava o schema quando enums
> eram declarados diretamente (`"No object generated: response did not match schema"`).
> Solução: declarar como `z.string()` e normalizar em `normalizeClassification()` —
> stages/intents inválidos caem para defaults (`"Qualificação"` / `"outro"`).
>
> **`tags_remove` removido do LLM**. O `apply.ts` computa removeções como
> `currentTags − tags_suggested − PROTECTED_TAGS` (quando `tag_replace.enabled`),
> além de forçar a remoção de "1ª consulta" quando a regra bloqueia.

## Telemetria individual por agente

Cada agente grava **uma linha própria** em `ai_usage` via `recordStep()` (`agent-core.ts:350,378-380,403`):

| Operation | Modelo | Latência | Quando |
|---|---|---|---|
| `classifier:summarizer` | `gpt-4o` (ou `gpt-5-mini (fallback)`) | `lat1` | sempre |
| `classifier:agendador` | `gpt-5-nano` | `lat2` (paralelo, mesmo valor p/ os 3) | sempre |
| `classifier:typifier` | `gpt-5-mini` | `lat2` | sempre |
| `classifier:movimentador` | `gpt-5-nano` | `lat2` | sempre |
| `classifier:maestro` | `gpt-5` | `lat3` | sempre (se 2 passou) |

Erros gravam a mesma linha com `status='error'` + `error` truncado em 500 chars. Falha no Resumidor aborta tudo (`agent_step1_failed`); falha em qualquer paralelo aborta os 3 + maestro (`agent_step2_parallel_failed`); falha no Maestro aborta (`agent_step3_maestro_failed`).

O bloco `agents` retornado para `apply.ts` e gravado no `lead_events.payload.agents` (ver `EVENTS_TELEMETRY.md`):

```ts
{
  summarizer_model:   "gpt-4o",
  agendador_model:    "gpt-5-nano",
  typifier_model:     "gpt-5-mini",
  movimentador_model: "gpt-5-nano",

  maestro_model:      "gpt-5",
  summary_chars:      <n>,
  summary:            "<resumo>",
  latency_ms:         { summarizer, agendador, typifier, movimentador, maestro },
  ran:                { summarizer, agendador, typifier, movimentador, maestro } // todas true em sucesso
}
```

## Datas — extração + parser determinístico

O LLM **NUNCA converte data**. Devolve apenas a string crua + o timestamp ISO da
mensagem que cita (`anchor_iso`). O `date-parser.ts` chama
`parseFutureDateInTZ(raw, "America/Sao_Paulo", anchor)` e gera:

- `resolved`: ISO UTC quando determinístico.
- `rejected_reason`: `"anchor_invalid" | "ambiguous_or_past" | "too_far_future"`.

Cobre DST, DD/MM, DD/MM/AAAA, ISO. Datas resolvidas viram `consulta_agendada_em` ou
`procedimento_agendado_em` (mapeado por `kind`).

## Gate G10 — implementado via DB

1. **Migration `20260618...g10_human_edits.sql`** adiciona
   `leads.custom_fields_last_human_edit jsonb DEFAULT '{}'`.
2. **Trigger PG `track_custom_fields_human_edits`** dispara BEFORE UPDATE OF
   `custom_fields`. Para cada chave alterada, grava `{key: now_iso}` no jsonb,
   **exceto** quando `current_setting('app.actor') = 'system'`.
3. **RPC `apply_lead_automation_patch(p_lead_id, p_custom_fields, p_tags)`**
   (SECURITY DEFINER) seta `app.actor='system'` dentro da transação e aplica o
   UPDATE. O classifier V6 sempre usa essa RPC para persistir mudanças.
4. **`apply.ts`** lê `lead.custom_fields_last_human_edit[key]`; se o timestamp
   for mais novo que `now − 7d`, descarta a sugestão da IA para essa chave e
   registra em `applied.custom_fields.blocked_by_g10`.
   - **Exceção (Override de Data)**: Se o parser identificar uma data e a confiança
     da IA for `>= 0.85`, o sistema ignora o G10 (`isDateFromParser = true`) para as
     chaves de `consulta_agendada_em` e `procedimento_agendado_em`, sobrepondo a
     edição humana.

> Edições humanas via PostgREST (frontend, inbox, lead drawer) **não setam**
> `app.actor` → o trigger as marca corretamente como humanas. Outras edge
> functions automáticas (pipeline-deterministic, fase4, pipeline-move) que
> escrevem em `custom_fields` ainda **não** usam a RPC → seus writes também
> serão marcados como "humanos", o que na prática faz o classifier respeitar
> regras determinísticas (comportamento desejável). Ver KNOWN_ISSUES.

## Movimentações e Auto-Move (General Move / B2B / Lock D3)

Com a aprovação dos ajustes recentes (V5 → V6), o caminho genérico do Classifier possui auto-move + lock explícito de Paciente antigo:

0. **Lock D3 (Paciente antigo)** (`apply.ts:245-255`): se `ctx.stageName === "Paciente antigo"`, o Classifier **nem tenta** sugerir movimentação. `stageOutcome = { path: "guard_d3", reason: "locked_in_paciente_antigo", would_move: false }`. B2B/Nurture/General são pulados. Defesa em profundidade junto com o Guard D3 do `pipelineMove`.

1. **Consulta Agendada (Ajuste B)**: Se a IA extrair com confiança a data de uma consulta confirmada no chat, ela aciona o General Move e move o lead para "Consulta agendada" via `pipelineMove`.

Caminho **B2B** (Move automático estrito): exige **TODOS** os guards:

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

Inalterados em relação a V1/V2. `rules/intent-effects.ts` chama:

| intent | função |
|---|---|
| `nf_reembolso` | `runNfTask` |
| `pagamento_alegado` | `runPaymentAlleged` |
| `judicializacao` | `runJudicializacao` |
| `renovacao_receita` | `runRenovacaoReceita` |
| `objecao` | `runObjectionSuggest` |

## Dispatcher (`index.ts`)

O cron `pipeline-classify-tick` continua chamando `action:'tick'` a cada minuto. O dispatcher lê a fila e invoca `agent-core.ts::runAgent`, que processa a linha de montagem de 5 agentes (3 fases). O modo `onlyAgent` aceito hoje no body é restrito a `"summarizer" | "typifier" | "maestro"` (linha 188). Se a UI `/pipeline-runs` precisar disparar apenas a fase paralela (`agendador + typifier + movimentador`), o dispatcher precisa ganhar suporte a `"parallel"`.

## Smoke test (V6)

```bash
# Tick forçado:
curl -X POST <function_url>/pipeline-classify \
  -d '{"action":"tick"}'

# Lead específico (full V6):
curl -X POST <function_url>/pipeline-classify \
  -d '{"action":"lead","lead_id":"<uuid>","force_version":"v2"}'

# Apenas Resumidor (smoke):
curl -X POST <function_url>/pipeline-classify \
  -d '{"action":"lead","lead_id":"<uuid>","only_agent":"summarizer"}'
```
