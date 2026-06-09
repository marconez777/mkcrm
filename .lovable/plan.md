# Corrigir formatação indevida e patch no-op no Co-piloto

## Objetivo
Resolver dois problemas no fluxo de agentes:
1. O agente continua usando `**`/Markdown mesmo com instrução para não usar.
2. O Co-piloto marca como “aplicado” uma edição que não alterou nada.

## Diagnóstico
Encontrei duas causas prováveis no código atual:

### 1) O próprio Builder incentiva Markdown
- `supabase/functions/_shared/builder-system-prompt.ts`
  - `LEAD_CONTEXT_CLAUSE` contém `**...**`.
  - `CORE_RULES` também usa Markdown forte.
- `supabase/functions/ai-builder/index.ts:267-270`
  - A descrição da tool `submit_agent_prompt.system_prompt` pede explicitamente “Prompt completo em PT-BR, no estilo Markdown leve”.
- `supabase/functions/ai-builder/index.ts:346-358`
  - O prompt de geração manda estruturar em seções, e o ecossistema atual empurra o modelo para cabeçalhos/listas estilo Markdown.

Resultado: mesmo que o usuário escreva “não use caracteres especiais”, o Builder está ensinando o agente a produzir prompt com `**` e títulos `##`, então o runtime herda esse comportamento.

### 2) O Co-piloto considera “tem patch” mesmo quando a mudança é idêntica ao estado atual
- `supabase/functions/ai-builder/index.ts:1343-1371`
  - `has_changes` hoje é calculado por `Object.keys(sanitized).length > 0`.
  - Isso só verifica se vieram campos válidos, não se eles realmente diferem do agente atual.
- `src/components/agents/CopilotPanel.tsx:210-249`
  - `applyPatch()` aplica qualquer `proposal.changes` com `has_changes=true`.
  - Não existe comparação contra `agentSnapshot` antes de salvar nem bloqueio para diff vazio.
- `src/components/agents/PromptDiff.tsx`
  - O diff já consegue mostrar quando não houve mudança real, mas esse sinal não é usado para impedir “Aplicar”.

Resultado: o assistente pode devolver um `system_prompt` igual ao atual, o frontend ainda mostra patch e o usuário consegue “aplicar” um no-op.

## Plano
### 1) Parar de induzir Markdown no Builder
- Remover do Builder as instruções que pedem “Markdown leve”.
- Reescrever a cláusula obrigatória e as regras-base em texto puro, sem `**` e sem depender de `##`.
- Ajustar o prompt de geração para pedir explicitamente:
  - texto simples
  - sem `*`, `**`, `_`, crases, bullets decorativos
  - no máximo hífen simples para listas quando necessário

### 2) Forçar compatibilidade de formatação no prompt gerado e no patch do Co-piloto
- No `generate_system_prompt`, normalizar o prompt final para texto plano quando vier com marcação proibida.
- No `copilot_chat`, aplicar a mesma normalização no `system_prompt` proposto antes de retornar `changes`.
- Preservar a cláusula obrigatória do lead, mas em versão plain text para não reintroduzir `**` automaticamente.

### 3) Bloquear patch sem efeito real
- Comparar o patch sanitizado com o agente atual no backend antes de responder.
- Se os valores forem iguais ao estado atual, retornar `has_changes=false` e `changes={}` com mensagem dizendo que não houve alteração efetiva.
- Tratar comparação de:
  - `system_prompt` por string normalizada
  - números
  - booleanos
  - `tools` por conteúdo real da lista

### 4) Melhorar a UX do Co-piloto para no-op
- No frontend, esconder ou desabilitar “Aplicar” quando o patch vier vazio ou sem diff real.
- Mostrar feedback claro como “A sugestão não alterou nada no agente atual”.
- Evitar toast de sucesso para patch vazio.

### 5) Validar ponta a ponta
- Testar um pedido do tipo “não use caracteres especiais nem Markdown”.
- Confirmar que o prompt gerado não contém `**` e que a resposta do agente deixa de usar esse padrão.
- Testar um caso em que o Co-piloto proponha o mesmo texto atual e verificar que ele não pode mais ser aplicado como mudança.

## Detalhes técnicos
**Arquivos principais a alterar**
- `supabase/functions/_shared/builder-system-prompt.ts`
- `supabase/functions/ai-builder/index.ts`
- `src/components/agents/CopilotPanel.tsx`
- possivelmente `src/components/agents/PromptDiff.tsx` apenas se faltar um sinal explícito de “sem mudança” para a UI

**Observação importante**
Mesmo após corrigir o Builder, agentes já salvos com prompt antigo continuam carregando instruções com Markdown até serem regenerados ou editados. Na implementação, vou atacar o gerador e o Co-piloto primeiro, e também reforçar a proteção no fluxo de ajuste para evitar regressão.