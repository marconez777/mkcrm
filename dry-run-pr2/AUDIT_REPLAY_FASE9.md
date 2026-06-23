# Auditoria Pipeline — Replay E2E Fase 9

Este documento é gerado/preenchido manualmente após executar o script de replay
`scripts/pipeline-replay.ts` contra leads-controle reais. Use-o como referência
do estado pós-Fases 4-8.

## Como rodar

```bash
# Variáveis necessárias (locais; nunca commitar):
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role>"

bun run scripts/pipeline-replay.ts
```

O script:
1. Para cada `lead_id` listado, invoca `pipeline-run-executor` com `action=retry_lead`.
2. Aguarda até 120s pela conclusão do último `pipeline_run_items` desse lead.
3. Coleta `status`, `error`, `result.agents.provider`, `result.agents.latency_ms`,
   `auto_retry_count`, fallback usado.
4. Imprime tabela markdown + sumário.

## Leads-controle

| # | Lead ID | Motivo histórico |
|---|---------|------------------|
| 1 | `ba3d7fe0-2d5b-4fe7-b9a0-466632a3d348` | OpenAI quota exceeded |
| 2 | `e2356773-...` | classify_timeout (75 msg) |
| 3-5 | 3 leads históricos | `No object generated` |
| 6-10 | 5 leads OK | Controle (devem continuar ok) |

## Critério de Sucesso

- ≥ 8/10 sucesso (status=ok).
- p95 latency < 60s.
- 0 falhas permanentes por causa transitória recuperável (sem `auto_retry_count=2` para erros listados em `FALLBACK_PATTERN`).

## Resultado da execução

_Preencher após cada rodada com a saída do script._

| # | Lead | Status | Provider | Fallback | Latency total | auto_retry | Erro |
|---|------|--------|----------|----------|---------------|------------|------|
| 1 | … | … | … | … | … | … | … |

**Sumário:**
- Sucesso: __/10
- p50: __ms, p95: __ms
- Fallbacks usados: __
- Esgotados: __
