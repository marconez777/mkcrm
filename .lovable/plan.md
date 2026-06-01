# Plano

## 1. Dropdown "Etapa" só mostra etapas do pipeline do lead

Hoje `ContextRail.tsx` recebe **todas** as `pipeline_stages` (de todos os pipelines) e renderiza a lista inteira no Select de etapa. Por isso aparecem "Acompanhamento Mensal", "Engajamento Positivo", etc. junto com as do pipeline do lead.

**Mudança em `src/components/inbox/ContextRail.tsx`:**
- Derivar `pipelineStages = stages.filter(s => s.pipeline_id === lead.pipeline_id)` (memoizado por `lead.pipeline_id` + `stages`).
- Usar `pipelineStages` no `.map()` do `SelectContent` da Etapa.
- Manter o lookup atual `stages.find(s => s.id === lead.stage_id)` para o label do trigger (cobre o caso raro do stage_id apontar para outro pipeline — vai ser corrigido pelo passo 2).
- Se `pipelineStages.length === 0` (lead sem `pipeline_id`), cair no comportamento atual (mostrar todas) para não travar a UI.

Nenhuma outra tela é afetada — Kanban já filtra por pipeline.

## 2. Reparo de dados: leads do "Agendamentos Novo" com etapa de outro pipeline → "Qualificação"

Verifiquei no banco:

```sql
SELECT count(*) FROM leads l
JOIN pipeline_stages ps ON ps.id = l.stage_id
WHERE l.pipeline_id = '737242e7-...-Agendamentos Novo'
  AND ps.pipeline_id <> l.pipeline_id;
-- => 0
```

Hoje **não existem leads desalinhados** nesse pipeline. Mesmo assim, rodarei a migração de reparo para fechar a porta (vai afetar 0 linhas agora, mas serve de safety net e cobre qualquer lead que entre no estado inconsistente até a UI ser publicada).

**Migração (UPDATE):**
```sql
UPDATE leads
SET stage_id = '34fd2408-59e2-446a-8dd5-866eb484ea04',  -- "Qualificação" do Agendamentos Novo
    stage_changed_at = now()
WHERE pipeline_id = '737242e7-8efc-4a8f-9fed-f09c6e5dc227'
  AND (
    stage_id IS NULL
    OR stage_id NOT IN (
      SELECT id FROM pipeline_stages
      WHERE pipeline_id = '737242e7-8efc-4a8f-9fed-f09c6e5dc227'
    )
  );
```

O trigger `log_lead_changes` já vai registrar `stage_changed` no `lead_events` automaticamente (sem `actor_user_id`, ficando como ação de sistema).

## Fora de escopo

- Não vou alterar Kanban, automações, ou outras telas — só o dropdown da rail e o reparo único de dados.
- Não vou tocar em `useStages` (continua trazendo todas as etapas; o filtro fica no componente).
