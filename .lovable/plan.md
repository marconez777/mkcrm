# Plano

Adicionar campo **Funil** na rail de contexto (acima de **Etapa**) e fazer a Etapa reagir à troca de funil.

## Mudanças em `src/components/inbox/ContextRail.tsx`

1. **Carregar pipelines** via `usePipelines()` (`src/hooks/usePipelines.ts`) — já existe, retorna a lista ordenada com realtime.
2. **Novo `<Select>` "Funil"** logo antes do bloco de Etapa:
   - `value = form.pipeline_id`
   - Opções: todos os `pipelines` (com bolinha `p.color` + `p.name`).
   - `onValueChange`: chama `changePipeline(newId)`.
3. **Função `changePipeline(newPipelineId)`**:
   - Filtra `stages` por `pipeline_id === newPipelineId`, ordena por `position`, pega o primeiro como etapa inicial (`initialStageId`). Como `pipeline_stages` não tem coluna `is_initial`, usar o de menor `position`.
   - Se a `stage_id` atual já pertence ao novo pipeline, mantém. Senão, substitui pelo `initialStageId` (pode ser `null` se o pipeline não tiver etapas).
   - `patch({ pipeline_id: newPipelineId, stage_id: novoStageId })` num único update — o trigger `log_lead_changes` registra `stage_changed` e também precisa registrar pipeline. Hoje o trigger só loga stage/attendant/custom_fields — vou **adicionar evento `pipeline_changed`** no trigger para deixar a timeline coerente.
4. **Etapa** já está filtrada pelo `lead.pipeline_id` (mudança anterior). Como o `Select` usa `form.pipeline_id` indiretamente via `lead.pipeline_id`, vou trocar para usar `form.pipeline_id` no filtro (`pipelineStages = stages.filter(s => s.pipeline_id === form.pipeline_id)`) para a lista atualizar instantaneamente após o usuário trocar o funil, mesmo antes do roundtrip.

## Migração: trigger `log_lead_changes`

Adicionar bloco no `log_lead_changes()`:
```sql
IF NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
  INSERT INTO lead_events(lead_id, type, payload, actor_user_id)
  VALUES (NEW.id, 'pipeline_changed',
    jsonb_build_object('from', OLD.pipeline_id, 'to', NEW.pipeline_id),
    auth.uid());
END IF;
```

## Timeline (mínimo)

- `src/components/lead/timeline/types.ts`: adicionar `pipeline_changed: "Funil alterado"` em `CRM_EVENT_PT`.
- Render textual padrão (nome dos pipelines pode ficar como UUID por ora — fora de escopo resolver nome). Se trivial, faço um lookup leve com a lista já presente.

## Fora de escopo

- Kanban e outras telas (já lidam com pipeline).
- Não vou criar UI de "mover lead para outro funil em massa".
