## Objetivo
Descobrir por que, mesmo com `clinic_secrets.active_ai_provider='gemini'` e chave salva, os agents do pipeline aparecem com `provider: "lovable"` na resposta.

## Hipóteses (a confirmar com logs)
1. `clinic_secrets` está sendo consultado com `clinic_id` diferente do esperado (ex.: clínica do lead vs. clínica autenticada) → retorna `null` em `active_ai_provider`.
2. RLS em `clinic_secrets` bloqueia leitura quando o agent usa client com role diferente do service_role.
3. Coluna `gemini_api_key` está vazia (a UI salvou apenas no openai column ou o status ficou inválido) → `getClinicGemini` retorna `null` e cai no fallback.
4. `createGoogleGenerativeAI` lança no `model(id)` por algum motivo de versão e o try/catch do agent reporta apenas o `provider` do fallback.
5. O campo `provider` reportado na resposta vem de um caminho diferente (ex.: response do gateway), não do `getClassifierAi` — pode estar sempre "lovable" por bug de logging.

## Roadmap de diagnóstico

### Fase 1 — Instrumentação (logs estruturados)
Adicionar logs JSON (`console.log(JSON.stringify({...}))`) sem vazar a chave:

- `_shared/clinic-gemini.ts → getClinicGemini`:
  - Log de entrada: `{ tag:"clinic-gemini", step:"query", clinic_id }`
  - Log do resultado da query: `{ tag, step:"query-result", has_error, error_code, has_key, key_len, gemini_status }`
  - Log de saída: `{ tag, step:"resolved", ok:true }` ou `{ ok:false, reason }`

- `_shared/classifier-ai.ts → getClassifierAi`:
  - Log da leitura: `{ tag:"classifier-ai", step:"active-provider", clinic_id, active_raw, active_normalized }`
  - Log da decisão: `{ tag, step:"resolve", requested, resolved_provider, fallback_used:bool, reason? }`
  - Se `active='google'` e `resolveProvider` retornar `null`, logar `{ reason:"gemini_key_missing" }` antes de cair no fallback.

- Nos agents (`pipeline-classify`, `pipeline-position-auditor`, `pipeline-post-move-verifier`, `pipeline-summarize`):
  - Logar `{ tag:"agent", name, clinic_id, provider_used, model_id }` antes de cada `generateText`.

### Fase 2 — Reproduzir e coletar
1. Deploy das funções com os novos logs.
2. Disparar `pipeline-classify` manualmente para o mesmo lead do teste anterior (clínica Ór).
3. Ler `edge_function_logs` filtrando por `tag:"clinic-gemini"` e `tag:"classifier-ai"` para identificar em qual passo o fluxo desvia.

### Fase 3 — Validar dados em `clinic_secrets`
Consulta de auditoria (somente leitura) para a clínica em teste:
```sql
select clinic_id, active_ai_provider,
       (gemini_api_key is not null) as has_gemini,
       length(coalesce(gemini_api_key,'')) as gemini_len,
       gemini_status,
       (openai_api_key is not null) as has_openai,
       openai_status
from clinic_secrets where clinic_id = '<id>';
```
Confirmar que `active_ai_provider='gemini'` e `gemini_api_key` está preenchida.

### Fase 4 — Correção (depende do achado)
Cenários previstos e fix:
- **Se `active_ai_provider` vier null/openai**: a UI não está persistindo a troca de aba — corrigir `OpenAIKeyCard` / endpoint `set-active-provider`.
- **Se RLS bloquear**: garantir que os agents usam `service_role` para ler `clinic_secrets` (todos os edge functions de pipeline já criam client com service role — confirmar nas chamadas).
- **Se `clinic_id` divergir**: padronizar a resolução de `clinic_id` no agent (ex.: usar `leads.clinic_id` e não a clínica do usuário autenticado).
- **Se `createGoogleGenerativeAI` falhar**: capturar a exceção em `getClinicGemini`, logar `reason` e (opcional) downgrade controlado.

### Fase 5 — Validação final
1. Redeploy das functions afetadas.
2. Rodar novamente `pipeline-classify` no lead de teste.
3. Confirmar nos logs `provider_used:"google"` e `model_id:"gemini-2.5-flash"` (ou equivalente).
4. Verificar na resposta da function que `provider:"google"` aparece no payload.

## Entregáveis
- Logs estruturados nos 2 helpers + 4 agents.
- Relatório curto no chat com o achado (qual hipótese se confirmou) e o fix aplicado.
- Deploy de todas as functions tocadas.

## Não-objetivos
- Não mudar a lógica de fallback (continua caindo no Lovable Gateway se BYOK falhar) — apenas tornar visível o porquê.
- Não mexer na UI de configuração de chaves nesta fase, exceto se a Fase 3 mostrar que o `active_ai_provider` não está sendo persistido.
