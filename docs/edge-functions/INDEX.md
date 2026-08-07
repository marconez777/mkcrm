---
title: "Edge Functions (Supabase)"
topic: backend
kind: map
audience: agent
updated: 2026-07-13
summary: "Mapeamento das Edge Functions hospedadas no Supabase (Deno), responsáveis por rotinas de background, faturamento, IA, CRM Pipeline e integrações."
code_refs:
  - supabase/functions/
related_docs:
  - docs/database/SCHEMA.md
---

# Edge Functions (Supabase)

## 1. Visão Geral
As Edge Functions localizadas em `supabase/functions/` executam toda a lógica de backend serverless baseada em Deno. Elas representam o motor real do CRM, agindo de forma síncrona (via frontend) e assíncrona (via webhooks e CRONs do pg_cron).

## 2. Grupos de Funções Críticas

### Motor de WhatsApp (Evolution API)
Coração da mensageria (16+ funções).
- `evolution-webhook`: Recebe eventos, desduplica payloads, insere no DB e dispara auto-reply e download de mídia.
- `evolution-provision`, `evolution-qr`, `evolution-health`: Criação, monitoramento (watchdog) e reconexão das instâncias.
- `evolution-send`, `evolution-send-media`: Disparo de mensagens com idempotência garantida na tabela `messages`.
- `evolution-sync-lead`: Reconcilia histórico de mensagens sob demanda.

### Hub de Inteligência Artificial (`ai-*` e `agent-*`)
Módulo com altíssimo volume de side-effects executados por LLMs (13+ funções).
- `ai-chat`: Orquestra conversas, acionando tools que alteram o CRM (mover cards, tags, etc).
- `ai-assist`: Auxilia os atendentes no Inbox.
- `ai-ingest-document`, `ai-ingest-pdf`, `ai-ingest-url`: Ingestão de conhecimento (RAG), chunking e embedding na tabela `ai_chunks`.
- `ai-auto-reply`: Disparo de resposta automática inteligente baseada em debounce/fila de `pending_replies`.

### Pipeline & Automações (`pipeline-*` e CRONs)
- `pipeline-classify`: Dispatcher principal para IA revisar leads.
- `pipeline-deterministic`: Roteador automático baseado em regras de negócio.
- `pipeline-run-executor` e `pipeline-post-move-verifier`: Lidam com a execução pesada em chunks para evitar estourar limites, validando coerência na esteira.
- `pipeline-position-auditor`: CRON audita leads parados e sugere movimentações.

### Campanhas de Email, Sequences e Broadcasts
Lidam com disparo massivo e cadências de marketing.
- `process-email-queue`, `send-email-batch`: Consumo pesado de filas para disparo (ex: Resend).
- `sequence-*`: Matrícula e acompanhamento de contatos em sequências contínuas de marketing.
- `broadcast-*`: Transmissões em lote para WhatsApp/Email.

### Tracking e Analytics Interno
- `tracking-*`, `track-event`: Motor de analytics que coleta rastros de eventos de usuários.

### Forms (Formulários Externos)
- `forms-*`: Funções vitais para ingestão e controle dos formulários injetáveis nos sites dos clientes.

### Pagamentos, Tenants e Faturamento
- `create-checkout`, `create-portal-session`: Gestão de planos Stripe.
- `eduzz-webhook`, `payments-webhook`: Recebem postbacks de vendas e comissionamento.
- `admin-*`: Painel super-admin e gerenciamento multi-tenant.
- `clinic-*`: Gerenciamento de acessos de clínicas.

## 3. Invariantes
- Tratamento de erros (Try/Catch) é obrigatório, retornando cabeçalhos CORS válidos.
- Operações de longa duração usam padrões Assíncronos/Fila (Webhooks que respondem 200 rápido e processam em background) para evitar o limite de 5 segundos do Edge Timeout.
