# Plano — Evolução do módulo de Conversas

Hoje o `/inbox` é uma lista simples + drawer modal. Vamos transformar numa central de atendimento estilo WhatsApp Web / Chatwoot, sem perder a leveza atual.

## 1. Novo layout — 3 painéis fixos

```text
┌──────────────┬────────────────────────────┬──────────────┐
│  Lista de    │   Chat (mensagens)         │  Contexto    │
│  conversas   │                            │  do lead     │
│  + filtros   │   header + bubbles + input │  (etapa,     │
│              │                            │   tags,      │
│  280px       │   flex-1                   │   notas)     │
│              │                            │  320px       │
└──────────────┴────────────────────────────┴──────────────┘
```

- Acaba o `Sheet` overlay no inbox (mantemos o drawer só no Kanban).
- Painel da direita é colapsável (`>` no header) para telas menores.
- Em viewport < 1024px: vira navegação por etapas (lista → chat → contexto) com botão "voltar".

## 2. Lista de conversas — mais útil

- **Filtros rápidos no topo**: Todas / Não lidas / Minhas / Sem atribuição.
- **Filtro por etapa do pipeline** (chips horizontais) e **por tag**.
- **Ordenação**: mais recente / não lidas primeiro / mais antigas.
- **Busca**: já existe, manter mas debounce 200ms; também busca em conteúdo da última mensagem.
- Cada item ganha:
  - badge da **etapa atual** (cor da stage),
  - **avatar do atendente** atribuído,
  - ícone do tipo da última mensagem (texto / imagem / áudio),
  - status de envio quando última msg foi nossa (✓ enviado, ✗ falhou).
- **Hover actions**: marcar não lida, arquivar (soft-flag), atribuir atendente.
- **Botão "Nova conversa"** (+): modal pedindo telefone + mensagem inicial → chama `evolution-send`.

## 3. Painel central — chat melhorado

- **Separadores de data** ("Hoje", "Ontem", "12 mar").
- **Agrupamento de bolhas** consecutivas do mesmo autor (sem repetir hora em todas).
- **Status ticks** estilo WhatsApp: relógio (pending), ✓ (sent), ✓✓ (delivered/read quando vier do webhook).
- **Reply preview** quando a mensagem do Evolution tiver `contextInfo.quotedMessage`.
- **Mídia**: render de imagem inline (se `media_url`), player de áudio, link clicável para documento. (Mantemos placeholder `[image]` quando sem URL — não vamos subir storage agora.)
- **Auto-scroll inteligente**: só rola se já estava no fim; senão mostra pílula "↓ N novas mensagens".
- **Indicador de digitação** (placeholder visual, ativado quando webhook `presence.update` chegar — adicionamos handler).
- **Highlight de mensagens não lidas**: linha "Novas mensagens" antes da primeira não lida.

## 4. Composer (caixa de envio)

- **Auto-resize** do textarea (já é `Textarea`, melhorar limites).
- **Atalho** `Ctrl/Cmd+Enter` para enviar (mantém Enter para enviar, Shift+Enter quebra linha).
- **Emoji picker** (`emoji-mart` ou implementação leve com lista curada).
- **Quick replies / Respostas rápidas**: comando `/` abre menu com mensagens salvas.
  - Nova tabela `quick_replies (id, shortcut, content, created_at)`.
  - CRUD em **Configurações → Respostas rápidas**.
- **Variáveis** nas quick replies: `{{nome}}`, `{{primeiro_nome}}` interpolados ao inserir.
- **Contador de caracteres** discreto.
- Botão de anexo desabilitado com tooltip "Em breve" (deixamos pronto pra fase 2 com Storage).

## 5. Painel direito — contexto do lead

Versão enxuta da aba "Detalhes" de hoje, sempre visível:
- Avatar, nome editável inline, telefone (com botão copiar).
- **Etapa do pipeline** (Select) — muda na hora.
- **Atendente atribuído** (Select).
- **Valor do negócio** inline.
- **Tags** com chips removíveis + input para adicionar.
- **Notas** (textarea com auto-save debounce 800ms).
- **Histórico curto**: últimas 5 mudanças de etapa (precisa de tabela `lead_events` — cria agora).
- Botão "Excluir lead" no final.

## 6. Notificações & UX

- **Som curto** (Web Audio, sem asset externo) ao chegar mensagem nova quando aba não está focada.
- **Title flash** (`(3) Zappy CRM`) com contagem global de não lidas.
- **Notificação do navegador** (com permissão pedida no primeiro uso, via toggle em Configurações).
- **Atalhos de teclado**: `J/K` próxima/anterior conversa, `/` foca busca, `Esc` fecha contexto.

## 7. Backend / dados

Migrations novas:
- `quick_replies` (id, shortcut text unique, content text, created_at).
- `lead_events` (id, lead_id, type text, payload jsonb, created_at) + trigger em `leads` que registra mudança de `stage_id` e `attendant_id`.
- Coluna `leads.archived_at timestamptz null` (soft archive).
- Coluna `messages.delivery_status text` (`sent|delivered|read|failed`) — separa do `status` interno (`pending|sent|failed`); webhook atualiza quando vier `messages.update`.
- Coluna `messages.reply_to_external_id text` para preview de citação.

Edge functions:
- Atualizar `evolution-webhook` para processar `messages.update` (status delivered/read), `presence.update` (digitando) e `contextInfo.quotedMessage` (reply).
- Endpoint `evolution-send` aceita `quoted_external_id` opcional.

## 8. Detalhes técnicos

- Componentes novos: `inbox/ConversationList.tsx`, `inbox/ConversationListItem.tsx`, `inbox/Filters.tsx`, `inbox/ChatPane.tsx`, `inbox/MessageBubble.tsx`, `inbox/Composer.tsx`, `inbox/QuickReplyMenu.tsx`, `inbox/EmojiPicker.tsx`, `inbox/ContextRail.tsx`, `inbox/NewConversationDialog.tsx`.
- `LeadDrawer.tsx` continua existindo só para o Kanban.
- Hook novo `useConversations({filter, search, sort})` encapsula query + realtime + ordenação derivada.
- Hook novo `useTypingPresence(leadId)` para indicador.
- Hook `useUnreadTitle()` global aplicado em `App.tsx`.
- Som: `new AudioContext()` + oscillator curto (sem dependência nem asset).
- Em mobile: `useMediaQuery('(min-width: 1024px)')` controla painéis.
- Estado de "conversa selecionada" via URL `/inbox/:leadId` para deep-link e back/forward do navegador.

## 9. Fora de escopo (próximas fases)

- Upload real de mídia (precisa Storage bucket + signed URLs).
- Login multi-usuário (continua sem auth, atendentes são apenas labels).
- Relatórios / SLA / tempo de resposta.
- Chatbot / IA de sugestão de resposta.

Ao aprovar, sigo nessa ordem: migrations → webhook update → componentes do inbox → composer/quick replies → contexto → notificações.