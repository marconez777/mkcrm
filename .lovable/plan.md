## Problema

256 leads estão com `needs_ai_review=true` (badge "IA na fila") há até 7 dias. Causa:

- Só a clínica **ÓR** (`cf038458…`) está em `pipeline_automation_allowlist`. As outras 235 leads são de clínicas não allowlistadas.
- O `pipeline-classify` V2 (`supabase/functions/pipeline-classify/index.ts`, linhas 71-83) escreve telemetria + watermark quando bate `clinic_not_allowlisted`, mas **não** limpa `needs_ai_review`. A flag fica para sempre.
- O tick ordena por `ai_review_queued_at ASC` (linha 118) e consome batches de 50. Os 235 leads não-allowlistados são os mais antigos → todo tick é gasto em skips. Os 21 leads da ÓR quase nunca chegam à vez → "IA na fila" persiste horas/dias.

## Mudanças

### 1. `supabase/functions/pipeline-classify/index.ts`

No `classifyOneV2`, **antes** dos `return` dos skips `clinic_not_allowlisted` e `no_new_messages`, adicionar:

```ts
await client
  .from("leads")
  .update({
    needs_ai_review: false,
    ai_review_reasons: [], // ou array_remove via RPC; simples reset basta
    ai_review_queued_at: null,
  })
  .eq("id", leadId);
```

Isso garante que cada skip remove o lead da fila — não volta no próximo tick.

### 2. Migration SQL (limpeza one-shot)

```sql
UPDATE public.leads
SET needs_ai_review   = false,
    ai_review_reasons = array_remove(ai_review_reasons, 'pipeline-classifier'),
    ai_review_queued_at = NULL
WHERE needs_ai_review = true
  AND clinic_id NOT IN (
    SELECT clinic_id
    FROM public.pipeline_automation_allowlist
    WHERE enabled = true
  );
```

Esvazia ~235 leads de uma vez. O tick passa a focar nos 21 da ÓR (cabem em 1 batch).

### 3. Validação

- `SELECT count(*) FROM leads WHERE needs_ai_review;` → esperado ≤ 21 logo após a migration, ≈ 0 após 1–2 ticks.
- Disparar `action:'tick'` manualmente via `supabase--curl_edge_functions` para confirmar drenagem.
- Inspecionar `lead_events WHERE type='auto:classifier'` recente → deve mostrar processamento da ÓR.

### 4. Documentação

- `docs/pipeline/runtime/KNOWN_ISSUES.md`: registrar bug "skip não limpa needs_ai_review" + correção aplicada.
- `mem://docs/maintenance-progress`: anotar a limpeza + correção.

## Fora do escopo

- Nenhuma mudança de UI (`Kanban.tsx` permanece).
- Não tocar V1 (`index.v1.ts`) — só V2 está ativo (`automation.classifier.version='v2'`).
- Não alterar a allowlist nem políticas RLS.
