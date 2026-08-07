# Auditoria Completa do Pipeline — 2026-06-19

Fonte: queries em `pipeline_run_items` / `pipeline_runs` + leitura de
`supabase/functions/pipeline-{classify,run-executor,deterministic}` e
`_shared/{classifier-ai,utils}.ts`. Sem alterações de código nesta fase.

## 1. Distribuição de falhas (últimos 30d)

| Step      | status=error | exemplo erro                                         |
|-----------|--------------|------------------------------------------------------|
| classify  | 4            | `classify_timeout_55s` (lead Camila Stanjek, 75 msgs)|
| classify  | 4            | `No object generated: response did not match schema` |

`pipeline_runs`: 3 `error` com `error_reason: worker_timeout_no_heartbeat`
(runs com 7–66 leads que extrapolaram `STALE_AFTER_MS=6min`) e 4 `cancelled`
(usuário abortou pela UI).

## 2. Causas-raiz identificadas

### P0-1 — `classify_timeout_55s`
- Constante atual: `CLASSIFY_TIMEOUT_MS = 120_000` em
  `pipeline-run-executor/index.ts:33`. O literal `_55s` nos erros é
  histórico (constante antes do bump). **Risco residual:** chain de 5
  agentes em série (`Resumidor → [Agendador‖Preenchedor‖Movimentador] → Maestro`)
  encostando em 120s para leads com histórico longo + Gemini lento.
- Nenhum subagente tem timeout individual; um único agente travado consome
  todo o orçamento.
- Mesmo lead (`e2356773…`, 75 msgs) falhou 4× seguidas → reentrância sem
  cooldown nem fallback de provider.

### P0-2 — `No object generated: response did not match schema`
- Disparado por `Output.object({ schema })` quando o modelo (Gemini ou GPT)
  devolve JSON que não casa o Zod. `withSchemaRetry` em
  `agent-core.ts:94-139` faz **apenas 1 retry** com a mesma chamada — se o
  modelo erra duas vezes, o run morre.
- Schemas grandes (`MaestroOutputSchema`, `TypifierOutputSchema` com enum
  dinâmico de campos da clínica) são o gatilho documentado em
  `ai-sdk-lovable-gateway` (“too many states”).
- Sem fallback de provider: se Gemini rejeita o schema, não tentamos OpenAI
  BYOK na mesma execução.

### P1-3 — `worker_timeout_no_heartbeat`
- `STALE_AFTER_MS = 6min`. Run de 66 leads (`55fc9989…`) levou >29min sem
  heartbeat suficiente. O `runWorker` provavelmente não atualiza
  `last_heartbeat_at` entre leads pesados.
- Consequência: o watchdog mata o run mid-execução e marca itens `pending`
  como `error: worker_timeout_no_heartbeat`, mesmo que o classify ainda
  pudesse completar.

### P1-4 — Schema retry frágil
- `withSchemaRetry` mistura backoff de 429 com retry de schema. A última
  tentativa de schema chama `fn()` **sem capturar erro**, propagando o
  primeiro `did not match schema` se vier novamente.
- Não há jitter no backoff de 429 → thundering herd se múltiplos leads
  forem disparados ao mesmo tempo.

### P2-5 — Drift de telemetria
- `pipeline_run_items.result` está `null` em todos os erros recentes —
  nenhum timing por subagente é persistido. Hoje só dá para diagnosticar
  com `ai_usage` cruzando timestamps.

### P2-6 — Determinístico vs documentação
- `pipeline-deterministic` logou `secretary-replied → skipped: not_in_novo`
  — comportamento esperado por `DETERMINISTIC_RULES.md`. OK.

### P2-7 — Retry queue
- `retry_requested=true` é setado por `PipelineErrorsCard`, mas não há
  índice em `(retry_requested, status)`; uma varredura cresce O(n) com
  histórico.

## 3. Itens fora-de-escopo verificados sem achados
- `evolution-webhook` respondendo 200 (~1.4–2.6s).
- `scheduled-dispatcher`, `broadcast-tick`, `email-automations-tick`
  rodando sem erro nos últimos 60min.
- `pipeline-classify?action=tick` retornando `processed:0` — fila vazia,
  scheduler saudável.

## 4. Severidade & ordem sugerida de fix
1. **P0-1** Timeout por subagente + fallback provider.
2. **P0-2** Retry schema com fallback (Gemini → OpenAI) e simplificação de
   `MaestroOutputSchema`.
3. **P1-3** Heartbeat por lead no `runWorker`.
4. **P1-4** Separar backoff 429 do retry de schema; adicionar jitter.
5. **P2-5** Persistir `timings`+`provider`+`model` em
   `pipeline_run_items.result`.
6. **P2-7** Índice `(retry_requested, status)`.

---

## Fase 10 — Limpeza estrutural (2026-06-23)

Fechamento dos resíduos do `KNOWN_ISSUES.md` que ficaram após Fase 9.

| Item | Antes | Depois |
|------|-------|--------|
| #4 whitelist de tags | "não é consultada por código" | Verificado: já implementado em `pipeline-classify/apply.ts` (`getAllowedTags` + log `dropped_by_whitelist`). Reclassificado como ✅. |
| #6 `auto:*` com 0 eventos em 30d | hipóteses A/B/C | Causa raiz identificada: função `public.notify_pipeline_deterministic` órfã (sem trigger em `pg_trigger`). `pg_net` saudável (87% 200 em 24h). Documentado. |
| #7 `consulta_agendada_em` | "não cadastrada em `lead_custom_fields`" | Verificado: já existe row; cobertura suficiente (1 clínica usa o campo). ✅. |
| #-10 `stage_sequence_bindings` dormente | review previsto sem critério | Critério publicado em `USER_AUTOMATIONS.md`: se `count<10` em 2026-07-22 → drop trigger + arquivar UI. |

Sem mudanças de código nesta fase — apenas verificação e documentação. Auditoria do pipeline encerrada.
