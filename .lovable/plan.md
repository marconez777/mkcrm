# Fase 2 — Concluída ✅

## Backend
- Tabelas: `ai_agents`, `ai_documents`, `ai_chunks (vector(768))`, `ai_threads`, `ai_messages`, `lead_ai_settings`, `stage_ai_defaults`.
- RPC `match_chunks(query_embedding, agent_id, k)` para RAG por similaridade cosseno.
- Edge functions:
  - `ai-embed` — wrapper sobre Lovable AI Gateway (`google/text-embedding-004`).
  - `ai-ingest-document` — chunking + embeddings em batch.
  - `ai-chat` — RAG + contexto do lead + tool calling (`move_lead_stage`, `add_lead_note`, `set_lead_field`, `assign_attendant`), loop de até 5 turns, persistência em thread opcional.
  - `ai-auto-reply` — disparado pelo webhook quando `isNew && !fromMe`, resolve agente por lead → estágio, monta últimas 20 msgs, chama `ai-chat`, envia via `evolution-send`.
- Webhook: fire-and-forget de `ai-auto-reply` em mensagens novas inbound (via `EdgeRuntime.waitUntil`).

## Frontend
- Rota `/agents` com CRUD de agentes, base de conhecimento (ingest texto), e teste rápido in-line.
- ContextRail do lead: bloco "Auto-resposta IA" com toggle + seleção de agente (escreve `lead_ai_settings`).
- Item "Agentes IA" no menu lateral.

## Próximo (Fase 3 sugerido)
- Cron de automações periódicas (follow-up automático).
- UI de threads/histórico do agente por lead.
- Upload de PDFs/URLs para a base de conhecimento (parsing).
- RLS endurecida + Auth (quando o usuário decidir liberar acesso multiusuário).
