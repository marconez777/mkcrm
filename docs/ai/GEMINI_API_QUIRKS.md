---
title: "Quirks da Gemini API (chat + embeddings) — o que NÃO fazer"
topic: ai
kind: troubleshooting
audience: agent
updated: 2026-07-10
summary: "Regras práticas para chamar a Gemini API direta (BYOK): endpoint v1beta vs v1, systemInstruction, modelos disponíveis, embeddings. Existe para não cair de novo no erro `Unknown name systemInstruction` e no 404 de `gemini-2.5-flash`."
code_refs:
  - supabase/functions/_shared/ai.ts
  - supabase/functions/_shared/rag.ts
  - supabase/functions/_shared/clinic-gemini.ts
related_docs:
  - docs/roadmap/FEBRACIS_SDR_GEMINI_INVESTIGATION.md
  - docs/pipeline/runtime/AGENT_MODELS.md
---

# Gemini API — pegadinhas que já derrubaram produção

Este doc existe porque o mesmo erro voltou várias vezes:

```
ai-chat 502: google error 400 — Invalid JSON payload received.
Unknown name "systemInstruction": Cannot find field.
```

e antes disso:

```
ai-chat 502: google error 404 — This model models/gemini-2.5-flash
is no longer available to new users.
```

Se você for tocar em `supabase/functions/_shared/ai.ts` (função `googleChat` ou `googleEmbed`), **leia isto antes**.

## Contexto

Os agentes do tenant Febracis (e outros com BYOK) chamam a Gemini API **direto**, com a chave da clínica em `clinic_secrets.gemini_api_key`. Não passam pelo Lovable AI Gateway. Portanto o payload precisa ser aceito pelo endpoint público do Google — e ele muda entre `v1beta` e `v1`.

## Regra #1 — `systemInstruction` só existe no `v1beta`

- Endpoint `https://generativelanguage.googleapis.com/v1beta/...:generateContent` → aceita `systemInstruction: { parts: [{ text }] }`.
- Endpoint `https://generativelanguage.googleapis.com/v1/...:generateContent` → **rejeita** com `400 Unknown name "systemInstruction"`.

Consequência: se o fallback do chat cair no `v1` porque o `v1beta` retornou 404, **não pode mandar `systemInstruction`** no retry. Precisa prependar o system prompt como primeira mensagem `role:"user"` (ex: `"[System]\n<sys>"`).

O `googleChat` em `ai.ts` implementa a cadeia:
1. `v1beta` com `systemInstruction`.
2. Se 404/400 → `v1` com `systemInstruction`.
3. Se ainda 400/404 → `v1` **sem** `systemInstruction`, com o sys embutido no primeiro `user`.

Nunca simplifique isso pra "só mandar `systemInstruction` sempre" — quebra o Febracis.

## Regra #2 — `gemini-2.5-flash` só existe no `v1beta`

Chaves novas do Google retornam 404 em `v1beta/models/gemini-2.5-flash` com a mensagem "no longer available to new users", e o `v1` **não tem** esse alias. Alternativas quando o modelo do agente vier assim:

- `gemini-flash-latest` (v1 e v1beta).
- `gemini-2.5-flash-002` (v1beta em algumas chaves).
- Deixar o operador escolher em `ai_agents.model` — não hardcodar.

O fallback já cobre 404 tentando `v1` com o mesmo id; se o id não existir em nenhum dos dois, o erro real do Google fica no log `[googleChat] provider error` com `fallback_from_v1beta` preenchido.

## Regra #3 — embeddings usam a chave do agente, nunca o Lovable AI

Tentamos uma vez rotear embeddings do provider `google` pelo Lovable AI (`openai/text-embedding-3-small`). Deu problema duplo:

1. Dimensões diferentes: `text-embedding-3-small` = 1536, `ai_chunks` está em **768**. Quebra as buscas por similaridade.
2. Consome créditos do Lovable silenciosamente em vez da chave BYOK que a clínica pagou.

