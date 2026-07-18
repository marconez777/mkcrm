# Roadmap — Inbound WhatsApp Clínica ÓR (cf038458…)

## Diagnóstico já confirmado (não é a Evolution)

- **Instância `Recepção` (`or-770323a5`) está `open`** e o webhook está saudável (`webhook_ok=true`, sem `webhook_last_error`).
- **Webhooks inbound estão chegando**: 189 eventos `MESSAGES_UPSERT` com `fromMe=false` desde 2026-07-16 23:00, todos com `processed_at` preenchido e `error` nulo.
- **Nenhuma mensagem inbound é persistida desde 2026-07-16 22:55** (último `messages.from_me=false` para a clínica). Outbound continua sendo gravado normalmente.
- **Causa real** (identificada em `postgres_logs`): erro repetido `column ptc.slug does not exist`, disparado pela função `tg_enqueue_classifier` (trigger `trg_messages_enqueue_classifier`, `AFTER INSERT ON public.messages`).
  - A função faz `SELECT ptc.slug FROM public.pipeline_tenant_classifiers ptc …`, mas o schema real de `pipeline_tenant_classifiers` só tem `clinic_id, enabled, classifier_version, override_prompts, allowed_intents, locked_stages, active_agents, created_at, updated_at` — **não existe coluna `slug`**.
  - Como o trigger é `AFTER INSERT` e faz `RAISE` implícito na consulta, a transação inteira do INSERT em `messages` é abortada. `ingestMessage` engole o erro (`Promise.allSettled` + `console.error`) e o webhook responde 200 sem gravar nada.
  - O guard `IF NEW.from_me IS NOT TRUE` explica por que **só inbound** quebra — outbound passa sem tocar a query defeituosa.
- Efeito colateral: a função `dispatch_pipeline_classifiers` (usada pelo cron do namespace pipeline-classifier) também referencia colunas inexistentes (`ptc.slug, ptc.edge_function_name, ptc.cron_enabled`) — está quebrada de forma silenciosa também.

## Fase 1 — Estancar (destrava inbound imediatamente)

**Objetivo:** voltar a receber mensagens dos pacientes hoje, sem depender do namespace pipeline-classifier.

1. Migration corrigindo `tg_enqueue_classifier` para usar o schema real de `pipeline_tenant_classifiers`:
   - Trocar `SELECT ptc.slug` por uma checagem de existência do registro (`EXISTS … WHERE ptc.clinic_id = l.clinic_id AND ptc.enabled = true`).
   - Derivar o `v_tag_ns` a partir de um slug estável (por ex. `classifier_version` ou hardcoded `'default'`) até o schema formal do registry existir.
2. Adicionar `EXCEPTION WHEN OTHERS THEN … RETURN NEW` no trigger, para que **qualquer** erro futuro na enfileiragem não derrube mais o INSERT em `messages` (defesa em profundidade — mesma lição do webhook race).
3. Backfill: rodar `evolution-backfill-all` (ou `evolution-sync-lead` para o handful de leads afetados) para importar os 189 inbounds perdidos desde 2026-07-16 22:55.

**Critério de saída:** contagem de `messages.from_me=false` para a clínica cresce em tempo real após um teste manual, e os logs `postgres_logs` param de cuspir `ptc.slug does not exist`.

## Fase 2 — Consertar o dispatcher do namespace pipeline-classifier

**Objetivo:** deixar `dispatch_pipeline_classifiers` alinhado ao schema real (ele hoje é cron-lixo silencioso).

1. Auditar a função `dispatch_pipeline_classifiers` e comparar com a migration mais recente do roadmap G3/G17.
2. Duas opções (a decidir com o usuário no fim da fase):
   - **(A) Recolocar colunas ausentes** (`slug text`, `edge_function_name text`, `cron_enabled boolean`) em `pipeline_tenant_classifiers` via migration — se o design do roadmap PIPELINE_TENANT_ROADMAP.md prevê essas colunas.
   - **(B) Reescrever a função** para consumir a estrutura atual (uma linha por clínica, sem multi-slug) — se o roadmap mudou de forma e essas colunas foram descontinuadas.
3. Desligar o cron temporariamente até a função voltar a compilar sem erro, para parar o spam no `postgres_logs`.

## Fase 3 — Blindagem para não repetir

**Objetivo:** garantir que qualquer trigger novo em `messages` nunca mais engula silenciosamente a ingestão.

1. Ajustar `ingestMessage` (`supabase/functions/_shared/evolution.ts`) para escrever o erro real na linha de `webhook_events.error` quando o `insert` em `messages` rejeitar — hoje ele só faz `console.error` e o audit fica vazio, o que atrasou este diagnóstico em ~30h.
2. Adicionar teste smoke em `check_recent.py` / novo script que compara **eventos `MESSAGES_UPSERT` com `fromMe=false`** vs **linhas em `messages` com `from_me=false`** por clínica nas últimas 6h; alerta se a razão cair abaixo de X.
3. Documentar em `docs/evolution/TROUBLESHOOTING.md` a assinatura do bug (webhook 200 + audit sem erro + zero inbound + `postgres_logs` com trigger error) para acelerar futuros incidentes.

## Ordem de execução sugerida

Fase 1 → validar em produção com o usuário → Fase 3.1 (patch de logging) → Fase 2 → Fase 3.2/3.3.

## Detalhe técnico (referência)

- Arquivo do trigger: função PL/pgSQL `tg_enqueue_classifier` (definição já lida via `pg_get_functiondef`).
- Arquivo do ingest: `supabase/functions/_shared/evolution.ts` linhas 515–539 (insert em `messages`) e 528–538 (tratamento silencioso do erro).
- Webhook handler: `supabase/functions/evolution-webhook/index.ts` linhas 48–58 (só grava `error` no audit quando `res.skipped`, não quando o `insert` explode).
- Backfill/re-sync: `supabase/functions/evolution-backfill-all` e `evolution-sync-lead`.
