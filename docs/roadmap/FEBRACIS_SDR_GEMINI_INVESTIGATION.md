---
title: "Roadmap: Investigação SDR Febracis / Gemini"
topic: ai-agents
kind: roadmap
audience: agent
updated: 2026-07-10
summary: "Roadmap em fases para pausar o pipeline-classifier e investigar o Agente SDR 3.0 Febracis de cabo a rabo até isolar e corrigir falhas Gemini/RAG."
code_refs:
  - supabase/functions/ai-chat/index.ts
  - supabase/functions/_shared/ai.ts
  - supabase/functions/_shared/rag.ts
  - supabase/functions/scheduled-dispatcher/index.ts
related_docs:
  - docs/ai_customer_service_agent_spec.md
  - docs/_audit/FEBRACIS_CLEANUP.md
  - docs/roadmap/PIPELINE_TENANT_ROADMAP.md
---

# Roadmap: Investigação SDR Febracis / Gemini

## Estado inicial

O roadmap do `pipeline-classifier` fica pausado antes do G4/G6 até o atendimento SDR Febracis voltar a responder com estabilidade.

Evidências coletadas em 2026-07-10:

- Agente afetado: `Agente SDR 3.0` (`a75fcb1a-7597-47d2-af23-18f1636b3564`).
- Tenant/clínica: Febracis (`clinic_id = ab2f4484-886c-48f2-bfc6-0651d062c575`).
- Configuração real: `provider=google`, `model=gemini-2.5-flash`, `embedding_model=null`, `tools=[]`, `rag_top_k=5`, chave presente (`api_key_set=true`).
- Erros recentes em `ai_usage`: `ai-chat 502: google error 400` e depois `ai-chat 502: google error 404`.
- Log concreto em `ai-chat`: RAG tentava `google embed` com `text-embedding-004`, que retorna 404 para a chave/modelo atual.

Conclusão inicial: não era só a chave do Gemini. Havia pelo menos um problema de runtime no caminho de RAG/embedding, e a telemetria do dispatcher escondia o detalhe do erro real do Google.

## Fase 0 — Pausar o roadmap do pipeline

- Não avançar G4/G6 enquanto o SDR Febracis estiver quebrado.
- Não alterar `pipeline-classify` ou `_template_pipeline_classify` sem evidência direta.
- Escopo exclusivo: atendimento (`ai-chat`), RAG, Gemini, dispatcher e logs.

Status: concluído.

## Fase 1 — Coleta de evidência

- Consultar `ai_usage` do agente afetado.
- Ler logs recentes de `ai-chat` e `scheduled-dispatcher`.
- Ler configuração real do agente em `ai_agents`.
- Confirmar se a API foi salva sem expor segredo.

Status: concluído.

Achados:

- A chave existe e tem formato/tamanho plausível.
- O agente não usa tools ativas (`tools=[]`), então os erros atuais não dependem de uma tool específica.
- O erro de RAG/embedding é reproduzido pelos logs antes da resposta final.

## Fase 2 — Correção de infraestrutura Gemini/RAG

Correções aplicadas:

- `supabase/functions/_shared/ai.ts`
  - `provider=google` não usa mais `text-embedding-004` nativo por padrão quando existe `LOVABLE_API_KEY`.
  - Embedding padrão passa a usar `openai/text-embedding-3-small` via Lovable AI, com `dimensions: 768`, compatível com a coluna atual de vetores.
  - Sanitizador de schema Gemini ampliado para remover campos incompatíveis (`default`, `$ref`, `additionalProperties`, `nullable`, `oneOf`, `anyOf`, `format`, limites etc.).
  - Erros do Google agora logam status, modelo, quantidade de mensagens/tools e corpo compactado.
  - Fallback automático de `generateContent` de `v1beta` para `v1` quando o Google retorna 404 no chat.
- `supabase/functions/_shared/rag.ts`
  - Cache key do RAG alinhada ao modelo real usado no fallback (`openai/text-embedding-3-small`).
- `supabase/functions/scheduled-dispatcher/index.ts`
  - Erros salvos em `ai_usage` agora incluem `detail` retornado pelo `ai-chat`, não só `google error 400/404`.

Status: concluído e publicado nas funções `ai-chat` e `scheduled-dispatcher`.

## Fase 3 — Validação operacional

Validação já feita:

- Deploy de `ai-chat` concluído.
- Deploy de `scheduled-dispatcher` concluído.
- Secrets confirmam `LOVABLE_API_KEY` disponível para o fallback de embedding.
- Não havia `pending_replies` restantes para o agente após a última falha; o dispatcher já tinha abandonado a tentativa anterior depois de 3 erros.

Validação pendente:

- Aguardar a próxima mensagem inbound ou criar uma pendência controlada para o mesmo agente.
- Confirmar que não surgem novos logs `rag embed error` com `text-embedding-004`.
- Confirmar em `ai_usage` uma linha `status=success` para o agente SDR 3.0.

## Fase 4 — Se ainda falhar

Se aparecer novo erro:

1. Ler o novo `detail` em `ai_usage` ou no log `[googleChat] provider error`.
2. Se for 400 de schema, reduzir o payload Gemini e isolar `systemInstruction`, histórico e tools.
3. Se for 404 de modelo, trocar `gemini-2.5-flash` para um ID suportado pela chave atual ou usar Lovable AI como provider do agente.
4. Se for bloqueio/safety, tratar resposta sem candidato e registrar `finishReason`/safety ratings.
5. Se for RAG, desligar `rag_top_k` temporariamente ou corrigir a dimensão/modelo dos chunks.

## Critério de retomada do pipeline-classifier

Retomar G4/G6 somente quando:

- o SDR Febracis responder novamente;
- não houver `google error 400/404` novo no agente por uma janela operacional;
- `ai_usage` mostrar sucesso real com tokens ou resposta final;
- o dispatcher não abandonar novas pendências do agente.
