## Causa raiz

O pipeline da Clínica OR (`17c27f4d…`) **não tem o alias canônico `Novo` cadastrado** em `stage_canonical_aliases`. Existe o alias para `Qualificação`, mas o stage real "Leads de entrada" (`b1aa2fc9…`) nunca foi mapeado como `canonical_name='Novo'`.

Consequência direta: toda vez que a secretária responde um lead em "Leads de entrada", o trigger `auto:secretary-replied` chama `pipeline-deterministic`, que executa `resolveStageId(pipeline, 'Novo')`, não acha o alias, e retorna `skipped: not_in_novo`. As respostas no `net._http_response` confirmam isso — centenas de chamadas com `{"ok":true,"result":{"skipped":"not_in_novo"}}` nas últimas horas.

Por isso os cards continuam em "Leads de entrada" mesmo depois da secretária responder, mesmo com o toggle `automation.secretary_replied.enabled = true` e a função deployada.

A doc `docs/pipeline/runtime/STAGES_LIVE.md` afirma que o alias existe ("o canônico `Novo` resolve para o stage real 'Leads de entrada' via alias"), mas o registro está ausente no banco — provavelmente nunca foi seedado para esse pipeline, ou foi apagado em alguma migração.

## Fix

### 1. Inserir o alias faltante (migration de dados)

```sql
INSERT INTO public.stage_canonical_aliases (clinic_id, pipeline_id, stage_id, canonical_name)
VALUES (
  'cf038458-457d-4c1a-9ac4-c88c3c8353a1',         -- Clínica OR
  '17c27f4d-8256-4ea7-b5b9-ed706494f686',
  'b1aa2fc9-d221-4d4f-b53a-7303ec4b75b0',         -- Leads de entrada
  'Novo'
)
ON CONFLICT DO NOTHING;
```

Também vou varrer **todos** os pipelines ativos e, para cada um sem alias `Novo`, mapear o stage de menor `position` (ou o stage cujo nome casa com os aliases conhecidos: "Leads de entrada", "Novo", "Lead novo", "Entrada") como canônico `Novo`. Isso previne o mesmo bug em outras clínicas/pipelines criados depois.

### 2. Backfill dos cards travados

Após inserir o alias, rodar uma chamada manual ao `pipeline-deterministic` com `action: 'secretary-replied'` para cada mensagem `from_me=true` recente cujo lead ainda está em "Leads de entrada"/"Novo". Como atalho operacional, basta um `UPDATE leads SET stage_id = <qualificacao_id>` para os leads do pipeline 17c27f4d que estão em "Leads de entrada" e já têm pelo menos 1 mensagem `from_me=true` — preservando histórico via INSERT em `lead_stage_history` com `source='backfill:secretary-replied-alias-fix'`.

### 3. Verificação

- Conferir que `resolveStageId(pipeline 17c27f4d, 'Novo')` retorna `b1aa2fc9…`.
- Forçar uma resposta de secretária em um lead novo no preview e checar se ele migra para "Qualificação" dentro de poucos segundos.
- Conferir que aparecem novos eventos `auto:secretary-replied` em `lead_events` (zero nos últimos 7 dias hoje).

### 4. Doc

Atualizar `docs/pipeline/runtime/STAGES_LIVE.md` notando que o alias `Novo` precisa ser explicitamente seedado quando um pipeline novo é criado (e referenciar a migration deste fix em `code_refs`).

## Fora de escopo

- A Causa 1 paralela (pipeline da Sanapta `2c6e163b` que só tem 1 stage "Novo" e portanto não pode mover para "Qualificação") **não é tratada aqui** porque você confirmou que só quer o pipeline da Clínica OR.
