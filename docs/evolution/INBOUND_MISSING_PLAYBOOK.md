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
