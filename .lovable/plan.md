## Diagnóstico confirmado

Encontrei o mesmo padrão do incidente de 17/07 — **inbound sendo abortado por trigger com schema desatualizado**, só que num gatilho diferente que escapou da blindagem anterior.

### O bug

`fn_clinica_or_wakeup_inbound` (AFTER INSERT em `messages`) — trigger específico da Clínica ÓR que promove o lead de "geladeira" → Qualificação assim que o paciente responde. Ele faz `INSERT INTO lead_stage_history` referenciando três colunas que **não existem** na tabela:

- `pipeline_id` (não existe — a tabela não tem essa coluna)
- `"from"` (o correto é `from_stage_id`)
- `"to"` (o correto é `to_stage_id`)

Postgres logs confirmam: dezenas de `ERROR: column "pipeline_id" of relation "lead_stage_history" does not exist` nas últimas horas.

Como o trigger não está blindado com `EXCEPTION WHEN OTHERS`, o erro derruba a transação inteira do webhook — a mensagem inbound nunca chega em `messages`, `webhook_events.error` fica vazio (porque o SELECT anterior no `webhook_events` já commitou), e o Sunamita/Denis/Mari ficam com só o lado outbound visível.

### Leads afetados agora (Clínica ÓR, últimos 4 dias)

`Sunamita` (`f7574b5a…`), `Denis Zaneti` (`7cc14eee…`), `Mari` (`b536ee69…`) — todos com 5-9 outbound e 0 inbound, mas com webhooks `MESSAGES_UPSERT` `fromMe=false` presentes em `webhook_events` sem `error`. Todos estão hoje em Qualificação (foram gatilhados por esse fluxo).

Provavelmente há outros leads históricos da ÓR afetados pelo mesmo trigger.

---

## Plano — 3 fases

### Fase 1 — Corrigir + blindar o trigger (migração única)

Migração que:

1. Reescreve `fn_clinica_or_wakeup_inbound`:
   - Troca `pipeline_id`/`"from"`/`"to"` por `from_stage_id`/`to_stage_id` (remove `pipeline_id` do INSERT).
   - Envolve todo o corpo em `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING 'wakeup_inbound failed: %', SQLERRM; RETURN NEW; END;` — mesma regra de ouro do playbook, agora aplicada a este trigger.
2. Faz uma varredura defensiva em outros triggers `AFTER INSERT ON messages` para confirmar que todos têm `EXCEPTION WHEN OTHERS` (auditar `tg_auto_reactivation_inbound`, `tg_auto_secretary_replied`, `stop_sequences_on_reply`, `bump_lead_last_human_activity_from_message`, `update_lead_last_inbound_at`; blindar os que estiverem sem).

### Fase 2 — Backfill dos leads afetados

- Rodar `evolution-sync-lead` (modo `full: true`) para Sunamita, Denis e Mari.
- Rodar `evolution-backfill-all` na instância `8cafb677…` da Clínica ÓR com `limit: 2000` para cobrir qualquer outro lead da geladeira que tenha perdido mensagens desde que o trigger passou a falhar. É idempotente por `external_id`.
- Query de verificação: contar leads da ÓR com outbound recente > 0 e inbound = 0 antes/depois.

### Fase 3 — Documentação em destaque

Atualizar `docs/evolution/INBOUND_MISSING_PLAYBOOK.md` com um bloco novo bem visível no topo:

> **⚠️ Regra de ouro (2 incidentes já causados por isso, 17/07 e 18/07)**  
> Qualquer trigger em `messages` — inclusive triggers específicos de um tenant — DEVE:
> 1. Ter o corpo dentro de `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING …; RETURN NEW; END;`.
> 2. Ser revisado contra o schema atual de qualquer tabela auxiliar que ele alimenta (`lead_stage_history`, `lead_events`, `pipeline_tenant_classifiers`, etc.).

Adicionar na tabela "Sintomas conhecidos" a nova linha:

| `column "pipeline_id" of relation "lead_stage_history" does not exist` | Trigger `fn_clinica_or_wakeup_inbound` fora do schema atual (usava `pipeline_id`, `"from"`, `"to"`). | Migração 2026-07-18: colunas trocadas por `from_stage_id`/`to_stage_id` e trigger blindado. |

Também: uma nota no `docs/tenants/clinica-or/gatilhos-e-automacoes.md` mencionando que o wakeup trigger foi refeito e agora é fail-safe.

---

## Detalhes técnicos

- **Migração**: `CREATE OR REPLACE FUNCTION public.fn_clinica_or_wakeup_inbound()` com o INSERT novo:
  ```sql
  INSERT INTO public.lead_stage_history
    (lead_id, clinic_id, from_stage_id, to_stage_id, reason, source, moved_at)
  VALUES (v_lead.id, v_lead.clinic_id, v_old_stage, v_new_stage,
          'Paciente voltou a responder (Reativação automática)',
          'auto:wakeup-trigger', now());
  ```
  E envolver TUDO em `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING …; RETURN NEW; END;`.

- **Backfill**: chamar as edges via `curl` a partir do sandbox, com o service role (já disponível no ambiente do webhook). Nenhuma migração de dados manual.

- **Nada muda no frontend.** Alteração fica isolada em `supabase/migrations/`, `docs/evolution/INBOUND_MISSING_PLAYBOOK.md` e `docs/tenants/clinica-or/gatilhos-e-automacoes.md`. Rodar `node scripts/docs-sync.mjs` no final para manter `docs/INDEX.json` em dia.
