# Corrigir erro do Test Lab e melhorar o UI

## Causa do erro

O agente recém-criado fica `enabled=false` (precisa ser publicado/ativado depois). O edge `ai-chat` faz:

```ts
if (!agentRow.enabled) return json({ error: "agent disabled" }, 400);
```

Isso bloqueia **qualquer** chamada, inclusive o Test Lab (que não passa `lead_id`). O `supabase.functions.invoke` no front engole o body e devolve só "Edge Function returned a non-2xx status code", por isso o usuário vê a mensagem genérica.

## O que vou fazer

### 1. Backend: `supabase/functions/ai-chat/index.ts`
- Permitir execução em modo "teste": quando **não há `lead_id`** (chamada do Test Lab), ignorar o check `enabled` (o `draft_mode` já é tratado dessa forma e só bloqueia quando há `lead_id`).
- Mantém o bloqueio em produção (com `lead_id`) intacto.

### 2. Frontend: `src/components/agents/TestLab.tsx` — extrair erro real
- Trocar o tratamento atual por leitura do body de erro do edge (`error.context.json()` quando disponível) e mostrar a mensagem PT-BR vinda do backend, usando `parseBuilderError` como fallback.
- Aplicar nas 3 abas (chat livre, gerar cenários, avaliar) — hoje só "Chat livre" mostra erro de forma confusa.

### 3. UI do "Testar agente" — refinamento da aba Chat livre

Hoje é só um `Textarea` + `Button` + bloco de output. Vou transformar em mini-chat com:

- **Histórico de mensagens** em bolhas (`user` à direita primary, `assistant` à esquerda muted), com markdown via `ReactMarkdown` (já é padrão no projeto).
- **Composer fixo embaixo** com `Textarea` (Enter envia, Shift+Enter quebra linha) e botão Enviar/Loader.
- **Indicador de "digitando..."** enquanto a resposta carrega.
- **Botão "Limpar conversa"** no header da aba.
- **Banner de erro** dedicado (vermelho suave com ícone) em vez de prefixo "Erro:" no output.
- Estado preservado durante a sessão do componente (só reseta ao trocar de agente ou clicar Limpar).
- Mantém envio do histórico completo no `messages` para o `ai-chat` (multi-turn já é suportado).

Tokens semânticos (`bg-primary`, `bg-muted`, `text-destructive` etc.) — sem cores hardcoded.

### 4. Documentação
- Atualizar `docs/features/BUILDER_AGENTS.md`: deixar claro que o Test Lab funciona com agente em rascunho/desativado, e que `enabled` controla só o atendimento real de leads.

## Fora de escopo
- Streaming de tokens no Test Lab (continua blocking — já é assim em produção).
- Persistir o histórico de teste (segue só em memória do componente).
- Mudanças nas abas Cenários/Avaliação além da correção do erro.

## Arquivos afetados
- `supabase/functions/ai-chat/index.ts` (edit)
- `src/components/agents/TestLab.tsx` (edit — refactor da aba Chat livre)
- `docs/features/BUILDER_AGENTS.md` (edit)
