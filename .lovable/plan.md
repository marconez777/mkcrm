## Diagnóstico

Na clínica `cf038458…` existem **200 leads** com o telefone `5511994709447`, criados em rajadas de ~4 por minuto. Outras clínicas têm casos piores (2.080 dupes em um único número). Total: **6 grupos duplicados, 7.795 linhas extras**.

Causa raiz em `supabase/functions/_shared/evolution.ts` → `ingestMessage`:

1. Faz `SELECT ... eq(phone).eq(clinic_id).maybeSingle()`
2. Se não achar → `INSERT` em `leads`

Quando 4 webhooks da Evolution chegam quase ao mesmo tempo para o mesmo número (mensagem de texto + mídia + status + ack), os 4 SELECTs rodam em paralelo, todos retornam vazio, e os 4 INSERTs sobem leads diferentes. **Não existe índice único em `(clinic_id, phone)` na tabela `leads`** — só `leads_pkey(id)`. Sem trava no banco, a aplicação sozinha não consegue serializar.

Evidência: `pipeline_fallback_used` aparece 50× nos eventos, ou seja, cada lead duplicado também caiu no fallback de pipeline.

## Plano

### 1. Migration — proteção definitiva no banco
- Limpeza prévia (mesma migration, antes do índice):
  - Para cada grupo `(clinic_id, phone)` com `count > 1`, eleger o lead **mais antigo** (menor `created_at`) como canônico.
  - Repointar para o canônico (em ordem, mesma transação): `messages`, `lead_events`, `lead_stage_history`, `lead_custom_fields`, `lead_tasks`, `lead_internal_notes`, `lead_thread_classifications`, `lead_reply_counters`, `lead_ai_settings`, `pending_replies`, `scheduled_messages`, `appointments`, `message_sequence_enrollments`, `task_assignees` (via tasks), `tracking_lead_sources` e quaisquer outras FKs que apontem para `leads.id`.
  - `DELETE` nos leads duplicados perdedores (sem `tombstone` em `deleted_leads`, pois é limpeza de bug, não exclusão manual).
  - Recalcular `unread_count`, `last_message_at`, `last_message_preview` no canônico via agregação de `messages`.
- Criar índice único:
  ```sql
  CREATE UNIQUE INDEX leads_clinic_phone_uniq
    ON public.leads (clinic_id, phone)
    WHERE phone IS NOT NULL AND phone <> '';
  ```

### 2. Código — fechar a janela de race
Em `supabase/functions/_shared/evolution.ts` (`ingestMessage`, bloco `if (!lead)` linhas 361-430):
- Trocar o `INSERT` puro por `upsert` com `onConflict: 'clinic_id,phone', ignoreDuplicates: false` e `select('id, name, whatsapp_instance_id').single()`.
- Após o upsert, se a linha retornada tem `created_at` anterior ao início da chamada (ou se outra coluna já tinha valor), tratar como `createdLead = false` para não emitir `pipeline_fallback_used` indevidamente.
- Forma defensiva alternativa caso o upsert não consiga distinguir insert vs update: re-`select` por `(clinic_id, phone)` depois do upsert e comparar `id` com o retornado, ou usar `INSERT ... ON CONFLICT DO UPDATE SET phone=EXCLUDED.phone RETURNING xmax=0 AS inserted` via RPC. Vou seguir pela primeira abordagem.

### 3. Verificação pós-deploy
- `SELECT count(*) FROM leads WHERE clinic_id='cf038458…' AND phone='5511994709447'` deve retornar 1.
- Forçar reenvio de webhook (ou aguardar próximo ciclo) e checar que só existe 1 lead por número novo.
- Conferir que `lead_events.type='pipeline_fallback_used'` para de crescer em rajada.

## Detalhes técnicos relevantes

- Como o INSERT escolhe `stage_id` da primeira coluna do pipeline e cria com `unread_count = 1`, o canônico (mais antigo) já está na coluna certa — repointar mensagens para ele preserva o histórico real.
- `deleted_leads` **não** será tocada (não houve exclusão pelo usuário).
- O índice é parcial (`WHERE phone IS NOT NULL AND phone <> ''`) para não bloquear leads sem telefone (importação manual / form).
- A migration é grande e mexe em ~7.8k linhas — vou rodar a limpeza em CTEs por clínica para manter dentro do timeout.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — dedup + índice único
- `supabase/functions/_shared/evolution.ts` — upsert em vez de insert
