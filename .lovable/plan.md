## Fix: loop infinito silencioso no `classifyOneV2` quando `runAgent` falha

### Problema
No `supabase/functions/pipeline-classify/index.ts`, o bloco de erro do `runAgent` faz `return { skipped: agentOut.error }` sem limpar `needs_ai_review`. O lead permanece na fila com `ai_review_queued_at` antigo, é reescolhido no próximo tick, falha de novo, e bloqueia o batch — mesma classe de bug que já corrigimos para `clinic_not_allowlisted` / `no_new_messages`.

### Mudança
Arquivo: `supabase/functions/pipeline-classify/index.ts`, função `classifyOneV2`, bloco `if ("error" in agentOut)`:

- Adicionar `writeSkipTelemetry` com reason `agent_error:<msg>` (hoje não há telemetria nesse caminho).
- Adicionar `await clearQueueFlag(client, leadId);` antes do `return`.
- Mudar o `return` para `{ skipped: \`agent_error:${agentOut.error}\` }` para casar com a telemetria.

Código final do bloco:

```ts
if ("error" in agentOut) {
  await writeSkipTelemetry(
    client,
    { clinic_id: ctx.lead.clinic_id, lead_id: leadId },
    `agent_error:${agentOut.error}`,
  );
  await clearQueueFlag(client, leadId);
  return { skipped: `agent_error:${agentOut.error}` };
}
```

Observação: `leadId` não é variável local nesse escopo hoje — vou usar `ctx.lead.id` (já disponível) em vez de introduzir um alias.

### Deploy & validação
1. Deploy de `pipeline-classify` via `supabase--deploy_edge_functions`.
2. `SELECT count(*) FROM leads WHERE needs_ai_review;` antes e depois de 1–2 ticks para confirmar drenagem.
3. Conferir `pipeline_classifier_skips` (ou tabela equivalente de telemetria) para ver os novos registros `agent_error:*` — assim conseguimos identificar qual erro do agente está estourando.

### Fora de escopo
- Não mexer em `agent-core.ts`, retries, ou no schema. Só destravar a fila e instrumentar a causa.
- Não alterar UI.

### Docs
- Acrescentar nota em `docs/pipeline/runtime/KNOWN_ISSUES.md` registrando que o caminho `agent_error` agora limpa a flag e emite telemetria.
