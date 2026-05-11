## Plano: Religar funil + fallback automático

### 1. Religar pipeline "Agendamentos Novo" à instância atual
Atualizar `pipelines.whatsapp_instance_id`:
- de: `b1cebe70-6372-422f-bea2-0ba1ae9579a8` (instância antiga, removida)
- para: `1fbed71c-063b-45c9-8045-4cf8b42b4934` (instância atual `or-76da5186`)

Executado via `supabase--insert` (UPDATE).

### 2. Fallback permissivo no `ingestMessage`
Em `supabase/functions/_shared/evolution.ts` (função `ingestMessage`), quando uma mensagem inbound chega de número desconhecido:

**Comportamento atual:** busca pipeline com `whatsapp_instance_id = X`. Se não achar → descarta com `reason: "no-inbound-pipeline"`.

**Novo comportamento:**
1. Tenta achar pipeline vinculado à instância (atual)
2. Se não achar, faz fallback: primeiro pipeline `kind = 'sales'` da clínica (ordenado por `is_default DESC, position ASC, created_at ASC`)
3. Se mesmo assim não achar → continua descartando com log
4. Quando o fallback for usado, registrar em `lead_events` (type: `pipeline_fallback_used`) para visibilidade

### 3. Limpeza de instância órfã (bônus opcional)
Em `evolution-delete-instance/index.ts`, antes de deletar:
- Buscar pipelines vinculados (`whatsapp_instance_id = <instância sendo deletada>`)
- Religar automaticamente para a próxima instância `connected` da clínica (ou `NULL` se não houver outra)
- Logar a mudança em `audit_log`

Isso evita o problema se repetir no futuro.

### 4. Recuperar leads perdidos das últimas horas
Após o relink, rodar `evolution-backfill-all` (limit 500) para reprocessar mensagens recentes — agora o `ingestMessage` vai conseguir criar os leads que foram descartados.

### Arquivos afetados
- `supabase/functions/_shared/evolution.ts` (fallback)
- `supabase/functions/evolution-delete-instance/index.ts` (auto-relink)
- UPDATE em `pipelines` (relink imediato)
- Trigger manual de `evolution-backfill-all`

### Validação
- Confirmar que `pipelines` aponta para instância correta
- Verificar logs do `evolution-webhook` após backfill (deve criar novos leads)
- Confirmar contagem de leads criados nas últimas 2h