Portanto, no branch `provider === "google"` do `embed()`:

- Sempre chamar `googleEmbed(requireKey(agent), model, texts)`.
- Modelo padrão: `gemini-embedding-001` com `outputDimensionality: 768` (compatível com `ai_chunks`).
- Só usar `text-embedding-004` se o agente pedir explicitamente em `embedding_model`.

## Regra #4 — `googleEmbed` também precisa do fallback v1beta→v1

`gemini-embedding-001` costuma estar em `v1beta`; `text-embedding-004` às vezes só em `v1`. Ordem correta:

1. Tenta `v1beta`.
2. Em 404, tenta `v1`.
3. Erro final inclui `model=`, corpo do `v1beta` E do `v1` — sem isso a gente perde tempo adivinhando qual endpoint reclamou.

## Regra #5 — logs de erro têm que expor o corpo do Google

Nunca reduzir o log de erro pra `google error 400` sem o `message`/`status` original. O dispatcher (`scheduled-dispatcher/index.ts`) propaga o `detail` do `ai-chat` pra `ai_usage.error` justamente pra debug post-mortem. Não corta esse pipeline.

## Checklist antes de mexer em `googleChat` / `googleEmbed`

- [ ] Mantive os 3 estágios do fallback (`v1beta` → `v1 c/ sys` → `v1 s/ sys`)?
- [ ] Se removi `systemInstruction`, prependei o sys ao primeiro `user`?
- [ ] Embeddings continuam usando `requireKey(agent)` e `outputDimensionality: 768`?
- [ ] `[googleChat] provider error` ainda loga `status`, `model`, `error`, `fallback_from_v1beta`, `messages`, `tools`?
- [ ] `sanitizeGeminiSchema` continua removendo `default`, `$ref`, `additionalProperties`, `nullable`, `oneOf`, `anyOf`, `format`, limites?

Se qualquer um for "não", **pare e leia este doc de novo**.

## Histórico de incidentes

- 2026-07-10 — 400 `Unknown systemInstruction` no fallback `v1` do SDR Febracis. Fix: 3º estágio do fallback prependa sys como `user`. Ver `docs/roadmap/FEBRACIS_SDR_GEMINI_INVESTIGATION.md`.
- 2026-07-10 — 404 `text-embedding-004` no RAG. Fix inicial (rotear pra Lovable AI) foi revertido; correção final = `gemini-embedding-001` + `outputDimensionality: 768` na chave BYOK.
- 2026-07-10 — 404 `gemini-2.5-flash` "no longer available to new users" em chaves novas. Fix: fallback automático `v1beta`→`v1` em `googleChat`.
- 2026-07-10 — Agente "mudo" com `gemini-flash-latest`: `output_tokens>0` (ex.: 18–21) mas `content` vazio (`replied:false`, `error:turn:summary`). Causa: os modelos `gemini-2.5-*` / `gemini-flash-latest` ligam **thinking** por padrão e retornam apenas partes com `{ thought: true }`, sem `text`. Fix: enviar `generationConfig.thinkingConfig.thinkingBudget = 0` em `googleChat`, e ignorar `parts[i].thought === true` ao montar o texto. Se precisar de raciocínio, aumentar o budget explicitamente — NUNCA remover o campo.

## Regra #6 — Desligar "thinking" no chat do agente

Modelos `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-flash-latest` e variantes lite têm **thinking on por padrão**. Isso quebra chat porque:
- O modelo devolve `candidates[0].content.parts = [{ thought: true }]` sem `text`.
- `usageMetadata.candidatesTokenCount` marca 15–30 tokens.
- Nosso pipeline enxerga isso como sucesso e loga `replied:false / turn:summary`.

Em `googleChat` (`supabase/functions/_shared/ai.ts`):
```ts
generationConfig: {
  temperature: ...,
  thinkingConfig: { thinkingBudget: 0 }, // OBRIGATÓRIO — não remover
}
// ... e no parser:
if (p.thought) continue;
```
