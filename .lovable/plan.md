# Diagnóstico e correção: webhook do WhatsApp parou em 06/05

## O que está acontecendo

Comparando o relógio do banco (`now() = 2026-05-10 14:37`) com o último evento gravado em `webhook_events` (`2026-05-06 14:18:06`), nada de fora chega há ~4 dias. Mesmo assim:

- A instância `Recepção` (`or-ce6ec410`) está com `connection_state = 'open'`, `webhook_ok = true` e `last_health_check` atualizado agora há pouco.
- Os logs do `evolution-health` mostram que a função roda a cada minuto sem erro.

Ou seja, a Evolution está conectada, o webhook está configurado certinho — só que **toda tentativa do edge function de gravar o evento recebido falha em silêncio** desde 06/05 14:18.

## Causa raiz

A migration `20260506141907_00b25a56…sql` (rodou exatamente no minuto em que os eventos param) fez duas mudanças que, combinadas, quebram qualquer INSERT vindo de edge function (que usa o `service_role`):

1. `ALTER TABLE public.webhook_events ALTER COLUMN clinic_id SET DEFAULT public.current_clinic_id()` (entre várias outras tabelas).
2. `REVOKE EXECUTE ON FUNCTION public.current_clinic_id() FROM PUBLIC, anon;` + `GRANT … TO authenticated`.

`current_clinic_id()` é `SELECT clinic_id FROM clinic_members WHERE user_id = auth.uid()`. Quando o edge function chama via `service_role`, `auth.uid()` é NULL → a função retorna NULL → o `clinic_id NOT NULL` da tabela rejeita o INSERT (`null value in column "clinic_id" violates not-null constraint`).

O `evolution-webhook` não passa `clinic_id` explícito no `webhook_events.insert(...)` — ele confiava no default. Resultado: cada POST da Evolution morre na primeira linha do try, vai pro catch, devolve 500 para a Evolution. A mesma coisa acontece com o `POLL_RUN` que o `evolution-health` insere a cada minuto, e provavelmente também com o `ingestMessage` (insert em `leads`, `messages`, `lead_events`, etc., todos com o mesmo default quebrado).

Por isso a UI parou: nenhum evento entra no banco, nenhuma mensagem nova aparece, mas a instância "parece saudável" porque o health-check que escreve em `whatsapp_instances` passa o `clinic_id` indiretamente (UPDATE, não INSERT, então o default não é avaliado).

## Como confirmar antes de corrigir

Disparar manualmente o `evolution-health` e olhar o log:

```text
supabase--curl_edge_functions  POST /evolution-health
supabase--edge_function_logs   evolution-health  search="null value"
```

Esperado: erro `null value in column "clinic_id" violates not-null constraint` no insert de `POLL_RUN`.

## Correção (em 2 frentes, na mesma leva)

### Frente 1 — Tornar `current_clinic_id()` segura para `service_role`

Migration:

```sql
GRANT EXECUTE ON FUNCTION public.current_clinic_id() TO service_role;
```

Isso por si só **não resolve**, porque mesmo executando, ela devolve NULL para service_role. Mas é necessário para que o GRANT futuro de outras funções não quebre, e é grátis.

### Frente 2 — Edge functions passam `clinic_id` explícito

Onde a tabela tem `clinic_id NOT NULL` com default `current_clinic_id()`, o edge function precisa passar o valor. Já temos `instance.clinic_id` carregado em todos os pontos relevantes.

Arquivos a editar:

1. **`supabase/functions/evolution-webhook/index.ts`**
   - INSERT em `webhook_events` (audit principal): adicionar `clinic_id: instance.clinic_id`.
2. **`supabase/functions/evolution-health/index.ts`**
   - INSERT em `webhook_events` com `event_type='POLL_RUN'`: adicionar `clinic_id: instance.clinic_id`.
3. **`supabase/functions/_shared/evolution.ts`** (`ingestMessage` e helpers)
   - Verificar todos os INSERT em: `leads`, `messages`, `lead_events`, `lead_internal_notes`, `lead_tasks` etc. Onde houver `clinic_id NOT NULL` sem o default funcionando, passar `instance.clinic_id` (já temos o `Instance` no `opts`).
   - Trigger `record_lead_stage_history` insere com `NEW.clinic_id` (vem do lead) — ok.
4. **Outros edge functions de fundo que escrevem nessas tabelas e podem estar com o mesmo problema** (varredura): `tracking-claim`, `tracking-ingest`, `ai-auto-reply`, `scheduled-dispatcher`, `automations-tick`, `evolution-send`, `evolution-send-media`. Para cada um, garantir que qualquer INSERT em tabela com clinic_id NOT NULL passa o valor explicitamente (carregando do lead/instance que ele já lê).

### Frente 3 — Reprocessar o que ficou de fora

Como a Evolution armazena mensagens recentes, basta forçar o polling com janela maior. Em vez de criar nova função, fazer um disparo único:

- Ajustar temporariamente `POLL_WINDOW_MIN` para `7 * 24 * 60` (7 dias) e chamar `evolution-health` uma vez via `curl_edge_functions`. Depois reverter para 10. Alternativa mais limpa: criar um endpoint `evolution-backfill-window?since=…` (já existe `evolution-backfill-all`, vale checar se serve).

## Verificação após o fix

1. `supabase--curl_edge_functions POST /evolution-health` → resposta 200 com `imported > 0` no `poll`.
2. `psql -c "SELECT MAX(received_at) FROM webhook_events"` → carimbo de hoje.
3. Mandar 1 mensagem de teste do celular pessoal → aparecer em `messages` em até 5 s e na UI do inbox.
4. Olhar `webhook_events` do tipo `MESSAGES_UPSERT` recebidas após o fix, com `error IS NULL`.

## Não está no escopo

- Mexer na lógica de RLS do app (continua funcionando para usuários reais).
- Reescrever `current_clinic_id()` para suportar service_role automaticamente — possível futuramente, mas a correção mínima e mais segura é passar `clinic_id` explícito nos edge functions.
