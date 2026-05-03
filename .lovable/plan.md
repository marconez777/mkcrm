# Fase 3 — Concluída ✅

## Backend
- Tabelas: `automations` (regras: gatilho + ação + cooldown), `automation_runs` (auditoria por lead).
- Edge function `automations-tick`:
  - Gatilhos: `no_reply_after` (lead com última msg inbound há X horas, opcional por estágio), `stage_idle` (lead parado em estágio).
  - Ações: `ai_followup` (chama `ai-chat` com instrução interna e envia via `evolution-send`), `move_stage`.
  - Respeita cooldown por automação×lead, registra cada execução em `automation_runs`.
- Cron `pg_cron` agendado para `*/5 * * * *` chamando `automations-tick`.
- Edge function `ai-ingest-url`: baixa, faz strip de HTML e ingere texto na base de conhecimento (com chunking + embeddings).

## Frontend
- Página **/automations** com:
  - Lista de automações + criar/editar/excluir + toggle ativa.
  - Editor de gatilho (tipo + horas + estágio) e ação (agente + prompt ou estágio destino).
  - Botão "Executar agora" (dispara `automations-tick` manualmente).
  - Lista das últimas 20 execuções (lead, status, detalhe, timestamp).
- Página **/agents**: novo input "Importar URL" que chama `ai-ingest-url`.
- **ContextRail** (lead): botão "Ver histórico IA" mostra mensagens da última thread (`ai_threads` → `ai_messages`), incluindo chamadas de tool.
- Item "Automações" no menu lateral.

## Próximo (Fase 4 sugerido)
- Ingest de PDF (parsing) e múltiplas URLs em batch.
- Métricas de IA (custo, latência, taxa de resposta) por agente/automação.
- Templates de mensagem com variáveis (ação `send_template`).
- RLS endurecida + Auth (multiusuário).
