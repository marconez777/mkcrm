---
title: Pegadinhas (Pitfalls)
topic: auth
kind: reference
audience: agent
updated: 2026-06-07
---
# Pegadinhas (Pitfalls)

> **Quando ler:** **SEMPRE antes** de mexer em qualquer coisa. Esta é a lista de erros que a IA (e humanos) já cometeu múltiplas vezes neste projeto.
> **Última atualização:** 2026-06-03

---

## Banco & RLS

### 1. Mexer em `auth.users` diretamente
**Erro:** tentar `INSERT/UPDATE auth.users` ou criar trigger nela.
**Por quê dói:** Supabase gerencia esse schema. Vira service degradation, restore quebra.
**Faça:** usar `profiles` no schema `public` espelhando `id`. Triggers em `auth.users` são proibidos (ver `conventions/SUPABASE_RULES.md`).

### 2. Roles na tabela `profiles`
**Erro:** adicionar coluna `role` em `profiles`.
**Por quê:** permite escalada de privilégio (user pode editar próprio profile).
**Faça:** sempre tabela `user_roles` + função `has_role()` SECURITY DEFINER. Ver `architecture/AUTH.md`.

### 3. CHECK constraint com `now()` / função volátil
**Erro:** `CHECK (expire_at > now())`.
**Por quê:** Postgres exige immutable; quebra em restore.
**Faça:** validation trigger BEFORE INSERT/UPDATE.

### 4. RLS policy esquecida em tabela nova
**Erro:** criar tabela e esquecer `ALTER TABLE ... ENABLE RLS` + policies.
**Sintoma:** linter avisa; ou app não lê nada (deny default) ou lê tudo (RLS off).
**Faça:** toda migration de `CREATE TABLE` termina com enable RLS + policies mínimas.

### 5. `auth.uid()` direto em subquery de policy grande
**Erro:** plan ruim, scan completo.
**Faça:** envelopar em função STABLE.

---

## Edge functions

### 6. Esquecer CORS em resposta de erro
**Erro:** sucesso retorna com `corsHeaders`, erro não. Frontend vê "CORS error" enganoso.
**Faça:** `corsHeaders` em **toda** Response, inclusive 4xx/5xx.

### 7. Promise não awaited no `shutdown`
**Erro:** `fetch(...).then(...)` sem await, edge function termina antes.
**Faça:** `await` ou `EdgeRuntime.waitUntil(promise)`.

### 8. Webhook retornando 500
**Erro:** erro interno bubble pra response → Evolution/Resend reentrega N vezes → duplicatas.
**Faça:** **sempre** 200 em webhook; loga erro internamente.

### 9. Usar `service_role_key` em código frontend
**Crítico.** Vaza segredo no bundle.
**Faça:** só em edge functions, via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.

### 10. Chamar edge function por path absoluto
**Erro:** `fetch('/api/foo')` ou `fetch('https://supabase.co/...')` hardcoded.
**Faça:** `supabase.functions.invoke('foo', {...})` OU construir com `import.meta.env.VITE_SUPABASE_PROJECT_ID`.

### 11. Editar `src/integrations/supabase/{client,types}.ts`
**Proibido.** Auto-gerado.

### 12. Editar `.env` ou criar `.env.local`
**Proibido.** Lovable Cloud gerencia.

### 13. Criar segundo `supabase/config.toml`
**Proibido.** Só **um** existe.

---

## WhatsApp / Evolution

### 14. Esquecer `messages.external_id` UNIQUE
**Sintoma:** mesma msg aparece 3× no Inbox (reentrega Evolution).
**Faça:** sempre UPSERT em `messages` com chave única `(clinic_id, external_id)`. `evolution_message_id` **não existe** — a coluna real é `external_id`.

### 15. Enviar mp3 como áudio
**Sintoma:** Evolution retorna 200, WhatsApp descarta silenciosamente.
**Faça:** converter para `ogg/opus`.

### 16. Tratar grupos como leads
**Erro:** salvar mensagem de `@g.us`.
**Faça:** ignorar grupos no `evolution-webhook`.

### 17. Comparar telefone sem `normalizePhoneBR`
**Sintoma:** lead duplicado (`5511999999999` vs `+5511999999999` vs `11999999999`).
**Faça:** **sempre** normalizar antes de query/insert/compare.

---

## IA

### 18. Loop infinito de tool calls
**Erro:** tool retorna ambíguo, LLM tenta de novo.
**Faça:** hard cap 6 iterações (já implementado em `ai-auto-reply`). Não remover.

### 19. Não validar `tool_calls[].arguments`
**Erro:** modelo inventa campos. Edge function crasha.
**Faça:** Zod parse antes de executar tool.

### 20. Markdown `**bold**` no WhatsApp
**Sintoma:** texto literal `**oi**` no chat.
**Faça:** `*bold*` (WhatsApp dialect). Prompt já instrui; revisar ao trocar modelo.

### 21. Concorrência: 2 mensagens inbound em <1s
**Sintoma:** 2 runs de IA paralelos, resposta dupla.
**Faça:** `pg_advisory_xact_lock(lead_id)` no início.

