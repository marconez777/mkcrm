# Fase 2 — Diferenciação (backend + IA)

Migra o que era local na Fase 1 para o banco e adiciona recursos que diferenciam o CRM da concorrência (Kommo/Umbler).

## 1. Notas internas no banco (substitui localStorage)

**Migration** — nova tabela:
```sql
create table public.lead_internal_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  author_id uuid,
  author_name text,
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.lead_internal_notes enable row level security;
create policy "authenticated_all" on public.lead_internal_notes for all to authenticated using (true) with check (true);
create index on public.lead_internal_notes(lead_id, created_at desc);
alter publication supabase_realtime add table public.lead_internal_notes;
```

- `src/lib/internal-notes.ts`: trocar localStorage por Supabase (manter mesma API `list/add/remove` para não quebrar `ChatPane`).
- Migrar notas locais existentes na primeira leitura (one-shot).
- Realtime subscribe por `lead_id` no `ChatPane`.

## 2. Tarefas / follow-ups por lead

**Migration**:
```sql
create table public.lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  title text not null,
  due_at timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
-- RLS authenticated_all + index (lead_id, due_at)
```

- Novo painel **"Tarefas"** dentro do `LeadDetailsPanel` (lista + botão "Nova tarefa" com data/hora).
- Badge no header do chat: "⏰ 2 vencendo hoje".
- Página `/tasks` simples agregando todas tarefas em aberto, ordenadas por vencimento, agrupadas por Hoje / Amanhã / Atrasadas.

## 3. Mensagens agendadas

**Migration**:
```sql
create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  content text not null,
  send_at timestamptz not null,
  status text not null default 'pending', -- pending|sent|failed|canceled
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
-- RLS authenticated_all
```

- No `Composer`: ícone de relógio ao lado do botão Enviar → popover com date/time picker → grava em `scheduled_messages`.
- Edge function nova **`scheduled-dispatcher`**: pega `pending` com `send_at <= now()`, chama `evolution-send`, marca `sent`/`failed`.
- Cron via `pg_cron` rodando a cada minuto (insert tool, não migration, pois usa anon key).
- Lista de agendamentos pendentes no `LeadDetailsPanel` com ação cancelar.

## 4. Transcrição de áudio (Lovable AI)

- Edge function nova **`transcribe-audio`**: recebe `messageId`, baixa `media_url`, envia para `google/gemini-2.5-flash` (multimodal audio), grava transcrição em `messages.raw->>'transcript'`.
- No `ChatPane`, mensagens `audio` ganham botão **"Transcrever"** (ou auto-transcreve sob flag de settings). Mostra texto abaixo do player.
- Cache: se `raw.transcript` existe, exibe direto.

## 5. Ações em lote na lista de conversas

- `ConversationList`: modo seleção (checkbox aparece em hover; Shift+click range).
- Barra inferior flutuante: **Marcar como lida**, **Atribuir atendente**, **Mover para etapa**, **Arquivar**, **Aplicar tag**.
- Atualização otimista + um único batch update via Supabase.

## 6. Foto de perfil do WhatsApp

- Edge function **`fetch-wa-avatar`**: recebe `leadId`, chama Evolution `/chat/fetchProfilePictureUrl/{instance}`, salva URL em `leads.avatar_url`.
- Trigger client-side: ao abrir conversa sem `avatar_url`, dispara fetch em background (debounced, 1x por lead por sessão).

## Resumo técnico

**Migrations (3)**: `lead_internal_notes`, `lead_tasks`, `scheduled_messages` — todas com RLS `authenticated_all`, sem foreign keys (padrão do projeto).

**Edge functions novas (3)**: `scheduled-dispatcher`, `transcribe-audio`, `fetch-wa-avatar`. Reusa `evolution-send` existente.

**Cron**: 1 job pg_cron a cada minuto invocando `scheduled-dispatcher`.

**Frontend principal**:
- `src/lib/internal-notes.ts` (refatorar p/ DB)
- `src/components/inbox/ChatPane.tsx` (transcrição, agendamento UI hooks)
- `src/components/inbox/Composer.tsx` (botão agendar)
- `src/components/inbox/LeadDetailsPanel.tsx` (abas Tarefas + Agendadas)
- `src/components/inbox/ConversationList.tsx` (modo seleção + barra de ações)
- `src/components/inbox/ScheduleMessageDialog.tsx` (novo)
- `src/components/inbox/TaskDialog.tsx` (novo)
- `src/components/inbox/BulkActionsBar.tsx` (novo)
- `src/pages/Tasks.tsx` (novo) + rota em `App.tsx` + item no `AppShell`
- `src/hooks/useWaAvatar.ts` (novo)

**Lovable AI**: transcrição usa `google/gemini-2.5-flash` (sem custo de chave para o usuário).

## Ordem de execução
1. Migrations + refator de notas (continuidade da Fase 1).
2. Tarefas (CRUD + painel + página).
3. Agendamento (tabela + dialog + edge function + cron).
4. Transcrição (edge function + UI).
5. Ações em lote.
6. Avatar WhatsApp.

Aprove para eu sair do plan mode e implementar tudo em sequência.