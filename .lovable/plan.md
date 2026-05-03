# Fase 4 — Concluída ✅

## Backend
- Tabelas:
  - `message_templates` (nome, atalho, conteúdo, variáveis, descrição) — para mensagens parametrizadas.
  - `ai_usage` (modelo, tokens entrada/saída/total, latência ms, status, tools chamadas, replied) — métricas por chamada de IA.
- Edge functions:
  - `ai-ingest-pdf`: recebe PDF em base64, extrai texto via `unpdf`, faz chunking + embeddings.
  - `ai-ingest-urls`: ingestão em lote (até 50 URLs/chamada) — chama `ai-ingest-url` por URL.
  - `ai-chat`: agora registra cada chamada em `ai_usage` (tokens, latência, tools, status, erros).
  - `automations-tick`: nova ação `send_template` (interpola variáveis do lead e envia via `evolution-send`).
- Helper compartilhado `_shared/metrics.ts` (`logUsage`).

## Frontend
- **/templates**: CRUD de templates de mensagem com inserção rápida de variáveis (`{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}`).
- **/metrics**: dashboard de IA (24h / 7d / 30d) com cards (chamadas, respondeu, tokens, latência média, tools, erros), tabela "por agente" e últimas 30 chamadas.
- **/agents**: agora aceita upload de PDF e importação em lote de URLs (uma por linha).
- **/automations**: nova opção "Enviar template" no editor de ação (com select de template).
- Sidebar: novos itens "Templates" e "Métricas IA".

## Próximo (sugerido — Fase 5)
- Auth multiusuário + RLS endurecida (papéis: admin/atendente).
- Audit log e exportação de métricas (CSV).
- Suporte a OCR em imagens recebidas (use `google/gemini-3-flash-preview` para vision).
- Throttle/retry centralizado para o gateway de IA.
