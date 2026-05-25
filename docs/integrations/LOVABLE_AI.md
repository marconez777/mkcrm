# Integração: Lovable AI Gateway

> **Quando ler:** antes de adicionar/trocar modelo de IA, calcular custo, ou debugar erro de API key.
> **Última atualização:** 2026-05-25

---

## O que é

Gateway gerenciado pela Lovable que dá acesso a múltiplos modelos (Google Gemini, OpenAI GPT) **sem precisar de API key própria** do provedor. Cobrança vai para a conta Lovable da clínica.

Endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions` (OpenAI-compatible).

---

## Secrets

| Nome | Uso |
|---|---|
| `LOVABLE_API_KEY` | autenticação no gateway. Auto-injetado pelo Lovable Cloud. |

**Não rotacionar via `update_secret`** — usar `ai_gateway--rotate_lovable_api_key`.

---

## Modelos usados no projeto

| Modelo | Onde |
|---|---|
| `google/gemini-2.5-flash` | `ai-auto-reply` (default), `ai-assist` |
| `google/gemini-2.5-flash-lite` | `classifier-daily-batch`, embeddings/triagem |
| `google/gemini-2.5-pro` | `ai-analyst-run`, ingestão de PDF longo |
| `openai/gpt-5-mini` | fallback configurável por clínica |
| `google/gemini-2.5-flash-image` | (futuro) geração de imagem |

Trocável por clínica em `clinic_settings.ai_model_primary` / `ai_model_fallback`.

---

## Estrutura da chamada

```ts
const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [...],
    tools: [...],          // opcional
    tool_choice: 'auto',
    temperature: 0.4,
  }),
});
```

Resposta inclui `usage.{prompt_tokens, completion_tokens}` → usado em `ai-pricing.ts` para calcular `cost_usd` e gravar em `ai_runs`.

---

## Pricing

- Tabela mantida em `supabase/functions/_shared/ai-pricing.ts` (espelho em `src/lib/ai-pricing.ts`).
- Preços por 1M tokens, separados por input/output.
- Atualizar manualmente quando a Lovable mudar preços (ver `operations/COSTS_LIMITS.md`).

---

## Rate limits

- 429 ocasional em horário de pico. `_shared/ai-call.ts` faz retry com backoff exponencial (3 tentativas: 500ms, 1.5s, 4s).
- 402 (payment required) → conta Lovable sem créditos. Trava todos os runs, manda email admin via `ai-spend-notify`.

---

## Tool calling

- Format padrão OpenAI (`tools[].function.name`, `function.parameters` JSON schema).
- Gemini suporta. GPT-5 também.
- Sempre validar `tool_calls[].function.arguments` com Zod antes de executar — modelos às vezes inventam campos.

Ver `flows/AI_AGENT_LOOP.md`.

---

## Pegadinhas

- **`LOVABLE_API_KEY` ausente em edge function nova**: re-deploy resolve (auto-injeção acontece no deploy).
- **Streaming**: gateway suporta SSE, mas hoje **não usamos** (todos os calls são blocking). Trocar requer reestruturar `ai-auto-reply`.
- **Modelo descontinuado**: gateway pode remover modelo sem aviso longo. Manter fallback configurado.
- **Token count diferente do esperado**: cada modelo tokeniza diferente. Não confiar em estimativa local — usar `usage` da resposta.
- **JSON mode**: alguns modelos suportam `response_format: {type:'json_object'}`. Gemini 2.5 sim, mais antigos não.
- **Imagem em input** (multimodal): suportado em `gemini-2.5-pro` e `gpt-5`. Passar como `content: [{type:'image_url', image_url:{url:...}}]`. Custo de input infla muito.

---

## Melhorias sugeridas

- Streaming de tokens no auto-reply (UX melhor no Inbox).
- Cache semântico para queries repetidas (Redis).
- Eval automatizado (`ai-eval-run`) com dataset versionado.
- Métricas: tokens/run, % retry, distribuição de latência por modelo.

---

## Arquivos-chave

- `supabase/functions/_shared/ai-call.ts` (wrapper com retry)
- `supabase/functions/_shared/ai-pricing.ts`
- `src/lib/ai-pricing.ts`
- `edge-functions/AI.md`
- `operations/COSTS_LIMITS.md`
