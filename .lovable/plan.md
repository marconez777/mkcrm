
## Visão geral

Auditoria nas três áreas escolhidas (Inbox, Kanban, IA/Automações) com três frentes: **(A) substituir todos os `window.prompt/confirm` nativos por modais**, **(B) polimento de UX** e **(C) confiabilidade**. Tudo incremental — nada quebra o que já funciona.

## A. Modais para substituir diálogos nativos

Hoje o app usa `prompt()`/`confirm()` do navegador em 11 pontos. Visualmente quebram a estética e em mobile ficam ruins. Vou criar dois componentes reutilizáveis e trocar cada uso:

1. `ConfirmDialog` (já temos `AlertDialog` shadcn) — wrapper com props `title/description/confirmLabel/destructive/onConfirm`.
2. `PromptDialog` — input simples com label, valor inicial, validação de obrigatoriedade.

Pontos a converter:
- **Inbox**
  - `ContextRail.tsx` — excluir lead (destrutivo, exige digitar "EXCLUIR" para confirmar).
  - `ConversationList.tsx` — criar "saved view" (PromptDialog).
- **Kanban**
  - `PipelineSidebar.tsx` e `PipelineSwitcher.tsx` — renomear funil (PromptDialog) e excluir funil (ConfirmDialog destrutivo).
- **Páginas**
  - `Automations.tsx`, `Templates.tsx`, `Agents.tsx`, `LeadDrawer.tsx`, `SettingsCustomFields.tsx` — confirmação de exclusão.

## B. Polimento de UX

### Inbox
- **Composer**: indicar tamanho/limite restante quando texto > 2.000 chars; toast claro quando arquivo > 16 MB; suporte a arrastar-e-soltar arquivo direto na área de chat (drop zone com overlay).
- **ChatPane**: botão "ir para a última mensagem" quando o usuário rola pra cima e chega nova msg (já há scroll auto, mas falta o botão flutuante com badge de novas).
- **ConversationList**: skeleton mais suave durante paginação; destacar visualmente lead com `marked_unread` separado de `unread_count`.

### Kanban
- **PipelineOverview / Kanban**: feedback visual ao arrastar card entre etapas (sombra + placeholder), e toast de "movido para X" com botão **Desfazer** (10s).
- **Edição inline** do nome de etapa (duplo-clique) em vez de abrir dialog para um único campo.
- **Contadores por etapa**: total + valor somado de `deal_value` no header de cada coluna.

### IA / Automações
- **Agents.tsx**: badge de status (ativo/treinando/erro) consistente; botão "Testar" abre um drawer de chat de teste (já existe parcialmente — uniformizar).
- **Automations.tsx**: confirmação visual ao salvar; preview do que vai acontecer ("Quando X → Faz Y") em linguagem natural no card.

## C. Confiabilidade

1. **Edge functions** — padronizar tratamento de erro: toda `evolution-*` retornar `{ ok, error, code }` consistente; logar `client_message_id` em todos os caminhos para correlação.
2. **`evolution-send-media`** — adicionar retry exponencial (já existe em `evolution-send`), validar mime/tamanho server-side antes de chamar API.
3. **Realtime** — em `ChatPane`, garantir cleanup de canais ao trocar lead rapidamente (verificar memory leak potencial).
4. **Webhook idempotência** — `webhook_dedup` já existe; confirmar uso em `MESSAGES_UPSERT` para evitar processar duplicatas quando Evolution reenvia.
5. **Loading states ausentes** — vários botões não desabilitam durante ação (ex.: "Excluir agente"). Adicionar `disabled + spinner`.

## Plano de execução (ordem sugerida)

```text
1. Criar src/components/ui/confirm-dialog.tsx + prompt-dialog.tsx
2. Substituir os 11 prompt/confirm nativos
3. Inbox: drag-drop de arquivo no ChatPane + botão "novas mensagens"
4. Kanban: contadores por etapa + edição inline + toast com Desfazer
5. Confiabilidade: retry no send-media + cleanup realtime + loading states
6. IA: uniformizar status de agentes + preview legível em automações
```

## Arquivos afetados (estimativa)

- **Novos**: `src/components/ui/confirm-dialog.tsx`, `src/components/ui/prompt-dialog.tsx`
- **Editados**: `ContextRail.tsx`, `ConversationList.tsx`, `PipelineSidebar.tsx`, `PipelineSwitcher.tsx`, `Automations.tsx`, `Templates.tsx`, `Agents.tsx`, `LeadDrawer.tsx`, `SettingsCustomFields.tsx`, `ChatPane.tsx`, `Composer.tsx`, `Kanban.tsx`, `evolution-send-media/index.ts`

## Fora do escopo (próximas iterações)

- Gravação de áudio pelo microfone no Composer.
- Envio de múltiplos arquivos numa só mensagem.
- Métricas avançadas de IA (avaliação automática de respostas).
- Testes E2E.

Aprove para eu aplicar — posso fazer tudo de uma vez ou dividir em etapas (1+2 primeiro, depois 3-6). Me diga sua preferência.
