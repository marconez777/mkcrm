## Contexto

O projeto já tem **infra de e-mail completa e funcional** (multi-tenant por `clinic_id`): tabelas `email_templates/queue/logs/unsubscribes/campaigns/automations/domains/send_state`, edge functions `send-email`, `process-email-queue`, `resend-webhook` (com Svix), `email-unsubscribe`, `backfill-resend-events`, `dispatch-campaign`, `process-scheduled-campaigns`, `automations-tick`, RPCs `enqueue_email`, `generate_unsubscribe_token`, cron jobs, RLS, supressão, dedup, backoff de quota. Slug atual aceita kebab-case e fica mantido.

Este plano **NÃO recria** o que existe. Foca em (1) editor visual de templates, (2) páginas admin faltantes, (3) folders/segments novos, (4) pequenos ajustes (webhook secret, página `/unsubscribe` branded).

---

## Passo 1 — Secrets e settings

- Solicitar `RESEND_WEBHOOK_SECRET` (Svix) via `add_secret`.
- Verificar `app_settings.unsubscribe_hmac_secret` (já usado pelo `generate_unsubscribe_token`). Se faltar, gerar 32 bytes random e inserir.
- Verificar `app_settings.cron_service_role_key`. Se faltar, pedir ao usuário.

## Passo 2 — Migration (apenas adições)

Adicionar **sem mexer no que existe**:

- `email_template_folders` (id, clinic_id, name, parent_id, sort, timestamps) + RLS por clinic.
- `email_templates`: adicionar colunas `folder_id uuid`, `blocks jsonb default '[]'`, `preheader text`, `version int default 1`. Manter `html_body`, `subject`, etc. já existentes.
- `email_segments` (id, clinic_id, name, description, filters jsonb, active, timestamps) + RLS.
- Índice único parcial de dedup em `email_queue` (clinic_id, template_slug, lower(recipient_email), related_lead_table) WHERE status IN ('pending','processing') — se ainda não existir.
- RPC `cancel_pending_emails_for(_clinic_id, _email)` para uso em insert de unsubscribe.
- Trigger AFTER INSERT em `email_unsubscribes` chamando essa RPC.
- `ALTER PUBLICATION supabase_realtime ADD TABLE email_queue` (para a tela de Campaign mostrar progresso).

Nenhum drop, nenhum rename. Constraint de slug fica como está (kebab-case).

## Passo 3 — Libs do editor

- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-color @tiptap/extension-text-style dompurify @types/dompurify`.

## Passo 4 — Core do editor (`src/lib/email/`)

- `types.ts`: `EmailBlock` discriminated union. Tipos: `heading | paragraph | image | cta | divider | spacer | avatar | signature | youtube | columns | raw`.
- `blocksToHtml.ts`: render table-based (600px container, fundo `#f6f6f6`/`#ffffff`, padding 24px). Cada bloco vira `<tr><td>` com estilo inline. Imagens com `display:block;max-width:100%`. Footer com `{{unsubscribe_url}}` + endereço (de `app_settings.email_footer_address`). Detecta se o template já contém `{{unsubscribe_url}}` e não duplica.
- `htmlToBlocks.ts`: parser básico via `DOMParser` (client-only, guard `typeof window`). Mapeia `<h1-3>`, `<p>`, `<img>`, `<a class="btn">`, `<hr>` → blocos. Resto vira `raw`.
- `sanitize.ts`: wrapper DOMPurify com allowlist segura.
- `variables.ts`: lista de variáveis disponíveis `[name, first_name, unsubscribe_url, lead_id, ...]`.

## Passo 5 — Editor visual (`src/pages/email/EmailTemplateEditor.tsx`)

Rota nova: `/emails/templates/:id` (dentro do `EmailHub` ou rota standalone com voltar).

Layout 3 colunas:

```text
┌──────────┬─────────────────────┬──────────┐
│ Paleta   │  Canvas (600px)     │ Inspector│
│ (260px)  │  Sortable blocks    │  (340px) │
│ dnd-kit  │  toolbar flutuante  │  props   │
└──────────┴─────────────────────┴──────────┘
```

