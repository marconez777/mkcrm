# PR 9 — Pins, Resposta humana e Saúde da KB

Três features no agente Alfred, agrupadas em uma única entrega.

---

## 1. Pin de mensagens problemáticas

Para o super admin marcar uma resposta ruim/bug e revisar depois (refinar prompt, melhorar KB, etc.).

**Onde marca**
- No **Monitor ao vivo** e no **viewer de thread** do telemetry: botão de "Fixar" em cada mensagem do assistente.
- Modal pequeno para anotar o motivo (opcional, 1 linha).

**Onde revisa**
- Nova card "Mensagens fixadas para revisão" no painel admin, com: usuário, rota, trecho da resposta, motivo, e link para abrir a thread completa.
- Botão "Desfixar" e "Marcar como resolvido".

**Banco**
- Adiciona colunas em `support_chat_messages`: `pinned_at timestamptz`, `pinned_by uuid`, `pinned_note text`, `pinned_resolved boolean`.
- Apenas super admin pode editar; policy nova com `is_super_admin()`.

---

## 2. Resposta humana (takeover do admin)

Admin assume a conversa e responde manualmente; a IA fica em silêncio até o admin liberar.

**Fluxo**
- No monitor/viewer, cada thread ganha botão **"Assumir conversa"**.
- Ao assumir: insere `taken_over_by`/`taken_over_at` em `support_chat_threads` e uma mensagem `system` no fim da thread dizendo "Suporte humano entrou na conversa".
- Enquanto estiver em takeover, o edge function `support-chat` recusa novas chamadas (retorna 423 com mensagem amigável "Um humano está respondendo, aguarde."). O FAB exibe esse estado.
- Admin envia mensagens via novo edge function `support-admin-reply` → insere registro com `role='assistant'` e flag `tool_name='human'` (não altera o check constraint).
- Botão **"Devolver pra IA"** limpa o takeover e a IA volta a responder.

**No FAB do usuário**
- Subscription realtime em `support_chat_messages` da thread atual (já tem publicação ligada).
- Banner discreto no topo do chat: "Você está falando com a equipe de suporte" quando `taken_over_at` está setado.
- Mensagens com `tool_name='human'` ganham avatar/cor diferenciado.

**Banco**
- Adiciona em `support_chat_threads`: `taken_over_by uuid`, `taken_over_at timestamptz`.
- Policy de UPDATE em threads: já permite super admin via `is_super_admin()`.

---

## 3. Indicador de saúde da KB

Avisa quando a KB embarcada nas edge functions difere do que está sincronizado no banco.

**Como funciona**
- O manifesto (`support-kb-manifest.ts`) é gerado no build com `{ path, content }` de cada `.md`.
- Novo edge function `support-kb-status` (super admin only) que:
  - Calcula `sha256` de cada arquivo do manifesto.
  - Lê de `support_documents` o conjunto de hashes únicos por `path` (já existe coluna `hash`).
  - Retorna: `{ in_sync: number, stale: string[], missing: string[], deleted: string[] }` onde:
    - `stale` = path existe nos dois mas hash do manifesto não bate.
    - `missing` = path está no manifesto e não existe no banco.
    - `deleted` = path está no banco e não no manifesto.
- O painel admin chama esse endpoint ao carregar.
- Banner amarelo no card "Base de Conhecimento": "⚠ 3 arquivos mudaram desde a última sync — re-sincronizar".
- A lista de docs ganha coluna de status (badge "atualizado", "desatualizado", "novo", "removido").

---

## Detalhes técnicos

### Migrations (em uma única migration)
- `ALTER TABLE support_chat_messages ADD COLUMN pinned_at timestamptz, pinned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, pinned_note text, pinned_resolved boolean NOT NULL DEFAULT false;`
- `CREATE INDEX support_messages_pinned_idx ON support_chat_messages (pinned_at) WHERE pinned_at IS NOT NULL;`
- Nova policy `support_messages_super_admin_pin` para `UPDATE` apenas dos campos de pin (super admin).
- `ALTER TABLE support_chat_threads ADD COLUMN taken_over_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, taken_over_at timestamptz;`

### Edge Functions
- **`support-admin-reply`** (novo) — valida super admin, insere mensagem `role='assistant'` com `tool_name='human'`, atualiza `updated_at` da thread.
- **`support-kb-status`** (novo) — calcula diff manifest × DB.
- **`support-chat`** (edição) — antes de chamar OpenAI, lê `taken_over_at` da thread; se setado, retorna 423.

### Frontend
- `SupportLiveMonitor.tsx` — botão de pin + botão de takeover por mensagem/thread.
- `SupportTelemetry.tsx`/`ThreadViewer` — mesmos botões + campo de resposta quando em takeover.
- Novo `SupportPinsCard.tsx` — lista de pins ativos no painel admin.
- `SupportPanel.tsx` — banner + coluna de status na tabela de KB; consome `support-kb-status`.
- `SupportChatFab.tsx` — subscription realtime na thread aberta; banner "humano respondendo"; trata `423` com toast amigável.

### Sem mudança
- Tipos do Supabase serão regerados após a migration; nenhum arquivo `client.ts`/`types.ts` editado manualmente.
- Sem rate-limit, sem alteração de pricing/cap.

---

## O que entrega
- Super admin consegue marcar e revisar respostas problemáticas.
- Super admin pode assumir e responder manualmente qualquer conversa em curso.
- Super admin vê imediatamente quando a KB do código está fora de sync com o banco.
