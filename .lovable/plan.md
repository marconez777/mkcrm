
## O que descobri

Duas coisas mudam completamente o diagnóstico anterior:

**1. A chave `AQ.Ab8RN6...` É uma chave Gemini válida — formato novo do Google**

Olhando o print da AI Studio: aparece "For details on using **auth keys** with Gemini API". O Google lançou recentemente um novo formato de API key com prefixo `AQ.` (as antigas `AIzaSy...` continuam funcionando também). Ou seja, minha "Regra #8" da tentativa anterior estava errada — a chave está OK.

O 400 `API_KEY_INVALID` provavelmente vem de um destes três motivos, em ordem de probabilidade:

- **(a) A Generative Language API não está habilitada** no GCP project `124528952777`. Chave `AQ.` é escopada por projeto; se o projeto não tem a API ligada, o Google devolve `API_KEY_INVALID` genérico.
- **(b) As chaves `AQ.` querem `x-goog-api-key` header**, não `?key=...` na URL. Nosso `googleChat` hoje só passa `?key=`. Em chaves `AIza` os dois funcionam; em `AQ.` só o header é garantido.
- **(c) A chave foi regenerada/apagada** — mas o print mostra ela ativa em "API chat funnel 1".

**2. O dropdown de modelo (`src/pages/Agents.tsx`) não tem `gemini-flash-latest`**

Só oferece `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`. Por isso você voltou pro `2.5-flash` — era a única opção "flash" viável. Precisa adicionar os aliases `-latest`.

## Plano

**Passo 1 — Mandar a chave pelo header, não pela query string**

Em `supabase/functions/_shared/ai.ts` (`googleChat` e `googleEmbed`):
- Remover `?key=${apiKey}` da URL.
- Adicionar header `x-goog-api-key: ${apiKey}`.
- Vale pra ambos formatos (`AIza` e `AQ.`) — é o padrão oficial atual da Gemini API.

**Passo 2 — Ampliar o dropdown de modelo Gemini**

Em `src/pages/Agents.tsx`:
```ts
google: [
  "gemini-flash-latest",    // recomendado — sempre a versão flash mais nova
  "gemini-pro-latest",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
]
```
Também alinhar `src/lib/quality-ladder.ts` e `src/lib/ai-pricing.ts` (senão o custo aparece $0).

**Passo 3 — Trocar o modelo do SDR 3.0 pra `gemini-flash-latest` via migração**

`UPDATE ai_agents SET model='gemini-flash-latest' WHERE id='a75fcb1a-7597-47d2-af23-18f1636b3564'` — porque o `2.5-flash` continua 404 em chaves novas (Regra #2).

**Passo 4 — Melhorar o erro para casos assim**

Quando o Google devolver `API_KEY_INVALID`, o `[googleChat] provider error` já loga o corpo. Vou fazer o `ai-chat` propagar uma mensagem específica pra `ai_usage.error`: `"Gemini API_KEY_INVALID — verifique se a Generative Language API está habilitada no GCP project X"` em vez do JSON cru. Assim a próxima ocorrência é auto-explicativa.

**Passo 5 — Instrução pra você (fora do código)**

Independente do fix, abra https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=124528952777 e confirme que **Generative Language API** está **Enabled**. Se não estiver, ative e aguarde 1–2min. Isso resolve 90% dos `API_KEY_INVALID` com chaves `AQ.`.

**Passo 6 — Atualizar a doc**

`docs/ai/GEMINI_API_QUIRKS.md`:
- Corrigir a Regra #8 anterior (chaves `AQ.` são válidas, não recusar).
- Nova Regra #9: usar `x-goog-api-key` header em vez de `?key=`.
- Nova Regra #10: em `API_KEY_INVALID`, o suspeito nº1 não é a chave — é a API não estar habilitada no projeto GCP dono da chave.

## Validação

- Você manda "oi" pro Febracis.
- `ai_usage` mostra `status=success`, `output_tokens>50`, `replied=true`.
- Se ainda vier `API_KEY_INVALID`, você abre o link do passo 5 e habilita a API.

## Detalhes técnicos (opcional)

- Header `x-goog-api-key` é a forma canônica atual documentada no `curl quickstart` da própria AI Studio (botão "Copy cURL quickstart" no print).
- `gemini-flash-latest` é alias mantido pelo Google, roteia hoje pra `gemini-flash-2.5-002`; funciona em `v1` e `v1beta`.
- A migração do modelo é 1 linha, não toca em RLS nem estrutura.

## Confirma?

Se ok, saio do modo plano e implemento nessa ordem. Qualquer objeção (ex.: você prefere manter `?key=` como fallback, ou não quer ampliar o dropdown), me diga antes.
