## O que descobri

Erro meu antes: a clínica ÓR é `cf038458…` (já estava habilitada desde o início) — habilitei **Sanapta** (`46e43fd2…`) por engano. Preciso reverter.

E os agentes V3 **não rodam na ÓR** por uma combinação de 3 motivos (não é allowlist):

1. **Fila vazia.** O `pipeline-classify` só processa leads que tenham `"pipeline-classifier"` em `ai_review_reasons`. Hoje a ÓR tem **0 leads** nesse estado.
2. **Trigger só enfileira em inbound novas.** `tg_enqueue_classifier` dispara quando uma mensagem `from_me=false` é inserida. Última inbound da ÓR foi às **23:15 de ontem** (3h atrás). Sem mensagem nova, ninguém entra na fila.
3. **Última rodada (00:48) falhou em série.** 10 eventos consecutivos com `agent_error:agent_generate_failed: No object generated: response did not match schema.` — o LLM está devolvendo JSON que não bate com `SummarizerOutputSchema`/`TypifierOutputSchema`/`MaestroOutputSchema`. Os leads daquela leva foram esvaziados da fila (`clearQueueFlag`) e não voltam até chegar inbound nova.

Conclusão: o V3 (3 agentes) está deployado, mas ninguém comprovou que executa de ponta a ponta porque desde o último deploy não chegou inbound nova na ÓR + as últimas tentativas quebraram no schema. Por isso a UI mostra "0 execuções dos 3 agentes" — não é a allowlist, e não é bug do enfileirador.

## Ação

**1) Reverter Sanapta** (desabilitar na allowlist, voltando ao estado anterior):

```sql
UPDATE public.pipeline_automation_allowlist
SET enabled = false
WHERE clinic_id = '46e43fd2-2b02-4615-85c4-fc98543f55c1';
```

**2) Disparo manual para validar V3 agora** (sem esperar inbound).
Escolher 1 lead da ÓR com mensagens suficientes e chamar a função em modo `action:"lead"`, primeiro `only_agent:"summarizer"`, depois `typifier`, depois `maestro`. Isso:
- prova que o pipeline V3 funciona ponta-a-ponta nessa clínica;
- popula `lead_events.payload.agents` (que hoje é sempre `null` porque nenhuma run V3 bem-sucedida foi escrita ainda);
- expõe na UI `/pipeline-runs` os 3 cards (📝/🏷️/🎯) já preenchidos para esse lead.

Lead candidato: `dded43d5-205e-4214-b607-7eedcb811ee8` (já está na fila com `needs_ai_review=true` desde 17/06; é a cobaia perfeita). Se preferir outro, me diga.

**3) Investigar o erro de schema.**
Coletar os payloads brutos dos 10 erros das 00:48 (já no `lead_events`), localizar qual dos 3 agentes está rejeitando, e:
- se for o **Tipificador**: provável `custom_fields_patch` com tipo fora de `string|number|boolean|null` (ex.: objeto aninhado vindo do modelo);
- se for o **Maestro**: `reasons` vazio (`min(1)`) ou `confidence` fora de `[0,1]`;
- se for o **Resumidor**: `summary` excedendo 1600 chars ou `mentioned_dates.kind` enviado como objeto.

Para cada caso, adicionar **retry com prompt corretivo** (1 tentativa só, incluindo o erro do parser no prompt) em `agent-core.ts`. Sem mudar o schema. Se o problema for systemático no Tipificador (caso mais comum com `record(string, union)`), também `coercer` numbers/booleans-as-strings antes do `safeParse` no `applyClassification`.

**4) Sem mudança de UI nesta rodada.** O `PipelineRuns.tsx` já lê `payload.agents` — assim que (2) gerar runs com `agents` preenchido, a UI mostra os 3 cards sem nenhuma alteração.

## Validação

- `pipeline_automation_allowlist`: só ÓR habilitada.
- `lead_events` para o lead-cobaia: 3 entradas `auto:classifier` (uma por agente) com `payload.agents.ran.{summarizer,typifier,maestro}` refletindo o que foi disparado e `payload.cost.model` correto por agente.
- `/pipeline-runs`: os 3 cards aparecem populados para esse lead, com latência e custo.
- 10 últimos `agent_error:agent_generate_failed` deixam de aparecer (ou caem >80%) após o retry corretivo.
