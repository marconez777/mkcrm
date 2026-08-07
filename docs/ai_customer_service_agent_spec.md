---
title: "Especificação Técnica do Agente de IA (Atendimento)"
topic: ai
kind: map
audience: agent
updated: 2026-07-02
summary: "Mapa detalhado da arquitetura, tabelas e fluxos dos Agentes de IA do MKCRM, incluindo Classificador V2 e RAG."
code_refs:
  - supabase/functions/ai-chat/
  - supabase/functions/pipeline-classify/
  - supabase/functions/scheduled-dispatcher/
  - supabase/functions/ai-ingest-document/
  - supabase/functions/_shared/rag.ts
  - supabase/functions/_shared/ai.ts
related_docs:
  - docs/ai_agent_specification.md
---

# Especificação Técnica do Agente de IA (Atendimento)

Este documento detalha a arquitetura, estrutura de dados, fluxos de comunicação e componentes principais do ecossistema de Inteligência Artificial do **MKCRM**, desde a sua configuração na interface (UI) até a execução no backend via Supabase Edge Functions.

---

## 1. Provedores e Configuração de Chaves

O ecossistema utiliza primordialmente a tecnologia do Google Gemini.
- **Provedor Primário:** `google` (Modelos Gemini Flash/Pro diretos).
- **Gerenciamento de Chaves:** As chaves de API globais das clínicas são armazenadas na tabela segura `clinic_secrets` (coluna `gemini_api_key`).
- **Resolução Automática:** Edge functions usam funções como `clinic-gemini.ts` para capturar e resolver a chave sem expor ao frontend, garantindo comunicação direta e autenticada com a API do Google (bypassing gateways externos).

---

## 2. Criação e Configuração na UI

A gestão e personalização dos agentes ocorrem pelas interfaces no frontend do sistema (`src/pages/Agents.tsx` etc.).

### Entidades Configuradoras
- **`ai_agents`**: Tabela principal. Armazena a Identidade, o Prompt de Sistema base (como ele deve agir, tom de voz), os limites de tokens e o modelo associado.
- **`stage_ai_defaults`**: Define o comportamento contextual baseado no estágio do funil Kanban. Um lead em "Agendado" pode receber instruções de pós-venda, sobrepondo o prompt base.
- **`lead_ai_settings`**: Permite forçar configurações individuais em um contato específico (ex: pausar IA para humano assumir).

---

## 3. Pipeline Classificador V2 (Triagem Prévia)

Antes da IA elaborar uma resposta de texto para o Lead no WhatsApp, a conversa passa obrigatoriamente por um pipeline de classificação massivo (V2).

O Dispatcher do Classificador V2 (`pipeline-classify/agent-core.ts`) roda assincronamente e aciona **5 subagentes** (usando Vercel AI SDK):
1. **Resumidor (gpt-4o/gemini-flash):** Lê as últimas mensagens e extrai um `{summary, mentioned_dates}` isolado, reduzindo consumo futuro.
2. **Agendador:** Identifica se há intenção de marcar horários (`is_scheduling_action`).
3. **Preenchedor:** Extrai campos customizados do lead para salvar no banco (nome, e-mail, etc) automaticamente baseados no bate-papo.
4. **Movimentador:** Analisa o sentimento e o andamento da negociação, sugerindo o avanço ou recuo da etapa Kanban (Pipeline Stage).
5. **Maestro (Validador Final):** Unifica todas as extrações e determina o que deve ser aplicado de fato no banco de dados.

Após essa etapa, o lead tem suas informações (fatos e tags) consolidadas, e a flag `needs_ai_review` é baixada.

---

## 4. Scheduled Dispatcher e Fluxo de Mensageria

O coração da comunicação reativa se baseia na orquestração cuidadosa do despacho para não encavalar respostas ou travar no timeout do Supabase (limite de 1 minuto).

### Fluxo de Recebimento (Inbound via WhatsApp)
1. Uma mensagem chega via WhatsApp no webhook de integração (`evolution-webhook`).
2. A mensagem é salva na tabela `messages`.
3. Uma trigger do banco (`trg_messages_enqueue_classifier`) liga a flag `needs_ai_review = true` no lead.
4. O Cronjob principal pega esse lead, joga para o **Pipeline Classificador** (descrito na Seção 3).
5. O classificador termina a análise e insere uma linha de agendamento na tabela `scheduled_messages` para a função de resposta.

