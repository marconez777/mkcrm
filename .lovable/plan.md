# Mover todos os leads de UMA coluna para outra coluna (de qualquer funil)

Hoje existe "mover todos do funil inteiro" (no `EditPipelineDialog`). Vou adicionar o equivalente **por coluna**.

## O que muda

### 1. Novo item no menu da coluna do Kanban
No menu **⋮** de cada coluna (ao lado de "Editar etapa" / "Excluir etapa"), adicionar:
- **"Mover todos os leads desta coluna →"**

### 2. Novo diálogo `MoveColumnLeadsDialog`
Arquivo novo: `src/components/kanban/MoveColumnLeadsDialog.tsx`.

Campos:
- Mostra contagem: *"Esta coluna tem N leads."*
- Select **Funil de destino** (lista todos os funis da clínica, inclusive o atual).
- Select **Etapa de destino** (carrega stages do funil escolhido, exclui a própria coluna de origem se for o mesmo funil).
- Botão **"Mover N leads"** com loading.
- Toast de sucesso + `onChanged()` para refrescar o Kanban.

Lógica (mesmo padrão do `EditPipelineDialog.moveAllLeads`):
```ts
await supabase.from("leads")
  .update({ pipeline_id: targetPipelineId, stage_id: targetStageId })
  .eq("stage_id", sourceStageId);
```

### 3. Integração
No componente que renderiza as colunas do Kanban (`src/pages/Kanban.tsx` — header da coluna com o menu ⋮), importar e abrir o novo diálogo com `sourceStageId`, `sourceStageName`, e a lista de funis/instâncias já disponível no contexto.

## Regras / proteções

- Esconder a opção para `professional` (mesma regra do "mover funil inteiro").
- Bloquear botão se `targetStageId` vazio ou igual ao `sourceStageId`.
- Se contagem = 0, mostrar opção desabilitada com tooltip "Coluna vazia".
- Não muda nada do lead além de `pipeline_id` + `stage_id` (triggers de `stage_ai_defaults` já cuidam do resto).

## Fora do escopo

- Não mexer no agente classificador, automações, ou docs agora — fica para o roadmap salvo.
- Não criar histórico extra: `lead_stage_history` já é populado por trigger existente.

## Arquivos tocados

- `src/components/kanban/MoveColumnLeadsDialog.tsx` (novo)
- `src/pages/Kanban.tsx` (adicionar item de menu + estado do diálogo)
