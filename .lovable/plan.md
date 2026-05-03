# Fase 1 — Concluída ✅

- Extensões habilitadas: `pg_cron`, `pg_net`, `vector`, `pgcrypto`.
- Tabela `whatsapp_instances` criada + backfill da `settings` atual como instância default.
- `leads.whatsapp_instance_id` adicionada e backfilled.
- Índices: `messages(lead_id, timestamp desc)`, único parcial `(lead_id, external_id)`, único parcial `client_message_id`, `leads(archived_at, last_message_at desc)`, `leads(stage_id, position)`, `leads(whatsapp_instance_id)`, `webhook_events(received_at desc)`.
- `_shared/evolution.ts` agora expõe `loadInstance / loadInstanceByToken / loadAllInstances`. `ingestMessage` recebe `instanceId` e seta no lead novo.
- `evolution-webhook` resolve a instância pelo token.
- `evolution-send` e `evolution-sync-lead` resolvem a instância via `lead.whatsapp_instance_id` (fallback default).
- `evolution-health` itera todas as instâncias, atualizando estado em cada linha.
- `evolution-test` aceita `instance_id` opcional.
- Frontend: `useHealth` agrega estado de todas as instâncias; `Settings` lê/grava na instância default em `whatsapp_instances`.
- Cron `evolution-health-every-minute` agendado via `pg_cron` + `pg_net`.

## Próximo (Fase 2)
- Tabelas de IA: `ai_agents`, `ai_threads`, `ai_messages`, `ai_documents` + `embedding vector(1536)`.
- Edge function `ai-chat` usando Lovable AI Gateway.
- Hook de auto-resposta opt-in por lead/stage com checagem `isNew === true`.