### Fluxo de Resposta (Scheduled Dispatcher)
1. A função `scheduled-dispatcher` acorda a cada minuto (cron tick) e varre a `scheduled_messages`.
2. Para cada mensagem madura, ela prepara uma `ai_threads` para agrupamento (se não houver).
3. E, finalmente, invoca a Edge Function `ai-chat` de forma assíncrona.
4. O Dispatcher gerencia nativamente *Backoff & Retry*: se a API do Google cair ou retornar 429/500, ele reagenda a resposta adicionando falhas (2m, 5m, 30m).

---

## 5. O Cérebro Raciocinando (`ai-chat` Edge Function)

A Edge Function `ai-chat` é a responsável por gerar o texto que o humano vai ler no WhatsApp.

1. **Montagem de Contexto:** Reúne histórico de `ai_messages` e metadados recentes do Lead.
2. **Retrieval e RAG (Base de Conhecimento):** 
   - Invoca o módulo RAG (`_shared/rag.ts`) que pode gerar *HyDE* ou reescrever a intenção (`rewritten_query`).
   - Usa `googleEmbed` para gerar o vetor da pergunta do lead.
   - Bate os vetores contra os `ai_chunks` do banco de dados aplicando RRF (Reciprocal Rank Fusion).
3. **Tool Calling (MCP):** O sistema injeta as ferramentas disponíveis. O agente pode decidir chamar uma Tool (ex: pesquisar calendário, setar notas) autonomamente.
4. O LLM formula a string final e responde, sendo despojado de markdown bruto indesejado no WhatsApp (`stripMarkdown`).
5. A reposta é enviada de volta pelo `evolution-send` e os custos e latências são salvos na tabela `ai_usage`.

---

## 6. Base de Conhecimento (Ingest Flow & Embeddings)

A Ingestão de conhecimento (treinamento do Agente) garante que ele conheça a clínica.

- As edge functions (`ai-ingest-document`, `ai-ingest-pdf`, `ai-ingest-url`) recebem o material bruto, extraem o texto e fatiam usando estratégias de Chunking.
- **Embeddings:** Atualmente, a vetorização de dados é feita via **Google Gemini** (ao invés de OpenAI) para extrair os *embeddings* semânticos.
- Os *embeddings* e textos fatiados ficam morando na tabela `ai_chunks`.
- Para poupar uso de API em dúvidas frequentes idênticas, há um `embedding_cache`.

---

## 7. Dicionário do Banco de Dados (Tabelas Essenciais IA)

As principais tabelas do banco de dados (`public`) que formam a arquitetura IA são:

- `ai_agents`: Dados de configuração, tom de voz, instruções, chaves embutidas.
- `ai_documents` e `ai_chunks`: Arquivos, sites (Knowledge Base) e os fragmentos de texto vetorizados.
- `embedding_cache`: Cache de vetores de perguntas comuns feitas ao RAG.
- `ai_threads` e `ai_messages`: Armazenamento serializado da janela de conversa com o LLM (separado do fluxo cru de webhooks).
- `scheduled_messages`: Fila assíncrona gerida pelo classificador indicando quando e qual lead precisa ser respondido pelo `ai-chat`.
- `pending_replies`: Histórico obsoleto/adicional de gestão de locks ou pendências (substituído gradativamente pelo classificador + dispatcher).
- `ai_usage`: Tabela financeira de uso e metria. Guarda todos os tokens consumidos, custos em dólar gerados, model id, tempo de latência e erros capturados (`source = agent-runtime | classifier-runtime`).

---

## 8. Mapeamento de Edge Functions (Supabase)

Diretório: `supabase/functions/`

| Função | Responsabilidade Primária |
|---|---|
| `ai-chat` | O cérebro de conversação. Roda o RAG, aciona ferramentas e devolve a resposta falada ao lead. |
| `pipeline-classify` | Orquestra a "Triagem" do lead inbound. Move no funil, extrai dados de campos e gera o envio agendado (`scheduled_messages`). |
| `scheduled-dispatcher` | O Cron worker. Esvazia a fila de `scheduled_messages` enviando os chamados reais HTTP pro `ai-chat` (lida com retries). |
| `ai-ingest-document` | Fatiamento de textos puros para a base de conhecimento e gravação de Embeddings no banco. |
| `ai-auto-reply` | (Legado ou Fallbacks específicos) Rota paralela usada em fluxos de fallback da UI. |
| `ai-eval-run` | Audita e qualifica de forma assíncrona o atendimento (nota de cordialidade, vendas e fechamento do atendimento do bot). |
| `_shared/ai.ts` | Utilities centralizados. Contém as rotinas principais de requisições `googleChat` nativas para os modelos do Google, bem como abstrações de Vercel AI SDK. |
| `_shared/rag.ts` | O motor RAG. Reescreve queries da conversa, faz o search vetorial com fusões semânticas híbridas e formata pro prompt. |
