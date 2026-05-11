## Análise do Agente Classificador (Pipeline Watcher)

### 1. Configuração atual — está tecnicamente correta

| Item | Valor |
|---|---|
| Agente | **Classificador de Pipeline** (`e2b20d28-…`) |
| `silent` / `role` | `true` / `classifier` ✅ |
| `enabled` | `true` ✅ |
| Modelo | `gpt-4o` (OpenAI, com `api_key` configurada) ✅ |
| Tools | `move_lead_stage`, `add_lead_note`, `update_custom_field` ✅ |
| Debounce | 15 s ✅ |
| Instância vinculada | "Recepção" (`watcher_agent_id` setado) ✅ |
| **Pipeline restrito** | **`watcher_pipeline_id = NULL`** ⚠️ |

O `system_prompt` cobre as três responsabilidades pedidas: mover etapa, anotar motivo e preencher campos personalizados (com a regra especial conservadora para `origem`).

### 2. Teste funcional ao vivo — passou ✅

Chamei `ai-chat` direto contra um lead real ("MK", pipeline Agendamentos Novo) com a mensagem `"Olá, gostaria de marcar uma consulta de psiquiatria"`. O agente, em um único turno, executou:

- `update_custom_field("interesse", "Consulta com psiquiatria")` ✅
- `move_lead_stage("Qualificação")` ✅ (etapa real do funil oficial)
- `add_lead_note("Cliente solicitou marcação de consulta de psiquiatria – movido para Qualificação.")` ✅

E devolveu resposta vazia para o cliente, como esperado.

### 3. Problema #1 — Watcher não está restrito ao funil oficial ⚠️

Hoje `whatsapp_instances.watcher_pipeline_id` está **NULL** na instância "Recepção". Isso significa que o classificador roda para **qualquer lead daquela instância**, mesmo se ele estiver em "Medicos Parceiros", "Base de Pacientes", "Nutrição", etc. — e pode acabar movendo lead de outro funil para uma etapa cujo nome também exista.

**Correção:** travar o watcher no pipeline "Agendamentos Novo" (`737242e7-8efc-4a8f-9fed-f09c6e5dc227`).

```sql
UPDATE whatsapp_instances
   SET watcher_pipeline_id = '737242e7-8efc-4a8f-9fed-f09c6e5dc227'
 WHERE id = '1fbed71c-063b-45c9-8045-4cf8b42b4934';
```

Após isso, leads em outros funis recebem `skipped: pipeline-mismatch` no `ai-auto-reply` e o classificador só atua no funil oficial.

### 4. Problema #2 — Histórico de execuções zerado ⚠️

`ai_usage` tem **0 linhas** para o classificador desde sua criação (10/05), mesmo com 41 leads ativos nos últimos 7 dias na instância "Recepção" e mensagens chegando agora há minutos.

Diagnóstico já feito:
- Agente está `enabled=true` e tem `api_key` válida (testei manualmente — funciona).
- Wiring `evolution-webhook → ai-auto-reply → enqueueAgent` está correto.
- Ao chamar `ai-auto-reply` manualmente, ele responde `watcher: { queued: true, silent: true }`.
- Pouco depois, `pending_replies` é esvaziado **mas nenhuma linha aparece em `ai_usage` nem em logs de `ai-chat`**.

Hipóteses prováveis:
1. O `scheduled-dispatcher` está fazendo `DELETE … RETURNING` da fila e em seguida o fetch para `ai-chat` está sendo abortado pelo runtime (cron termina antes do `await fetch`). Como o `processPendingReplies` não usa `EdgeRuntime.waitUntil`, qualquer cold start curto da função pode cortar a request.
2. Race entre dois ticks de cron pegando a mesma linha (também explicaria sumiço sem trace).

**Correção:** instrumentar e endurecer o dispatcher:
- Adicionar `console.log` antes/depois do `fetch ai-chat` em `supabase/functions/scheduled-dispatcher/index.ts`.
- Envolver o processamento em `EdgeRuntime.waitUntil(...)` para sobreviver ao retorno HTTP.
- Logar em `ai_usage` com `status='error'` quando `aiResp.ok === false` (hoje só incrementa `failed`).

### 5. Plano de execução

1. **Travar o watcher no funil "Agendamentos Novo"**
   - `UPDATE whatsapp_instances SET watcher_pipeline_id = '737242e7-…' WHERE id = '1fbed71c-…'` (via insert tool).

2. **Endurecer o `scheduled-dispatcher`** (`supabase/functions/scheduled-dispatcher/index.ts`)
   - Logar cada item processado (`agent_id`, `lead_id`, status do fetch, latência).
   - Usar `EdgeRuntime.waitUntil` para garantir que o `fetch` ao `ai-chat` complete mesmo após o retorno do tick.
   - Em caso de `aiResp.ok === false`, escrever uma linha em `ai_usage` (`status='error'`) com o status code para ficar visível em `/metrics/ops`.

3. **Backfill rápido (opcional)** — disparar `ai-auto-reply` para os leads ativos nos últimos 7 dias no funil oficial, para o classificador rodar sobre o histórico recente e popular campos personalizados que ficaram em branco.

4. **Verificação final**
   - Após o deploy, esperar 2 minutos e conferir:
     - `SELECT count(*) FROM ai_usage WHERE agent_id='e2b20d28-…' AND created_at > now()-interval '5 minutes'` > 0.
     - `SELECT count(*) FROM lead_events WHERE type='stage_changed_by_ai' AND created_at > now()-interval '1 hour'` aumentando.
     - Logs do `scheduled-dispatcher` mostram chamadas `ai-chat` com 200.

Sem mudanças de schema; apenas um UPDATE em `whatsapp_instances` e edição de uma edge function.