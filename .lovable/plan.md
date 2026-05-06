## Objetivo

Garantir que mensagens recebidas no WhatsApp criem leads **apenas em um único funil específico** vinculado àquele número, e que funis do tipo **"Gestão interna"** nunca recebam leads automaticamente.

## Comportamento desejado

- Cada instância de WhatsApp pode estar ligada a **no máximo um funil** (do tipo "Vendas").
- Quando chega mensagem nova de um número desconhecido:
  - Procura o funil `kind='sales'` cujo `whatsapp_instance_id` = instância que recebeu.
  - Cria o lead na **primeira etapa** desse funil (e grava `pipeline_id`).
  - Se nenhum funil estiver vinculado àquela instância, usa o funil marcado como `is_default=true` (fallback).
  - Se nem isso existir, **não cria lead** (skip).
- Funis "Gestão interna" nunca podem ter `whatsapp_instance_id` → portanto nunca recebem entrada automática. Só aceitam leads via importação ou criação manual.
- Importação Kommo e criação manual continuam funcionando normalmente em qualquer funil.

## Mudanças técnicas

**1. Migração de banco**
- Índice único parcial em `pipelines(clinic_id, whatsapp_instance_id)` onde `whatsapp_instance_id IS NOT NULL` — impede dois funis usarem a mesma instância.
- Trigger de validação: se `kind='internal'`, força `whatsapp_instance_id = NULL` (ou rejeita).
- Limpeza: zerar `whatsapp_instance_id` de funis `internal` existentes.

**2. `supabase/functions/_shared/evolution.ts`** (criação de lead via webhook)
- Em vez de pegar a primeira `pipeline_stages` da clínica, buscar:
  1. Funil `kind='sales'` com `whatsapp_instance_id = instanceId` → primeira etapa dele.
  2. Senão, funil `is_default=true` da clínica → primeira etapa.
  3. Senão, retornar `{ skipped: true, reason: "no-inbound-pipeline" }`.
- Gravar `pipeline_id` no lead (hoje só grava `stage_id`).

**3. UI — `NewPipelineDialog.tsx` e `KommoImportDialog.tsx`**
- Esconder/desabilitar seletor de instância WhatsApp quando `kind='internal'`.
- No seletor de instância (sales), filtrar instâncias **já usadas** por outro funil (ou marcá-las como "já vinculada a X") para evitar erro do índice único.

**4. `Kanban.tsx` / edição de funil** (se houver)
- Mesma regra: ao trocar `kind` para internal, limpar a instância.

## Resultado

- Apenas um funil "oficial de entrada" por número de WhatsApp.
- Funis de gestão interna 100% manuais.
- Outros funis de vendas existem normalmente, mas só recebem leads via importação ou criação manual.
