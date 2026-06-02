# Remover Lovable AI Gateway e ampliar provedores por agente

Hoje **dois lugares** ainda usam o Lovable AI Gateway escondido (sem o usuário configurar nada):

1. `supabase/functions/ai-assist/index.ts` — gera **Resumo IA do lead** e **Sugestões de resposta** no Inbox
2. `supabase/functions/transcribe-audio/index.ts` — transcreve áudios de WhatsApp

Todo o resto (agentes do Kanban, auto-reply, análise, ingest, RAG) **já usa** o `provider + api_key` salvo em cada agente. Vamos eliminar o gateway desses dois pontos também e adicionar novos provedores na tela de agentes.

---

## 1. Novos provedores na tela "IA → Provedor & API key"

Adicionar ao seletor:

| Provedor | Valor interno | Endpoint padrão | Formato |
|---|---|---|---|
| OpenAI (já existe) | `openai` | `https://api.openai.com/v1` | OpenAI |
| Anthropic / Claude (já existe) | `anthropic` | `https://api.anthropic.com/v1` | Anthropic |
| Google / Gemini (já existe) | `google` | `https://generativelanguage.googleapis.com/v1beta` | Google |
| **xAI / Grok (novo)** | `xai` | `https://api.x.ai/v1` | OpenAI-compatible |
| **Manus (novo)** | `manus` | (Base URL obrigatória, definida pelo usuário) | OpenAI-compatible |

Modelos pré-listados:
- **Grok:** `grok-2-latest`, `grok-2-mini`, `grok-beta`, `grok-vision-beta`
- **Manus:** campo livre (digita o nome do modelo) — Manus não tem uma lista pública estável

Atualizar:
- `PROVIDER_MODELS` e `PROVIDER_LABEL` em `src/pages/Agents.tsx`
- Placeholder da API key (`xai-...` para Grok)
- Migration: trocar o CHECK `ai_agents_provider_chk` para aceitar `('openai','anthropic','google','xai','manus')`

## 2. Backend multi-provedor (`supabase/functions/_shared/ai.ts`)

Adicionar suporte a Grok e Manus. Ambos são **OpenAI-compatible**, então:

- Adicionar branches `xai` e `manus` no `chatCompletion` que chamam uma versão de `openaiChat` recebendo o base_url adequado (xAI fixo, Manus exige `base_url` no agente — erro claro se faltar).
- Atualizar o type `Agent.provider`.

Embeddings de Grok/Manus: **não suportados nativamente** — se o agente usar RAG, ele deve preencher `embedding_api_key` (OpenAI/Google), igual hoje funciona para Anthropic. Mostrar o mesmo bloco de embeddings auxiliares na UI quando provider for `anthropic`, `xai` ou `manus`.

## 3. Remover Lovable Gateway de `ai-assist`

O endpoint atende duas operações no Inbox:

- **`mode: "summary"`** — já busca agente com `role='summary'` da clínica; quando existe, usa o prompt dele. Mas hoje, mesmo quando o agente existe, a chamada ainda vai pro Lovable Gateway com a key da Lovable. Trocar para usar `chatCompletion(agent, ...)` do `_shared/ai.ts` com o `provider + api_key` do próprio agente.
- **`mode: "suggest"`** — hoje não usa agente nenhum. Passar a buscar um agente da clínica (preferência: `role='assist'`, depois `role='summary'`, depois qualquer `enabled=true`). Se não houver nenhum agente configurado **com api_key**, retornar `400` com mensagem clara: *"Configure um agente de IA com sua API key em IA → Agentes para usar este recurso."* — a UI deve mostrar isso num toast.

Remover toda referência a `LOVABLE_API_KEY`, `ai.gateway.lovable.dev` e `normalizeModel` deste arquivo.

## 4. Remover Lovable Gateway de `transcribe-audio`

A transcrição precisa de áudio multimodal. Estratégia:

- Buscar a clínica do `message → lead → clinic_id`.
- Procurar agente da clínica (mesma ordem: `role='summary'` → qualquer `enabled=true` com api_key).
- Despachar conforme o provider do agente:
  - **openai** → `POST {base_url}/audio/transcriptions` (Whisper, multipart com o arquivo de áudio).
  - **google** → `generateContent` com `inline_data` de áudio (modelo do agente, ou fallback `gemini-2.5-flash`).
  - **anthropic / xai / manus** → não há transcrição multimodal estável; retornar `400` com mensagem: *"O provedor configurado não suporta transcrição de áudio. Configure um agente OpenAI ou Google."*
- Se não houver agente com api_key, mesma mensagem de erro que `ai-assist`.

Remover `LOVABLE_API_KEY` e a URL do gateway.

## 5. UI — tratamento dos erros novos

No Inbox, onde hoje chamamos `ai-assist` e `transcribe-audio`, mostrar via `toast.error()` a mensagem retornada pelo backend (já temos esse padrão; só garantir que a mensagem do servidor seja propagada em vez de um genérico).

## 6. Verificação

- Recarregar a página de agentes: o seletor mostra 5 provedores; criar agente Grok salva sem erro.
- Resumo IA no Inbox sem nenhum agente configurado → toast vermelho com instrução clara, sem chamada ao gateway.
- Com agente OpenAI configurado → resumo funciona usando a key do usuário.
- Transcrição de áudio com agente OpenAI ou Google → funciona; com Anthropic/Grok → toast de provedor não suportado.
- `rg -n "LOVABLE_API_KEY\|ai.gateway.lovable" supabase/ src/` retorna **vazio**.

---

### Pontos para você confirmar antes de eu implementar

1. **Manus**: confirma que sua conta Manus expõe uma API OpenAI-compatible com base URL própria? Se for outro formato, me passa um exemplo de request que eu adapto.
2. **Quando não houver agente configurado** (caso comum agora, já que removemos o fallback), tudo bem o resumo / sugestão / transcrição **falhar com toast** pedindo configuração? Ou prefere esconder os botões enquanto não houver agente?
3. **Modelos do Grok**: posso fixar a lista acima ou prefere campo livre como no Manus?
