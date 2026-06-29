## Correção da versão do @ai-sdk/google

**Problema:** `clinic-gemini.ts` importa `@ai-sdk/google@^1`, incompatível com AI SDK 5/6 (specification v2).

**Mudança única:**
- Em `supabase/functions/_shared/clinic-gemini.ts`, trocar:
  ```
  import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^1";
  ```
  por:
  ```
  import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^3";
  ```

**Deploy:** redeploy de todas as functions de pipeline que dependem de `_shared/clinic-gemini.ts` (e do `clinic-openai-key` por consistência):
- pipeline-classify
- pipeline-position-auditor
- pipeline-post-move-verifier
- pipeline-summarize
- pipeline-auto-retry
- pipeline-deterministic
- pipeline-run-executor
- pipeline-monthly-cycle-or
- pipeline-queue-alert
- pipeline-evals-run
- clinic-openai-key

**Validação:** após deploy, conferir logs de `pipeline-summarize` e `pipeline-classify` para confirmar que o erro "Unsupported model version v1" desapareceu.
