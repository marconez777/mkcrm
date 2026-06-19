## Causa raiz

Os 3 agentes (Resumidor / Tipificador / Maestro) **nunca executam** porque o `pipeline-classify` aborta antes, no gate global `isClinicPipelineAllowed` (`supabase/functions/_shared/pipeline-allowlist.ts`). Esse gate consulta `pipeline_automation_allowlist` e, se a clínica do lead não estiver lá com `enabled=true`, retorna `{ skipped: "clinic_not_allowlisted" }` — exatamente o que aparece nos logs recentes (4/4 leads pulados).

Estado atual da tabela:

| clinic_id | enabled | leads 7d |
|---|---|---|
| cf038458-457d-4c1a-9ac4-c88c3c8353a1 | ✅ true | 48 |
| **46e43fd2-2b02-4615-85c4-fc98543f55c1** (principal) | ❌ ausente | **3.445** |
| 467ed266-… | ❌ ausente | 17 |
| d0a57fa2-… | ❌ ausente | 3 |

## Ação

Inserir **apenas** a clínica principal `46e43fd2-2b02-4615-85c4-fc98543f55c1` na allowlist com `enabled=true`. Demais clínicas continuam fora (conforme sua resposta).

```sql
INSERT INTO public.pipeline_automation_allowlist (clinic_id, enabled)
VALUES ('46e43fd2-2b02-4615-85c4-fc98543f55c1', true)
ON CONFLICT (clinic_id) DO UPDATE SET enabled = EXCLUDED.enabled;
```

Cache em memória do gate tem TTL de 30s, então em ~30s o próximo tick do `pipeline-classify` já deve rodar os 3 agentes nos leads dessa clínica. Nada de UI, nada de banner — só o INSERT.

## Validação

1. Após aplicar, aguardar 1 tick (~20s) e abrir `/pipeline-runs`.
2. Verificar nos logs do `pipeline-classify` que os eventos deixam de ter `skipped:"clinic_not_allowlisted"` para a clínica principal.
3. Confirmar que os cards dos 3 agentes aparecem populados na timeline dos leads.