### 22. Esquecer pause flag `leads.ai_paused`
**Sintoma:** humano respondeu, IA respondeu por cima.
**Faça:** `ai-auto-reply` checa `leads.ai_paused` no início e ignora mensagens onde `messages.bot_agent_id IS NOT NULL` (anti-loop bot↔bot). Não existe trigger `tg_pause_ai_on_human_reply` — pausa é manual ou via tool da IA (`pause_ai_for_lead`).

---

## Email

### 23. From com domínio não verificado
**Sintoma:** Resend 422.
**Faça:** checar `email_domains.status='verified'` antes; fallback para domain compartilhado.

### 24. Pixel/tracking link sem URL absoluta
**Sintoma:** Gmail bloqueia.
**Faça:** sempre `https://<project>.functions.supabase.co/...`.

### 25. Hard bounce não adicionado a `email_unsubscribes`
**Sintoma:** continua tentando → score do domínio cai → spam folder.
**Faça:** handler em `resend-webhook` adiciona automático.

---

## Broadcasts / Sequences

### 26. Freeze de audiência → adicionar lead novo depois
**Comportamento esperado:** lead novo **não** recebe broadcast já criado. Isso é intencional.
**Faça:** se quiser, criar nova broadcast.

### 27. Variant sem `weight`
**Erro:** divisão por zero ou todos no mesmo variant.
**Faça:** default weight=1 no schema.

### 28. Retry automático em `failed`
**NÃO existe** propositalmente. Reenviar = duplicar broadcast com filtro `failed`.

### 29. Sequence `stop_on_reply` falha em silêncio
**Erro:** lead respondeu mas sequence avançou.
**Verificar:** `last_inbound_at > enrollment.created_at` antes de cada step.

---

## Frontend / Design

### 30. Cor hardcoded (`text-white`, `bg-black`)
**Proibido.** Quebra tema dark/light.
**Faça:** tokens semânticos (`text-foreground`, `bg-background`). Ver `frontend/DESIGN_SYSTEM.md`.

### 31. Fonte menor que 15px
**Proibido.** Regra global (acessibilidade).

### 32. `setInterval` para "polling"
**Erro:** quase sempre Realtime resolve melhor.
**Faça:** `useRealtimeList` ou subscription manual; `setInterval` só para timers UI puros.

### 33. Subscription sem cleanup
**Sintoma:** memory leak + WS sobrando.
**Faça:** `useEffect(() => { const ch = ...; return () => supabase.removeChannel(ch); }, [])`.

### 34. `select *` em Realtime de tabela larga
**Sintoma:** payload pesado.
**Faça:** filtrar colunas / linhas com filter expressions.

---

## pg_cron / pg_net

### 35. Job cron duplicado por re-schedule
**Erro:** `cron.schedule('x', ...)` 2× cria 2 jobs.
**Faça:** `cron.unschedule('x')` antes (try/catch).

### 36. Cron em horário local
**Erro:** "08:00" sem qualificar → vira UTC, confunde.
**Faça:** comentar no SQL: `-- 08:00 BRT = 11:00 UTC`.

### 37. Confiar no return de `net.http_post`
**Erro:** retorna `request_id` (assíncrono). Não é sucesso da chamada.
**Faça:** logar do lado da edge function chamada.

---

## Geral

### 38. Modificar arquivo gerado/auto
Lista do que **não** editar:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `.env`
- `supabase/config.toml` (exceto blocos de função específicos quando estritamente necessário)

### 39. Logar PII
- Telefone, email, conteúdo de mensagem em log público = LGPD.
- **Faça:** mascarar (`+55****1234`) ou omitir.

### 40. Esquecer de atualizar a doc
**Regra:** mudou código → atualizar doc no mesmo PR, renovar data do topo do arquivo.

### 41. Campanha de email sem `segment_ids[]` ≠ "sem destinatários"
**Erro:** assumir que `email_campaigns.segment_ids = NULL/[]` é um estado inválido ou bloqueante.
**Realidade:** quando `segment_ids` é vazio E `segment_id` (legado) também é null, o `dispatch-campaign` interpreta como **"todos os leads + contatos de `email_segment_contacts`"**. Filtrar/exigir segmento na UI sem entender isso esconde campanhas válidas.
**Faça:** ler `flows/EMAIL_CAMPAIGN.md` e `features/EMAIL_CAMPAIGNS.md` antes de mudar a query de listagem.

### 42. Tentar pausar manualmente campanha pausada por bounce-health
**Erro:** mexer em `email_campaigns.status` quando a pausa veio de `check_clinic_bounce_health`.
**Por quê:** o alerta em `email_health_alerts` permanece aberto; sem revisar bounce/complaint rate, retomar dispara nova pausa em minutos.
**Faça:** investigar `email_health_alerts` (com `metric_value`/`threshold`/`sample_size`) e suprimir manualmente bounces ruins antes de retomar.

### 43. Bot respondendo bot (loop infinito)
**Erro:** dois agentes IA conversando em loop via WhatsApp.
**Faça:** sempre setar `messages.bot_agent_id` ao enviar via IA. `ai-auto-reply` ignora mensagens com `bot_agent_id IS NOT NULL`. Ver `flows/AI_AGENT_LOOP.md`.

---

## Arquivos-chave

- `conventions/SUPABASE_RULES.md`
- `conventions/SECURITY.md`
- `architecture/AUTH.md`
- `known-issues/DEBT.md`
- `operations/ERROR_HANDLING.md`
