# Auditoria docs × sistema — pendências encontradas

Após ler todas as docs (`README` + 8 guias) e cruzar com o código real (edge functions, schema, RPCs do Postgres), encontrei várias divergências factuais. A documentação está bem estruturada, mas alguns trechos descrevem comportamento que **não corresponde ao código atual**, o que pode confundir devs e atrapalhar debug.

## Divergências críticas (corrigir)

### 1. Body de `evolution-send` está errado
Docs (`EDGE_FUNCTIONS.md`, `EVOLUTION.md`) mostram:
```json
{ "lead_id", "content", "client_message_id", "reply_to_external_id" }
```
Código real espera: `text` (não `content`) e `quoted_external_id` (não `reply_to_external_id`).

### 2. Fluxo de auto-reply mal descrito
Docs dizem que `ai-auto-reply` "lê pendências vencidas e responde". **Não.** O código real:
- `evolution-webhook` chama `ai-auto-reply` fire-and-forget para **cada mensagem nova**.
- `ai-auto-reply` só **enfileira/atualiza** `pending_replies` (debounce).
- Quem realmente processa a fila e envia a resposta é o **`scheduled-dispatcher`** (cron 1 min), que também despacha `scheduled_messages`.

Isso muda `ARCHITECTURE.md`, `AI.md`, `EDGE_FUNCTIONS.md` e `MANUAL.md`.

### 3. `verify_jwt` na tabela está errado
Conforme `supabase/config.toml`, têm `verify_jwt = false`: `ai-auto-reply`, `ai-chat`, `ai-embed`, `ai-ingest-*`, `ai-assist`, `automations-tick` (além das já documentadas evolution-*). A tabela do `EDGE_FUNCTIONS.md` marca todas essas como `true`. `AUTH.md` também afirma "a maioria exige JWT".

### 4. RPC inexistente referenciada
`DATABASE.md` e `AI.md` falam em função `hybrid_search`. No banco existe **`match_chunks_hybrid`** (é a que o código usa em `_shared/rag.ts`). Não existe nenhum `hybrid_search`.

### 5. Automações: triggers/actions documentadas não existem
`AUTOMATIONS.md` lista 7 triggers e 11 actions. O código (`automations-tick`) só implementa:
- **Triggers**: `no_reply_after`, `stage_idle`.
- **Actions**: `ai_followup`, `move_stage`, `send_template`.

Itens como `message_received`, `tag_added`, `add_tag`, `webhook`, `enable_ai`, etc. **não existem**. Também falta documentar a coluna real `cooldown_hours` e o esquema real (`trigger_type`, `trigger_config`, `action_type`, `action_config`).

### 6. Esquema de `ai_usage` divergente
Docs falam em `prompt_tokens`, `completion_tokens`, `cost`. Real: `input_tokens`, `output_tokens`, `total_tokens`, `operation`, `status`, `tools_called`, `replied`, `error`. Sem coluna `cost`.

### 7. `agent_traces` documentado de forma incompleta
Tem campos importantes não citados: `run_id`, `step`, `kind`, `name`, `tokens_in/out`, `latency_ms`, `payload`, `error`.

### 8. Função `sync_lead_pipeline_id` não documentada
Existe no banco e não aparece em `DATABASE.md` (mantém `pipeline_id` consistente com `stage_id`).

## Divergências menores

- `EDGE_FUNCTIONS.md` classifica `transcribe-audio` em "Inbox" mas descreve em "Jobs auxiliares" — uniformizar.
- `README.md` lista scripts `npm run …`; o projeto usa **bun** (lockfile `bun.lockb`). Trocar exemplos.
- `MANUAL.md` cita "Refresh manual" no chat — confirmar se botão existe; código atual não tem botão de refresh manual no `ChatPane.tsx` (vale verificar).
- `EVOLUTION.md` cita endpoint `POST /webhook/set/{instance}` — confirmar se ainda é usado (procurar no código real).
- `DATABASE.md` afirma "Validação por trigger em vez de CHECK" — não há triggers de validação relevantes; remover ou substituir pela lista real (`set_updated_at`, `set_stage_changed_at`, `log_lead_changes`, `sync_lead_pipeline_id`, `increment_unread`).

## Pendências de qualidade do sistema (não-doc)

1. **Auto-reply duplicado**: `evolution-webhook` chama `ai-auto-reply` fire-and-forget E o `scheduled-dispatcher` roda a cada minuto — ok, mas hoje **o webhook não dispara o `scheduled-dispatcher`**, então a primeira resposta sempre tem latência mínima de até 1 min + debounce. Considerar disparar `scheduled-dispatcher` (ou um endpoint dedicado de "flush") quando `pending_replies.run_at <= now()`.
2. **`webhook_dedup` sem cron de limpeza**: a tabela tem `expires_at` mas não existe `cleanup_webhook_dedup()` agendado. Só `cleanup_webhook_events` está definida.
3. **`settings` legacy**: o código ainda referencia `settings.webhook_token` em alguns pontos. Remover totalmente após confirmar migração para `whatsapp_instances`.
4. **RLS uniforme `authenticated_all`**: documentar explicitamente que esse modelo é **single-tenant** e qualquer publicação multi-cliente exige refazer policies (já mencionado em `AUTH.md`, mas vale destacar como **AVISO** no topo do `DATABASE.md`).

## Plano de ação (quando aprovado, executo em modo default)

1. Atualizar `EDGE_FUNCTIONS.md`:
   - Corrigir tabela de `verify_jwt`.
   - Corrigir body do `evolution-send`.
   - Reescrever a seção `ai-auto-reply` (apenas enfileira) e `scheduled-dispatcher` (processa fila + agendadas).
2. Atualizar `AI.md` e `ARCHITECTURE.md` com o fluxo real (webhook → ai-auto-reply enfileira → scheduled-dispatcher consome).
3. Atualizar `AUTH.md` com a lista correta de functions sem JWT.
4. Atualizar `DATABASE.md`:
   - Trocar `hybrid_search` → `match_chunks_hybrid`.
   - Listar `sync_lead_pipeline_id`.
   - Corrigir esquema de `ai_usage` e `agent_traces`.
   - Adicionar aviso "single-tenant" no topo.
5. Atualizar `AUTOMATIONS.md` para refletir só os 2 triggers e 3 actions reais, com schema `trigger_type/trigger_config/action_type/action_config/cooldown_hours`.
6. Atualizar `EVOLUTION.md` (body do send, conferir endpoints realmente chamados).
7. Atualizar `README.md` (scripts com `bun`).
8. Atualizar `MANUAL.md` (remover "Refresh manual" se não existir; alinhar fluxo IA).
9. (Opcional, se você aprovar separadamente) Adicionar:
   - `cleanup_webhook_dedup()` + cron.
   - Trigger imediato do `scheduled-dispatcher` no webhook quando debounce já está vencido.

Aprove para eu aplicar as correções de documentação. Os itens 9 (mudanças de código/banco) só faço se você marcar explicitamente.