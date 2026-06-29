## Objetivo
Adicionar suporte **BYOK Gemini** lado-a-lado com a OpenAI já existente, sem remover nada. A clínica passa a escolher qual provedor está ativo (`active_ai_provider`) e os agentes do pipeline (`pipeline-classify`, `pipeline-position-auditor`, `pipeline-post-move-verifier`) usam o SDK certo automaticamente.

---

## Fase 1 — Banco de dados

Migration `add_gemini_byok_to_clinic_secrets`:

1. `ALTER TABLE public.clinic_secrets` adicionando:
   - `gemini_api_key text`
   - `gemini_key_last4 text`
   - `gemini_status text NOT NULL DEFAULT 'empty'` (`empty|configured|invalid`)
   - `gemini_last_checked_at timestamptz`
   - `gemini_last_error text`
   - `active_ai_provider text NOT NULL DEFAULT 'openai'` (`openai|gemini`)
   - `CHECK (active_ai_provider IN ('openai','gemini'))`

2. Recriar `public.get_clinic_openai_status(_clinic_id uuid)` (SECURITY DEFINER) devolvendo também os campos Gemini + `active_ai_provider`. Mantém o nome para não quebrar o frontend que já chama o RPC.

3. Nova function `public.get_clinic_ai_secrets(_clinic_id uuid)` (SECURITY DEFINER, `REVOKE ALL FROM public/authenticated; GRANT EXECUTE TO service_role`) devolvendo `openai_api_key`, `gemini_api_key`, `active_ai_provider` — usada apenas pelas edge functions.

Nenhuma coluna existente é removida.

---

## Fase 2 — Edge function `clinic-openai-key`

Estender a function (mesmo endpoint, sem quebrar contrato atual):
- Aceitar `provider: "openai" | "gemini"` no body (default `"openai"` quando ausente).
- Para `provider === "gemini"`:
  - `set` valida chamando `GET https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=<chave>`.
  - Persistir em `gemini_api_key`/`gemini_key_last4`/`gemini_status`, e setar `active_ai_provider='gemini'`.
  - `test`/`clear` operam sobre as colunas Gemini.
- Para `provider === "openai"` (comportamento atual): ao `set` com sucesso, também grava `active_ai_provider='openai'`.
- `status` passa a devolver o objeto novo (OpenAI + Gemini + active).

---

## Fase 3 — Helper Gemini + classifier-ai

1. Novo `supabase/functions/_shared/clinic-gemini.ts`:
   ```ts
   import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^1";
   ```
   `getClinicGemini(client, clinicId)` lê `gemini_api_key` de `clinic_secrets` e devolve `{ apiKey, model: (id) => provider(id) }`.

2. Atualizar `supabase/functions/_shared/classifier-ai.ts`:
   - Tipo `ClassifierAi.provider` passa a aceitar `"lovable" | "openai" | "google"`.
   - `getClassifierAi(client, clinicId, opts)` consulta `clinic_secrets.active_ai_provider`. Se `gemini` → tenta `getClinicGemini` e retorna `{ model, provider: "google" }`. Se `openai` → `getClinicOpenAI` (atual). Fallback final = Lovable Gateway (mantém comportamento atual quando provider for null/inválido). `opts.forceProvider` continua válido para callers explícitos.
   - `pickModel` aceita `spec: { openai: string; lovable: string; google?: string }` e, para `provider === "google"`, retorna `spec.google ?? spec.lovable`.

3. `pipeline-classify/agent-core.ts` — atualizar cada `*_SPEC` adicionando o campo `google`:
   - `SUMMARIZER`/`MAESTRO`/`MOVIMENTADOR`/`AGENDADOR` → `gemini-2.5-flash`.
   - `TYPIFIER` e fallback rápido → `gemini-2.5-flash-lite`.
   Mantém `openai` e `lovable` como estão. Nenhuma mudança em `withJsonFallback`.

4. Sem mudanças em `pipeline-position-auditor` / `pipeline-post-move-verifier` além de adicionar `google` em seus `MODEL_SPEC` locais.

---

## Fase 4 — UI: `OpenAIKeyCard.tsx`

Renomear para `AIProviderKeyCard.tsx` (atualizar import em `src/pages/Settings.tsx`).

- Adicionar **Tabs** "OpenAI" / "Google Gemini" no topo do card.
- Estado `status` passa a guardar campos OpenAI + Gemini + `active_ai_provider`.
- Cada aba renderiza:
  - Badge de status próprio (Configurada / Inválida / Pendente).
  - Input correspondente (`sk-…` ou `AIza…`).
  - Botões "Salvar e testar" / "Testar conexão" / "Remover" enviando `provider` no payload.
  - Link de ajuda apropriado (`platform.openai.com/api-keys` ou `aistudio.google.com/app/apikey`).
- Badge global **"Provedor ativo: OpenAI / Gemini"** no header do card, baseado em `active_ai_provider`.
- Ao salvar com sucesso, o `active_ai_provider` retornado é refletido na UI.

Nada do fluxo OpenAI atual é removido — apenas movido para dentro da aba "OpenAI".

---

## Fase 5 — Verificação

- `tsgo` no frontend.
- Linter Supabase após migration.
- Smoke test manual: configurar uma chave Gemini fake, ver erro de validação; configurar OpenAI continua funcionando; alternar provedor ativo reflete no badge.

---

## Detalhes técnicos relevantes
- Dependência nova: `npm:@ai-sdk/google@^1` (importada apenas em edge functions Deno via `npm:` — não toca em `package.json`).
- `withJsonFallback` em `agent-core.ts` continua tratando falhas de schema; nada muda lá.
- RLS de `clinic_secrets` não muda (continua só `service_role`); a UI continua acessando via edge function.
- `get_clinic_openai_status` mantém o nome para não quebrar o frontend gerado em `types.ts`; ganha colunas novas.