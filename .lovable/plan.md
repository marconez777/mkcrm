# Forçar respostas em texto puro também no runtime

## Diagnóstico
Na última rodada eu sanitizei só o **Builder** (geração/edição de prompt). Mas o agente em produção/Test Lab é executado em `supabase/functions/ai-chat/index.ts`, que:

1. Monta `sysContent` apenas com `agentRow.system_prompt + planning + leadCtx + ragContext` (linha 650-657). **Não injeta nenhuma cláusula anti-markdown.**
2. Devolve `finalContent = choice.content` cru, sem sanitizar `**`, `##`, etc. (linha 747 e 823).

Resultado: mesmo agentes novos (gerados com o Builder já corrigido) podem voltar a usar `**` porque o modelo Gemini/GPT tende a formatar naturalmente em Markdown, e agentes **antigos** salvos antes da correção continuam sem a regra no prompt.

## Plano

### 1. Injetar cláusula anti-markdown no runtime (`ai-chat/index.ts`)
- Importar `NO_MARKDOWN_CLAUSE` de `_shared/builder-system-prompt.ts` (ou redeclará-la localmente).
- Acrescentar essa cláusula ao final de `sysContent` (depois da instrução de citação `[1][2]`), de forma que vale para **todos os agentes**, inclusive os legados.

### 2. Sanitizar a resposta final
- Adicionar um helper `stripMarkdown(text)` no runtime (mesmo regex do Builder: remove `**`, `__`, `*` isolados, `_` isolados, `` ` ``, e cabeçalhos `#`).
- Aplicar a `finalContent` logo após linha 747 e antes de:
  - persistir em `ai_messages`
  - registrar trace
  - retornar no JSON (`content: finalContent`)
- Preservar quebras de linha e listas com `- ` (WhatsApp aceita).

### 3. Não tocar em provedor/modelo
- Mantém o fluxo de tools, RAG, stages, etc. Mudança é só nas duas pontas (entrada do system prompt + saída do texto).

## Arquivos
- `supabase/functions/ai-chat/index.ts` — injetar cláusula em `sysContent`, sanitizar `finalContent`.
- (Opcional) `supabase/functions/_shared/builder-system-prompt.ts` — exportar `NO_MARKDOWN_CLAUSE` e `stripMarkdown` se ainda não estiverem exportados, para reuso.

## Validação
- Rodar no Test Lab a mesma pergunta sobre cetamina e confirmar que a resposta não contém `**`, `##`, `__`.
- Conferir que listas com `- ` continuam aparecendo.
- Conferir que citações `[1]`, `[2]` ainda funcionam.

## Observação
Isto resolve agentes antigos sem precisar regenerar o prompt. Para o longo prazo, a correção do Builder feita antes continua valendo para novos agentes.