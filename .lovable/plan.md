## Objetivo

Adicionar dois novos gatilhos para Sequências:
1. **"Lead entra em um pipeline"** — dispara quando o lead é movido (ou criado) em qualquer coluna de um pipeline específico.
2. **"Lead movido para coluna"** — já existe; vou ampliá-lo para também disparar quando o lead for **criado** já naquela coluna (hoje só dispara no UPDATE).

## Migration (banco)

1. Relaxar o CHECK de `message_sequences.trigger_type` para incluir `'pipeline_enter'`.
2. Recriar `enroll_lead_on_stage_change()`:
   - Disparar tanto em INSERT quanto em UPDATE de `leads`.
   - No INSERT: tratar como "entrou no stage atual" e "entrou no pipeline atual".
   - No UPDATE: disparar quando `stage_id` mudar **ou** quando o `pipeline_id` (derivado do novo stage) mudar.
   - Em cada caso, inscrever em sequências:
     - `trigger_type='stage_enter'` cujo `trigger_config->>'stage_id' = NEW.stage_id`
     - `trigger_type='pipeline_enter'` cujo `trigger_config->>'pipeline_id' = pipeline do NEW.stage_id`
   - Manter cooldown e `source` registrando qual gatilho/origem.
3. Recriar o trigger em `leads`:
   ```sql
   DROP TRIGGER trg_enroll_on_stage_change ON public.leads;
   CREATE TRIGGER trg_enroll_on_stage_change
     AFTER INSERT OR UPDATE OF stage_id ON public.leads
     FOR EACH ROW EXECUTE FUNCTION public.enroll_lead_on_stage_change();
   ```

## UI — `src/pages/Sequences.tsx`

1. Adicionar `pipeline_enter` ao type `trigger_type` e à lista `TRIGGERS` com label "Lead entra em um pipeline".
2. Carregar `pipelines` no `load()` (`supabase.from("pipelines").select("id, name").order("position")`).
3. Render condicional quando `trigger_type === "pipeline_enter"`: dropdown com pipelines salvando em `trigger_config.pipeline_id`.
4. Ajustar copy/help text do `stage_enter` para deixar claro que também vale para leads recém-criados naquela coluna.

## Fora de escopo

- Sem mudanças no scheduler/edge functions (a inscrição via DB trigger já é processada normalmente).
- Sem mudanças no editor de passos (atraso em dias já feito antes).
