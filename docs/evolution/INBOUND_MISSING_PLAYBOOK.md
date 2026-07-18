---
title: "Playbook: mensagens inbound não chegando na ferramenta"
topic: integracao
kind: playbook
audience: dev
updated: 2026-07-18
summary: "Passo-a-passo para diagnosticar quando o WhatsApp está enviando/recebendo normalmente mas as mensagens de clientes não aparecem na inbox do CRM."
related_docs:
  - docs/evolution/WEBHOOK_EVOLUTION.md
  - docs/evolution/EVOLUTION_EDGES.md
  - docs/roadmap/INBOUND_INGESTION_FIX.md
---

# Playbook — inbound "sumindo" antes de virar `messages`

> ## ⚠️ REGRA DE OURO (2 incidentes já causados por isso — 2026-07-17 e 2026-07-18)
>
> **Todo trigger que dispara em `messages` — inclusive triggers específicos de um tenant** — DEVE:
>
> 1. Ter o corpo inteiro dentro de
>    `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING '<nome> failed: %', SQLERRM; RETURN NEW; END;`.
>    O caminho de recepção de mensagem **NÃO PODE** depender de trabalho auxiliar
>    (classificador, extração, tags, movimentação de estágio) que possa falhar.
> 2. Ser revisado contra o schema atual de qualquer tabela auxiliar que ele grava
>    (`lead_stage_history`, `lead_events`, `pipeline_tenant_classifiers`, …).
>    Colunas renomeadas silenciosamente derrubam a transação inteira do webhook —
>    a mensagem inbound nunca chega em `messages` e o cliente vê "meu WhatsApp
>    respondeu, mas sumiu do CRM".
>
> **Se você criar/alterar um trigger em `messages` sem cumprir os dois itens
> acima, considere isso um bug de produção crítico.**

Sintoma clássico: cliente **respondeu** no WhatsApp, mas nada aparece no CRM,
mesmo com o número conectado (`connection_state = open`) e o envio outbound
funcionando. Isso significa que a Evolution está entregando o webhook, porém o
INSERT em `public.messages` está sendo abortado (transação toda revertida) —
normalmente por causa de um **trigger quebrado**, não por bug na Evolution.

## 1. Confirmar que webhooks chegam

```sql
select count(*), max(received_at)
from webhook_events
where clinic_id = '<CLINIC_ID>'
  and event_type = 'MESSAGES_UPSERT'
  and received_at > now() - interval '2 hours';
```

Se `count > 0` mas `messages` da mesma janela está vazio ⇒ **é ingest, não é
Evolution**.

## 2. Ver o erro que abortou o insert

Desde o patch de Fase 3.1 (2026-07-18), o `evolution-webhook` grava o erro no
próprio audit row:

```sql
select received_at, error
from webhook_events
where clinic_id = '<CLINIC_ID>'
  and error like 'INGEST_ERROR:%'
order by received_at desc
limit 20;
```

Se aparecer `INGEST_ERROR: … column ptc.<x> does not exist` ⇒ trigger
`tg_enqueue_classifier` (ou similar) está desalinhado do schema de
`pipeline_tenant_classifiers`. Foi a causa do incidente 2026-07-17/18 na
Clínica ÓR.

Nada em `webhook_events.error`? Cai para `postgres_logs` filtrando por
`identifier = 'postgres.errors'` e `event_message ilike '%messages%'`.

## 3. Correções conhecidas

| Sintoma no `error`                                    | Causa                                                                 | Ação                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `column ptc.slug does not exist`                      | Trigger `tg_enqueue_classifier` fora do schema atual.                 | Ver migração `20260718` — o gatilho passou a usar `classifier_version` e ficou blindado com `EXCEPTION WHEN OTHERS`.  |
| `permission denied for table pipeline_tenant_classifiers` | Faltando GRANT para `service_role` ou trigger rodando como INVOKER.  | Rodar `GRANT ALL ON public.pipeline_tenant_classifiers TO service_role;` e garantir `SECURITY DEFINER` no trigger.    |
| `null value in column "clinic_id" of relation "messages"` | Lead foi criado sem `clinic_id` (bug de multi-instância).            | Ver `MULTI_INSTANCE_ROUTING.md` — geralmente `whatsapp_instances.clinic_id` está null.                                |
| `column "pipeline_id" of relation "lead_stage_history" does not exist` (e `column "from"` / `column "to"`) | Trigger `fn_clinica_or_wakeup_inbound` (específico da Clínica ÓR) usava colunas antigas de `lead_stage_history`. Como não estava blindado, derrubava a transação — 256 mensagens inbound perdidas em 4 dias. | Migração `20260718`: colunas trocadas por `from_stage_id`/`to_stage_id`, `pipeline_id` removido e trigger envolvido em `EXCEPTION WHEN OTHERS`. Backfill feito via replay de `webhook_events` (POST do payload salvo de volta para `evolution-webhook`). |

**Regra de ouro:** todo trigger novo que dispara em `messages` (ou em qualquer
tabela do caminho crítico do webhook) precisa embrulhar o corpo em
`BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING …; END;`. Nunca deixar o
caminho de recepção de mensagem depender de trabalho auxiliar (classificador,
extração, tags) que possa falhar.

## 4. Backfill do buraco

Depois de corrigir a causa raiz, recuperar o intervalo perdido:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/evolution-backfill-all" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"<UUID>","limit":2000}'
```

A função é idempotente (usa `messageId` como chave e o watermark de `timestamp`
por lead). Estouros de `IDLE_TIMEOUT` são normais — ela continua processando em
background; basta re-invocar até parar de aparecer novidade em
`messages`.
