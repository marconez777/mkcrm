
## Objetivo

Permitir que um mesmo pipeline receba leads de **N instâncias de WhatsApp**, para que todos caiam no mesmo funil e sejam atendidos pelo mesmo agente de IA.

## Como está hoje

O vínculo pipeline↔instância é **1:1 exclusivo**:

- `pipelines.whatsapp_instance_id` (uuid, único de fato — a UI bloqueia reutilização)
- Ingestão em `supabase/functions/_shared/evolution.ts` (`ingestMessage`) faz:
  ```
  select id from pipelines
   where clinic_id=? and kind='sales'
     and whatsapp_instance_id = <instância que recebeu a msg>
  ```
  Se não achar, cai no pipeline default (sales) da clínica.
- `EditPipelineDialog.tsx` monta um `Select` que **remove instâncias já usadas em outro funil** — impede compartilhar.
- Outbound é **sticky no lead** (`leads.whatsapp_instance_id`): a resposta sai pelo número que criou o lead. Isso permanece assim (nada muda no envio).

Ou seja: já temos toda a lógica de "vários números por clínica"; só falta trocar o vínculo pipeline→instância de 1:1 para N:M.

## Plano em fases

### Fase 1 — Modelo de dados (migration)

Nova tabela de junção `public.pipeline_whatsapp_instances`:

- `pipeline_id uuid → pipelines(id) on delete cascade`
- `whatsapp_instance_id uuid → whatsapp_instances(id) on delete cascade`
- `clinic_id uuid → clinics(id)` (para RLS e índice)
- `created_at timestamptz default now()`
- PK composta `(pipeline_id, whatsapp_instance_id)`
- **Constraint chave:** `UNIQUE (clinic_id, whatsapp_instance_id)` — uma instância continua pertencendo a **no máximo um** pipeline de vendas (evita ambiguidade no inbound). O que muda é: um pipeline pode ter várias instâncias.
- GRANTs padrão (`authenticated` full CRUD, `service_role` all).
- RLS: membros da clínica leem/gerenciam; policies espelhando as de `pipelines`.
- **Backfill:** `INSERT ... SELECT id, whatsapp_instance_id, clinic_id FROM pipelines WHERE whatsapp_instance_id IS NOT NULL`.
- **Não remover** `pipelines.whatsapp_instance_id` nesta fase — mantido como coluna legada/"instância primária" (usada como default em UI/broadcast). Marcado como deprecated em comentário SQL.

### Fase 2 — Ingestão inbound (edge)

`supabase/functions/_shared/evolution.ts` (`ingestMessage`, linhas ~366-375):

Trocar o lookup por join:
```
select p.id
  from pipeline_whatsapp_instances pwi
  join pipelines p on p.id = pwi.pipeline_id
 where pwi.clinic_id = ?
   and pwi.whatsapp_instance_id = <instância recebida>
   and p.kind = 'sales'
 limit 1
```
Se vazio → cai no fallback existente (`is_default`).
Manter compatibilidade lendo também `pipelines.whatsapp_instance_id` como fallback secundário até a Fase 5 (defesa em profundidade).

### Fase 3 — UI de edição do pipeline

`src/components/kanban/EditPipelineDialog.tsx`:

- Substituir o `Select` único por multi-seleção (checkbox list ou `MultiSelect`) das instâncias.
- Carregar seleção atual via `select whatsapp_instance_id from pipeline_whatsapp_instances where pipeline_id = ?`.
- Manter regra "instância já usada em outro funil não aparece" (única, por causa do `UNIQUE (clinic_id, whatsapp_instance_id)`), mas mostrar as que já estão neste funil.
- Ao salvar: diff — insert nas novas, delete nas removidas (transação otimista); também atualiza `pipelines.whatsapp_instance_id` para a **primeira** selecionada (retro-compat).
- Texto de ajuda: "Todas as mensagens recebidas por esses números entrarão neste funil e serão atendidas pelo mesmo agente de IA."

### Fase 4 — Indicadores visuais

`src/components/kanban/PipelineSwitcher.tsx`: mostrar o ícone `MessageCircleMore` quando **existir ao menos uma** instância no join (não só `p.whatsapp_instance_id`). Idealmente ler contagem via `usePipelines` (hook aumentado com `instance_ids: string[]`).

### Fase 5 — Cleanup (opcional, depois de validado)

- Remover o fallback secundário em `ingestMessage`.
- Depreciar `pipelines.whatsapp_instance_id` (manter coluna, parar de gravar — ou dropar em migration futura). **Fora deste escopo.**

## Fora do escopo

- Outbound multi-número (leads continuam sticky ao número original — pedido do usuário é só entrada consolidada).
- Broadcasts, sequences, automations (continuam usando `pipelines.whatsapp_instance_id` como default; nada quebra).
- Kommo import, ai-auto-reply — leem do lead, não do pipeline.

## Validação

1. Criar pipeline "Vendas Consolidado", vincular 2 instâncias.
2. Mensagem inbound do número A → lead cai no pipeline consolidado com `whatsapp_instance_id=A`.
3. Mensagem inbound de novo número de outro contato pelo número B → mesmo pipeline, `whatsapp_instance_id=B`.
4. Agente IA responde os dois — cada um pelo seu respectivo número (sticky).
5. Remover uma instância do pipeline → leads antigos permanecem, novos inbound daquele número caem no fallback.

## Confirmações que preciso antes de mexer

Nenhuma — plano segue exatamente o comportamento pedido. Aprovar para eu implementar Fases 1-4.
