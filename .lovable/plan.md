## Coletor de leads das conversas

Cria um sistema que varre as conversas (chats) da Evolution API e cria leads para os números que ainda não existem no CRM, garantindo que nenhuma conversa fique de fora do pipeline.

### O que será feito

**1. Nova edge function: `evolution-collect-leads`**

Para cada instância WhatsApp configurada (ou apenas a passada via `instance_id`):

- Lista todos os chats da Evolution via `/chat/findChats/{instance}` (paginado).
- Para cada chat:
  - Extrai telefone real (mesma lógica `phoneFromKey` — trata `@lid` com `remoteJidAlt`).
  - Ignora grupos (`@g.us`) e números inválidos.
  - Verifica se já existe lead em `leads` para `(phone, clinic_id)`.
  - Se não existir: busca a última mensagem desse chat (`/chat/findMessages` página 1) e chama `ingestMessage` — o que reaproveita toda a lógica de criação de lead + fallback de pipeline já implementada (funil vinculado à instância → fallback para 1º funil de vendas).
- Retorna `{ scanned, created, skipped, perInstance }` e grava um evento em `webhook_events` (tipo `COLLECT_LEADS`).
- Aceita `{ stream: true }` para NDJSON de progresso (mesmo padrão do `evolution-backfill-all`).

**2. Cron automático (a cada 30 min)**

Via `pg_cron` + `pg_net`, agenda chamada periódica ao `evolution-collect-leads` sem `instance_id` (varre todas as instâncias da clínica).

**3. Dedup leve**

Tabela `webhook_dedup` já existente é usada para evitar reprocessar o mesmo chat dentro de 30 min (chave: `collect:{instance_id}:{phone}`).

### Detalhes técnicos

- **Reuso máximo**: a criação de lead passa pelo `ingestMessage` existente — toda a lógica de fallback de pipeline, resolução de `clinic_id`, `pushName`, etc. já funciona.
- **Funil**: usa o vinculado à instância; se não houver, cai no primeiro funil de vendas da clínica (fallback que já existe no `_shared/evolution.ts`).
- **Limite de segurança**: máx. 500 chats por instância por execução para evitar timeout (instâncias maiores são processadas em rodadas seguintes).
- **Observabilidade**: logs por instância (`[collect-leads] instance=X scanned=N created=M`) e evento `COLLECT_LEADS` em `webhook_events` para auditoria.
- **Cron**: `*/30 * * * *` chamando `evolution-collect-leads` com header `Authorization: Bearer <service_role>`.

### Arquivos afetados

```text
supabase/functions/evolution-collect-leads/index.ts   (novo)
supabase/functions/_shared/evolution.ts               (helper opcional findChats)
supabase/insert (cron job pg_cron)                    (agendamento)
```

### Fora do escopo

- UI de botão manual (você pediu apenas automático periódico).
- Importar histórico completo de mensagens do chat — isso já é feito pelo `evolution-backfill-all`. Aqui o foco é **criar o lead**; o backfill posterior popula as mensagens antigas se desejado.