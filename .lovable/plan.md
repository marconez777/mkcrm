## Roadmap de investigação — Agente SDR 3.0 / Gemini Febracis

### Evidência inicial já encontrada
- Os erros atuais do `ai-chat` não parecem ser de chave inválida.
- A tabela de uso mostra o agente `a75fcb1a-7597-47d2-af23-18f1636b3564` (`Agente SDR 3.0`) falhando com `google error 400` e, depois da troca da API, também `google error 404`.
- Os logs da função mostram um erro concreto no RAG/embedding:
  - `google embed 404: models/text-embedding-004 is not found for API version v1beta, or is not supported for embedContent`
- Isso aponta para bug/compatibilidade no nosso runtime, possivelmente em duas frentes:
  1. schema de ferramentas enviado ao Gemini causando `400`;
  2. modelo de embedding Google usado pelo RAG causando `404` antes/durante o atendimento.

### Objetivo
Interromper temporariamente a sequência do roadmap do pipeline-classifier e criar um diagnóstico por fases para revisar o runtime do agente de atendimento de ponta a ponta, até isolar a causa real e só então corrigir.

## Fase 0 — Congelar escopo e não mexer no pipeline
- Não avançar G4/G6 enquanto o SDR Febracis estiver quebrado.
- Não alterar o dispatcher do pipeline-classifier nesta investigação, exceto se aparecer prova direta de impacto, o que ainda não apareceu.
- Foco exclusivo: `ai-chat`, `_shared/ai.ts`, RAG, configuração do agente, ferramentas e telemetria.

## Fase 1 — Coleta de evidências reais
- Consultar `ai_usage` filtrando por:
  - agente `Agente SDR 3.0`;
  - clínica/tenant Febracis;
  - últimos erros `400`, `404`, `502`;
  - `lead_id`, modelo, latência, erro e horário.
- Ler logs recentes da função `ai-chat` sem depender apenas da tela.
- Identificar se os erros acontecem:
  - antes de chamar o chat;
  - durante retrieval/RAG;
  - na chamada `generateContent` do Gemini;
  - no loop de tools;
  - ou no envio final da resposta.

## Fase 2 — Revisão do runtime Gemini em `_shared/ai.ts`
- Auditar `googleChat` inteiro:
  - conversão de mensagens OpenAI-like para Gemini `contents`;
  - conversão de `assistant.tool_calls` para `functionCall`;
  - conversão de mensagens `tool` para `functionResponse`;
  - sanitização de schemas de tools;
  - uso de `systemInstruction`;
  - `generationConfig`;
  - tratamento de respostas sem candidatos ou com bloqueio de segurança.
- Revisar se a correção anterior de schema realmente cobre todos os casos do Gemini:
  - `default`;
  - `additionalProperties`;
  - propriedades vazias;
  - arrays sem `items` válido;
  - enums/formatos incompatíveis;
  - campos `nullable`, `strict`, `$schema`, `$ref`, `oneOf`, `anyOf`, `allOf`.
- Melhorar o log de erro para preservar a mensagem real do Google, não apenas `google error 400`.

## Fase 3 — Revisão do RAG/embeddings
- Auditar `_shared/rag.ts` e chamadas a `embed()`.
- Corrigir o erro já evidenciado:
  - `text-embedding-004` está sendo chamado no endpoint/modelo errado para a chave/modelo atual.
- Decidir a estratégia segura:
  - ajustar o nome do modelo para o formato esperado;
  - trocar para um embedding Google suportado;
  - ou usar fallback de embedding via Lovable AI/OpenAI-compatible quando o provider de chat for Gemini.
- Garantir que falha no RAG não derrube todo o atendimento quando houver fallback aceitável.

## Fase 4 — Revisão da configuração do agente Febracis
- Ler a configuração real do agente:
  - `provider`;
  - `model`;
  - `embedding_model`;
  - `tools`;
  - `rag_top_k`;
  - `max_tool_calls`;
  - estágios e `allowed_tools`.
- Verificar se o agente foi migrado parcialmente de OpenAI para Gemini e ficou com configuração incompatível.
- Confirmar se a chave está salva corretamente sem expor o segredo:
  - só checar presença, tamanho e últimos 4 caracteres quando já armazenados;
  - nunca logar nem retornar a chave.

## Fase 5 — Reprodução controlada
- Criar um teste controlado contra `ai-chat` com um lead afetado e o agente SDR 3.0.
- Rodar primeiro com RAG desligado/isolado logicamente para separar:
  - erro de embedding/RAG;
  - erro de chat Gemini;
  - erro de tool schema.
- Rodar depois com tools mínimas para identificar qual tool/schema quebra.
- Rodar por fim com configuração real completa.

## Fase 6 — Correções prováveis, aplicadas só após prova
- Se o erro for RAG/embedding:
  - corrigir modelo/endpoint/fallback de embedding;
  - registrar erro detalhado em `ai_usage`.
- Se o erro for schema de tool:
  - criar sanitizador Gemini robusto e testável;
  - aplicar antes de enviar `functionDeclarations`;
  - manter compatibilidade OpenAI/Anthropic sem mexer neles.
- Se o erro for formato de conversa/tool loop:
  - ajustar `functionResponse`, IDs, nomes e sequência de mensagens no formato aceito pelo Gemini.
- Se for configuração do agente:
  - corrigir dados do agente/embedding model de forma pontual e documentada.

## Fase 7 — Verificação final
- Validar com logs novos que:
  - `ai-chat` retorna sucesso;
  - `ai_usage` registra `status=success` com tokens;
  - o agente responde para leads reais afetados;
  - não há novos `google error 400/404`.
- Só depois retomar o roadmap do pipeline-classifier em G4.

## Arquivos prováveis de análise/correção
- `supabase/functions/_shared/ai.ts`
- `supabase/functions/_shared/rag.ts`
- `supabase/functions/ai-chat/index.ts`
- tabelas de configuração dos agentes e logs de `ai_usage`
- docs de roadmap apenas para registrar a pausa/retomada se necessário

## Fora do escopo neste roadmap
- Não mexer em UI.
- Não recriar chave de API.
- Não avançar G4/G6.
- Não alterar o pipeline-classifier sem evidência direta.