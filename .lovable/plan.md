# Fase 1 — Fundação técnica

Risco de segurança aceito pelo usuário: Auth/RLS fica para depois. Tabelas seguem com policies `public_all` por enquanto.

## Objetivo
Preparar a base que todas as fases seguintes (AI agents, automações, cron, vetores) vão precisar — sem mexer ainda em features de produto.

## Escopo

### 1.1 Extensões do banco (migration)
Habilitar via SQL:
- `pg_cron` — para agendar `evolution-health` e futuras automações.
- `pg_net` — para `cron.schedule` chamar edge functions via HTTP.
- `vector` (pgvector) — pré-requisito da Fase 2 (RAG/embeddings); habilitar agora evita migration extra depois.
- `pgcrypto` — já vem, só garantir.

### 1.2 Multi-instância de WhatsApp
Hoje `settings` (id=1) guarda **uma** instância Evolution. Migrar para suportar várias:

- Nova tabela `whatsapp_instances`:
  - `id uuid pk`
  - `name text not null` (apelido p/ UI)
  - `evolution_url text not null`
  - `evolution_api_key text not null`
  - `evolution_instance text not null`
  - `webhook_token text not null default encode(gen_random_bytes(24),'hex') unique`
  - `connection_state text`, `last_health_check timestamptz`, `webhook_ok bool`, `webhook_last_error text`, `last_poll_at timestamptz`, `webhook_last_set_at timestamptz`
  - `is_default bool default false` (uma por padrão)
  - `created_at`, `updated_at` (+ trigger `set_updated_at`)

- `leads.whatsapp_instance_id uuid` (nullable; backfill com a instância default).
- `messages` herda a instância via lead — não precisa coluna nova.

- Backfill: criar 1 linha em `whatsapp_instances` a partir de `settings` atual, marcar `is_default=true`, popular `leads.whatsapp_instance_id` com esse id.

- Manter `settings` para configs **globais** (futuras flags de IA, limites, etc.); remover dali os campos de Evolution num passo posterior (não agora, p/ não quebrar UI de Settings).

### 1.3 Índices de performance
Antecipar gargalos de Inbox/Kanban e das próximas fases:
- `messages (lead_id, timestamp desc)` — paginação do chat.
- `messages (external_id)` único parcial onde `external_id is not null` — ingestão idempotente.
- `messages (client_message_id)` único parcial onde não nulo — dedupe no send.
- `leads (archived_at, last_message_at desc)` — lista da Inbox.
- `leads (stage_id, position)` — Kanban.
- `webhook_events (received_at desc)` — auditoria/cleanup.

### 1.4 Edge functions: ler instância pelo lead
Refator de `evolution-send` e `evolution-sync-lead` para:
1. Carregar `lead.whatsapp_instance_id`.
2. Buscar credenciais em `whatsapp_instances` (fallback: instância `is_default`).
3. Substituir `loadSettings()` em `_shared/evolution.ts` por `loadInstance(instanceId?)`.

`evolution-webhook` já usa `?token=` — passa a procurar o token em `whatsapp_instances` em vez de `settings`. O `lead` ingerido herda o `whatsapp_instance_id` correspondente.

`evolution-health` passa a iterar **todas** as instâncias (loop), atualizando estado em cada linha.

### 1.5 Cron job (pg_cron)
Agendar via insert SQL (não migration — contém URL/anon key):
- `evolution-health` a cada 60s.

## Fora do escopo desta fase
- Auth / RLS endurecida (adiado conforme aceite do usuário).
- Tabelas de IA, agentes, automações, embeddings (Fases 2+).
- UI de gerenciar múltiplas instâncias (entra na Fase 1.x seguinte ou junto da Fase 5).

## Resultado ao final da Fase 1
- Banco pronto para vetores e cron.
- Sistema funciona com N instâncias Evolution simultâneas (apenas 1 ativa por enquanto, mas a infra existe).
- Health check rodando automaticamente a cada minuto.
- Índices em produção evitam regressão de performance quando o volume crescer.

Confirma que sigo com esse recorte? Se quiser que eu **adie multi-instância** e faça só extensões + índices + cron, é só dizer.
