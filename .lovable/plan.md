## Objetivo
Permitir que contas do plano **Supreme** usem os créditos de IA da Lovable diretamente no builder de agentes. Um novo provedor aparece na lista com o rótulo **"Gemini Chat Funnel AI"** (internamente `lovable`), sem exigir chave de API do usuário.

## Escopo (o que muda)

### Frontend — `src/pages/ai/AgentWizard.tsx`
- Adicionar novo item em `PROVIDERS`:
  - `id: "lovable"`, `label: "Gemini Chat Funnel AI"`, `defaultModel: "google/gemini-2.5-flash"`, `baseExample: "https://ai.gateway.lovable.dev/v1"`, `placeholder: "(gerenciado pela Chat Funnel AI)"`.
- Adicionar entrada em `MODELS_BY_PROVIDER.lovable`:
  - `google/gemini-2.5-flash-lite` (Rápido), `google/gemini-2.5-flash` (Equilíbrio), `google/gemini-2.5-pro` (Qualidade).
- Ampliar o tipo `Provider` para incluir `"lovable"`.
- Detectar plano Supreme via `useSubscription` (usar `subscription.price_id` — o token antes do primeiro `_` é o `plan.id`). Passar `isSupreme` para o passo do provedor.
- Renderizar o botão do provedor `lovable` apenas quando `isSupreme === true`. Se o usuário não é Supreme e o agente já está salvo com `lovable`, mostrar aviso e permitir só leitura.
- Quando `provider === "lovable"`:
  - Ocultar campo **API Key** e **Base URL**; forçar `base_url = "https://ai.gateway.lovable.dev/v1"` e `api_key = null` no persist.
  - No botão "Testar conexão", chamar a mesma edge de teste passando `provider: "lovable"` — o backend valida via `LOVABLE_API_KEY` do projeto.
  - Exibir badge "Usando créditos Chat Funnel AI" no card.

### Frontend — listagem `src/pages/Agents.tsx`
- Onde exibe o provedor (mapa de labels), acrescentar `lovable → "Gemini Chat Funnel AI"`.

### Backend — `supabase/functions/_shared/ai.ts`
- Estender union `Provider` com `"lovable"`.
- Em `chatOnce`, novo branch:
  ```ts
  else if (agent.provider === "lovable") {
    resp = await openaiCompatibleChat(
      { ...agent, api_key: Deno.env.get("LOVABLE_API_KEY")! },
      messages, tools,
      "https://ai.gateway.lovable.dev/v1",
      { extraHeaders: { "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY")!, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } },
    );
  }
  ```
- Ajustar `openaiCompatibleChat` para aceitar `extraHeaders` opcionais (usa header `Lovable-API-Key` em vez de `Authorization`).
- Em `requireKey`, tratar `lovable` como caso especial (não exige `agent.api_key`).
- Embeddings: `lovable` não expõe embeddings hoje → se `agent.provider === "lovable"` e faltar `embedding_api_key`, lançar erro claro pedindo chave OpenAI de embeddings (mesmo comportamento atual do Anthropic).

### Backend — edge de teste de chave do agente
- No handler que valida provider do wizard: se `provider === "lovable"`, pular verificação de `api_key` e apenas checar presença de `LOVABLE_API_KEY` no ambiente, retornando ok.

### Autorização server-side (defesa em profundidade)
- Ao salvar/atualizar agente com `provider = "lovable"`, validar no handler que a clínica tem assinatura Supreme ativa. Se não tiver, rejeitar com 403 "Provedor disponível apenas no plano Supreme".

## Não escopo
- Nada muda para agentes existentes com `openai/google/anthropic/xai/manus`.
- Sem alteração no pipeline determinístico (já usa Lovable Gateway global).
- Sem novo controle de cota — os limites de créditos Lovable do workspace já se aplicam.

## Detalhes técnicos
- Detecção de plano no client:
  ```ts
  const tier = subscription?.price_id?.split("_")[0]; // "starter" | "pro" | "supreme"
  const isSupreme = tier === "supreme";
  ```
  Como esse valor pode ser burlado no navegador, a checagem real acontece nas edge functions ao gravar/rodar o agente.
- Nomes de modelo enviados ao gateway devem manter o prefixo do vendor (`google/gemini-2.5-flash`), pois o Lovable Gateway exige `vendor/model`.
- Nenhum arquivo auto-gerado (`client.ts`, `types.ts`, `.env`) é tocado.
