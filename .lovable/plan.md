# Remover bloqueio de "no_new_messages" nas execuções manuais do pipeline

## Diagnóstico

Quando o usuário clica em **Executar pipeline inteiro** / **Executar com escopo**:

1. `pipeline-run-executor` chama `pipeline-classify` (`action:"lead"`) para cada lead.
2. `pipeline-classify` → `loadLeadContext` (`context.ts:96-99`) compara o `id` da última mensagem com `leads.last_processed_message_id_classifier`. Se for igual, retorna `{kind:"skip", reason:"no_new_messages"}`.
3. `index.ts:81-101` grava telemetria `no_new_messages`, "re-confirma" o watermark e devolve skip.
4. Resultado: a UI mostra `skip = N` (na print, "1 leads · ok 0 · skip 1") e os 3 agentes V3 nunca rodam de novo, mesmo tendo mudado prompts/modelo.

O bypass existente em `classifyOneV2` (linha 63) só aciona quando há `only_agent` (modos "Só Resumidor/Tipificador/Maestro"), e mesmo assim ele só **escreve um skip de telemetria** — não reclassifica.

## O que ajustar

### 1. `supabase/functions/pipeline-classify/context.ts`

Aceitar `bypassWatermark` em `loadLeadContext`:

```ts
export async function loadLeadContext(
  client: SupabaseClient,
  leadId: string,
  opts?: { bypassWatermark?: boolean },
): Promise<LoadResult> { ... }
```

Quando `opts?.bypassWatermark === true`, pula o early-return de `no_new_messages` (continua carregando contexto normalmente). Watermark continua presente em `ctx.lead.last_processed_message_id_classifier` apenas como informação.

### 2. `supabase/functions/pipeline-classify/index.ts`

- `classifyOneV2(client, leadId, onlyAgent, force?)`:
  - aceitar `force?: boolean`;
  - chamar `loadLeadContext(client, leadId, { bypassWatermark: !!force })`;
  - remover o branch "manual_skip_no_new_messages" (quando force=true não chega mais aqui);
  - em modo `full` + `force` re-avança o watermark normalmente ao final (já é o fluxo atual).
- `handleV2`: ler `body.force` (boolean) e propagar para `classifyOneV2`.
- `tickQueueV2` (cron) **não** força — preserva o comportamento de fila por watermark (evita reprocessar tudo a cada tick).

### 3. `supabase/functions/pipeline-run-executor/index.ts`

- `callClassify(leadId, onlyAgent, force=true)`: sempre passar `force: true` no body. Execução pelo botão é ato deliberado do usuário.
- Adiciona o campo no body junto com `only_agent`.

### 4. UI — sem mudanças visíveis

Nenhuma alteração em `PipelineRuns.tsx`. O comportamento dos botões "Executar pipeline inteiro" / "Executar com escopo" / "Reprocessar erros" / "Reprocessar comentados" passa a sempre forçar reclassificação. A UI já mostra `ok`/`skip`/`err` — só vai ver menos `skip` por watermark.

> Os skips legítimos (`no_messages`, `no_pipeline`, `lead_not_found`, `clinic_not_allowlisted`, `agent_error:*`) continuam acontecendo normalmente.

### 5. Validação

- Re-rodar **Executar pipeline inteiro** na ÓR (3 leads de teste recentes).
- Esperado: `skip = 0` por `no_new_messages`; os 3 agentes (Resumidor/Tipificador/Maestro `gpt-5`) executam em cada lead e geram um novo `lead_event` com `payload.agents`.
- Conferir no `lead_events` mais recente de um dos leads que `agents.ran = {summarizer:true, typifier:true, maestro:true}`.

## Fora de escopo

- Não alterar a fila por trigger / `tg_enqueue_classifier` — o cron continua respeitando watermark.
- Não mexer no V1 (`index.v1.ts`).
- Não criar toggle de UI — força é implícita nas execuções manuais.