- Paleta: cards arrastáveis para cada `BlockType`.
- Canvas: `<SortableContext>` com blocos. Click seleciona; hover mostra ↑↓/duplicar/excluir.
- Inspector: form dinâmico por tipo. `paragraph` abre `<TipTapEditor/>` inline (bold/italic/link/color). Cores via `<input type="color">`.
- Toolbar superior: nome editável, slug (mask kebab-case), botões **Salvar / Pré-visualizar / Enviar teste / Ver HTML / Voltar**.
- Autosave debounce 2s em `localStorage` (chave `email-template-draft:${id}`).
- Modal "Enviar teste" pede e-mail e invoca `send-email` direto (force=true).
- Pré-visualizar: dialog full-screen com iframe `srcDoc={sanitize(blocksToHtml(blocks))}`.

## Passo 6 — Página Templates revisada (`EmailTemplates.tsx`)

- Sidebar de folders (drag entre folders via dnd-kit).
- Botão "Novo template" abre o editor com slug em branco.
- Botão "Nova pasta".
- Ações por linha: editar, duplicar, ativar/desativar, excluir.

## Passo 7 — Novas páginas dentro do `EmailHub`

Adicionar abas no `EmailHub.tsx`:

- **Fila** (`EmailQueue.tsx`): tabela paginada de `email_queue` com filtros (status/slug/email/período). Ações em massa: cancelar, reenviar (clona com `scheduled_at=now()`). Botão "Processar agora" → `supabase.functions.invoke('process-email-queue')`.
- **Logs** (`EmailLogs.tsx`): timeline de `email_logs` (eventos do Resend). Filtros e drill-down por e-mail.
- **Unsubscribes** (`EmailUnsubscribes.tsx`): lista + busca + export CSV + botão "Rodar backfill agora" (loop até 10 batches via `backfill-resend-events`).
- **Segments** (`EmailSegments.tsx`): builder de filtros (campo/operador/valor) + preview de contagem (query em `leads`).

## Passo 8 — Página pública `/unsubscribe`

Substitui o `Unsubscribe.tsx` atual (se existir, ajusta). Lê `?clinic=&email=&token=` da URL, chama edge function `email-unsubscribe` com `action: "validate"`, mostra botão "Confirmar descadastro". Após sucesso, mensagem branded com opção de reativar.

## Passo 9 — Polimentos

- `EmailHub` ganha abas: Dashboard | Templates | Campanhas | Automações | **Fila** | **Logs** | **Segments** | **Unsubscribes** | Config domínio.
- Dashboard: cards de enviados hoje/7d/30d, abertura, clique, fila pendente, falhas 24h, supressos + bar chart (recharts).
- Realtime em `email_queue` na aba Campanhas para progresso ao vivo.
- Toasts via `sonner` em todas as ações.

## Passo 10 — Webhook Resend

- Documentar endpoint `https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/resend-webhook` em uma seção do Settings do EmailHub, com botão de copiar.

## Passo 11 — Checklist final

Rodar:
- Slug kebab-case valida.
- Editor arrasta/reordena/edita/salva.
- "Enviar teste" chega no inbox.
- Webhook (após você cadastrar no Resend) marca delivered/opened.
- Bounce/complaint cancela pending.
- `/unsubscribe` valida token e descadastra.

---

## Detalhes técnicos

- **Multi-tenant preservado**: todas queries filtram por `current_clinic_id()`. Nada vira "global".
- **Slug**: regex de input no front `^[a-z][a-z0-9-]*$`. Sem mudança no DB.
- **Sem editar** `client.ts` ou `types.ts`.
- **Edge functions existentes ficam intactas** — apenas o front passa a chamar `process-email-queue` e `backfill-resend-events` via `functions.invoke` a partir das novas telas.
- **Timer types**: `ReturnType<typeof setTimeout>` no autosave.
- **DOMParser**: só dentro de `useEffect` ou handlers (client-only).
- **Bundle**: editor é code-split via `React.lazy` para não pesar o app principal.

## Arquivos criados/modificados

Novos:
- `src/lib/email/{types,blocksToHtml,htmlToBlocks,sanitize,variables}.ts`
- `src/components/email/editor/{Palette,Canvas,Inspector,TipTapEditor,blocks/*}.tsx`
- `src/pages/email/{EmailTemplateEditor,EmailQueue,EmailLogs,EmailUnsubscribes,EmailSegments}.tsx`
- `src/pages/Unsubscribe.tsx` (reescrito branded)

Editados:
- `src/pages/email/{EmailHub,EmailTemplates}.tsx`
- `src/App.tsx` (rota do editor)
- 1 migration (adições)
