---
title: "Roadmap: e-mail em escala (lista de 163k)"
topic: email
kind: roadmap
audience: agent
status: proposto
updated: 2026-08-21
summary: "Gargalos do módulo de e-mail medidos contra a régua do tenant MCD (162.874 contatos, campanhas de ~146k). Cobre RLS por linha, telas que baixam a base inteira, os quatro locks que serializam o envio, os tetos de warm-up/throttle/cota, e a ausência total de retenção. Fases 0-4, da SQL pura ao estrutural."
code_refs:
  - src/pages/email/
  - src/components/email/
  - supabase/functions/process-email-queue/index.ts
  - supabase/functions/dispatch-campaign/index.ts
  - supabase/functions/send-email/index.ts
related_docs:
  - docs/maps/EMAIL_MARKETING.md
  - docs/roadmap/CLOUD_COST_REDUCTION.md
  - docs/roadmap/MIGRACAO_SUPABASE.md
---

# Roadmap — e-mail em escala

## 1. Por que este documento existe

Em **21/08/2026** a tela `Email > Contatos` do tenant MCD parou de carregar:
`HEAD /rest/v1/email_segment_contacts?select=id&clinic_id=eq.<mcd>` devolvia
**500**. A causa não era a tela — era a policy RLS avaliada por linha estourando
o `statement_timeout` de 8s. Na mesma sessão, `Email > Campanhas` mostrava
"1–6 de 6" com a tabela vazia: o `load()` abortava ao baixar todas as linhas de
`email_logs` para contar enviados.

Os dois eram sintomas do mesmo fato: **o módulo foi escrito para listas de
centenas de contatos e o MCD trouxe 163 mil**. Este roadmap mapeia onde mais
isso dói e em que ordem atacar.

## 2. A régua

Números medidos no SQL Editor em 21/08/2026:

| Métrica | Valor |
|---|---|
| `email_segment_contacts` — MCD | **162.874** |
| `email_segment_contacts` — FXN Capital | 14.350 |
| `email_segment_contacts` — ÓR | 692 |
| `leads` com e-mail — MCD | **0** (a lista é toda importada, não vira lead) |
| Envios/mês — MCD | ≈38.000 |
| `statement_timeout` (`authenticated`) | **8s** |
| Teto de linhas por resposta PostgREST | **1.000** |

Regra de bolso derivada: **uma campanha de 146k destinatários escreve ~440 mil
linhas** — 146k em `email_queue`, 146k em `email_logs`, 146k em
`email_send_dedup` — e nenhuma delas é apagada depois (§4, G-10).

## 3. Mecânica que explica quase todos os gargalos

Três fatos técnicos, repetidos em lugares diferentes do código:

1. **RLS `SECURITY DEFINER` não inlina.** Uma policy
   `USING (has_clinic_access(clinic_id) AND clinic_has_feature(clinic_id, …))`
   executa as duas funções **por linha**. Em 163k linhas isso é meio milhão de
   subconsultas — `count(*)` e páginas com OFFSET alto estouram os 8s.
   A forma que roda **uma vez por query** é
   `clinic_id = ANY ((SELECT public.accessible_clinic_ids('email_marketing'))::uuid[])`
   (InitPlan). O cast `::uuid[]` é obrigatório: sem ele o Postgres lê
   `ANY(subquery)` e falha com 42883.
2. **`supabase.rpc(fn).range(a,b)` não pagina dentro da função.** O PostgREST
   envolve a chamada e aplica `LIMIT/OFFSET` ao resultado — a função **recalcula
   o conjunto inteiro a cada página**. Paginar uma RPC de 146k linhas em páginas
   de 1.000 custa **146 execuções completas**: é quadrático, não linear.
3. **Linha quente serializa.** Todo `UPDATE` numa mesma linha espera o anterior.
   O caminho de envio tem quatro dessas (§4, G-06) — o teto de throughput real
   não é o Resend, são os locks.

## 4. Mapa dos gargalos

Severidade: 🔴 quebra hoje · 🟠 quebra na próxima campanha grande · 🟡 custo/dívida.

| # | Onde | O que acontece | Custo na régua MCD |
|---|---|---|---|
| **G-01** ✅ | `email_segment_contacts` RLS | policy por linha | 500 na tela Contatos — **corrigido 21/08** |
| **G-02** ✅ | `EmailCampaigns.load()` | baixava `email_logs` inteiro para contar | tela vazia — **corrigido 21/08** |
| **G-03** 🔴 | `EmailSegments.tsx:154` | conta cada segmento paginando `resolve_email_segment` dentro de um `Promise.all` | segmento dinâmico de 146k = **146 execuções completas por segmento**, todas em paralelo → timeout garantido |
| **G-04** ✅ | `CampaignRecipientsPreview.tsx:42` | mesma paginação da RPC, por segmento da campanha | card "Destinatários" girava para sempre no MCD — **corrigido 21/08** pela RPC `email_segment_preview` (F3.2, commit `c57740cd`) |
| **G-05** 🟠 | `dispatch-campaign/index.ts:118-306` | resolve **todos** os destinatários na memória do edge e insere em 146 chunks | precisa caber no wall-clock de uma invocação; se morrer no meio, a campanha fica `sending` com fila parcial e sem retomada |
| **G-06** 🔴 | gates do `send-email` | 4 linhas quentes por envio: `email_send_state` (1/clínica), `email_domain_warmup` (**`SELECT … FOR UPDATE`**, 1/domínio), `email_recipient_throttle` (1/clínica+domínio+hora), `email_campaigns` (trigger `tg_email_queue_campaign_counters`, 1/campanha) | CONCURRENCY=5 × BATCH_PARALLELISM=5 = 25 envios paralelos que **serializam nos locks**; ~8-9 round-trips por e-mail ≈ **1,2M queries** por campanha de 146k |
| **G-07** ⬇️ | `claim_recipient_throttle` | teto fixo de 1.000/hora por domínio de destino | **não bloqueia o MCD**: `throttle_recipient_enabled=false` nas settings da clínica (medido 21/08). Continua valendo para os outros tenants |
| **G-08** ⬇️ | `claim_domain_warmup` | cap por idade do domínio (dia 0=50 … 14+=livre) | **inativo**: `email_domain_warmup` está **vazia**, então a função libera tudo. Vira risco só se alguém cadastrar warm-up |
| **G-09** ⬇️ | `clinic_email_quota` | default 1.000/dia sem configuração | **não bloqueia o MCD**: `quota_daily = 50.000.000`. A ÓR tem 100.000. Os demais tenants estão no default |
| **G-10** 🔴 | todas as tabelas do módulo | **nenhuma retenção** — não existe `cleanup_email_*` em migration alguma | ~440k linhas por campanha, para sempre; alimenta direto o problema de disco do [CLOUD_COST_REDUCTION](./CLOUD_COST_REDUCTION.md) |
| **G-11** 🔴 | `check_email_operational_health()` | roda ao fim de **cada** ciclo de `process-email-queue`; faz `COUNT(*)` da fila e `GROUP BY` em `email_logs WHERE created_at >= now()-24h` — **não há índice em `created_at`** → seq scan | o cron está em **10 segundos** (medido 21/08), mais o self-trigger: é um seq scan de 57k linhas de log a cada poucos segundos |
| **G-12** 🟠 | `email_operational_alerts` | `ON CONFLICT DO NOTHING` **sem índice único** → nunca suprime nada | `pending > 500` fica verdadeiro por horas: **uma linha de alerta por execução**, sem teto |
| **G-13** 🟠 | `refresh_email_metrics_daily(35)` | cron de 15 min re-agrega **35 dias** de `email_logs` sem filtro de clínica; os índices são todos `(clinic_id, …)` e não servem | seq scan a cada 15 min, crescendo com o volume de logs |
| **G-14** 🟡 | `process-email-queue/index.ts:36-52` | claim em dois passos (`select … limit 1000` → `update … in(ids)`) e o resultado do update **não é verificado** | duas execuções concorrentes processam os mesmos 1.000 jobs; a correção do envio é salva pelo `email_send_dedup`, mas o trabalho (e os gates) é feito em dobro |
| **G-15** 🟠 | trigger `check_clinic_bounce_health` | a cada bounce/complaint varre `email_logs ORDER BY created_at DESC LIMIT 1000` — sem índice em `created_at` | campanha grande gera bounces em rajada; cada um paga um sort da tabela |
| **G-16** 🟠 | RLS restante | `email_unsubscribes`, `email_send_dedup`, `email_send_state`, `email_campaign_variants`, `email_templates`, `email_segments`, `email_campaigns`, `email_automations` ainda no padrão por linha | `email_unsubscribes` e `email_send_dedup` crescem 146k por campanha — são os próximos a estourar |
| **G-17** 🟡 | `EmailContacts.tsx` | baixa leads + contatos inteiros e agrupa no navegador (`CONTACTS_HARD_CAP = 300k`) | 163 requisições e dezenas de segundos de carga; funciona, mas é o teto do desenho atual |
| **G-18** 🔴 | `EmailQueue.tsx:56-63` | subscription realtime em `email_queue` **sem filtro de clínica e sem debounce**, e o handler refaz o `load()` com `count:"exact"` | cada e-mail passa por `pending→sending→sent` = 3 eventos. Campanha de 146k = **~438.000 recargas completas**; a aba trava em segundos |
| **G-19** 🔴 | `EmailDashboard.tsx:160-176` | dois handlers realtime (`email_logs`, `email_queue`) sem filtro nem debounce, cada um refaz o `load()` que baixa até 50k linhas de log | durante o envio: ~100 recargas/min × 51 requisições ≈ **5.000 req/min** |
| **G-20** 🔴 | `AutomationReportDialog.tsx:131-174` | quatro drenagens, duas por `.in()` sobre até 100k `lead_id` contra `email_logs.related_lead_id` e `email_queue.related_lead_id` — **sem índice** | um clique em "Relatório" ≈ **600 requisições** e centenas de milhões de linhas varridas; estoura e mostra tudo zero |
| **G-21** 🔴 | `email_queue` sem índice em `related_lead_table` | Pausar/Retomar campanha faz `UPDATE … WHERE related_lead_table = 'campaign_x'` varrendo 146k linhas | **o botão Pausar estoura os 8s e não pausa** — a campanha continua enviando (`EmailCampaigns.tsx:259`, `CampaignLiveDialog.tsx:199`) |
| **G-22** 🔴 | números silenciosamente errados | `EmailDashboard.tsx:139` (fila sem `.range()` → teto de 1.000), `useEmailMetrics.ts:33` (idem, corta os dias mais recentes), ~~`CampaignRecipientsPreview` (teto de 100k)~~ — resolvido no G-04, `resolve_email_segment_preview` (`LIMIT 5000` fixo), `EmailSegments.tsx:345` (supressões cortadas em 1.000) | a tela mostra "Pendentes: 812" com 146.000 travados; a prévia diz "5000 destinatários" para um público de 146k — **é esse número que decide o disparo** |
| **G-23** ✅ | `EmailUnsubscribes.tsx:54` | `delete().eq("email", …)` **sem `clinic_id`** | vazamento entre tenants: como super admin, remover um descadastro apagava a supressão daquele e-mail em todas as clínicas — **corrigido 21/08**, o delete agora filtra por `clinic_id` da linha |
| **G-24** 🟠 | `EmailContacts.tsx:347-380` | importação faz 163 requisições de dedup e depois insere em chunks; **um duplicado derruba o chunk para inserção linha a linha** | melhor caso ~489 requisições; pior caso **163.000 requisições (~7h)**. `upsert … ignoreDuplicates` elimina os dois problemas |
| **G-25** 🟠 | tratamento de erro do módulo | 8 arquivos fazem `{ data }` sem `error`; 5 chamam `fetchAllPaged` (que lança) sem `try/catch` | é a família do bug "1–6 de 6": a tela renderiza confiante cheia de zeros, ou o spinner nunca para. Corretos hoje: `EmailContacts`, `EmailCampaigns`, `CampaignRecipientsPreview`, `EmailLogs` |
| **G-26** 🟠 | `fetch-all.ts:22` | `hardCap` default de **100.000** sem sinalizar truncamento | contra 162.874 linhas, **62.874 somem sem erro nem aviso**; o array volta como se estivesse completo |
| **G-27** 🟡 | `SettingsEmailDomain.tsx:105` | um `DnsWizard` por domínio, cada um com poller de 20s | 4 domínios = **720 invocações de edge/hora**, cada uma batendo na API do Resend |
| **G-28** ❌ | ~~`email_segment_contacts` sem unicidade dentro do segmento~~ | hipótese **descartada em 21/08**: o segmento "Desafio" tem 146.683 linhas e **146.683 e-mails distintos** | a lista não está duplicada. A falta de unicidade dentro do segmento continua existindo, mas não é o que aconteceu aqui |
| **G-29** 🟡 | `dispatch-campaign/index.ts:126,145,157` | o padrão `if (error) { console.error(...); break; }` nas três paginações engole erro de página: a função segue com público parcial e marca `sent`. **Risco do código, sem incidente** | **descartado como incidente em 21/08**: os 142.305 contatos grandes entraram em **21/08**, e as campanhas são de 28/07, 31/07 e 20/08 — todas anteriores. Os 17.020 e 4.504 eram o público da época. Corrigir o `break` continua certo (F2.1), mas não há envio truncado a remediar |

## 4b. Fora da fila: corrigir já

**G-23 — corrigido em 21/08.** Era um vazamento entre tenants de uma linha de
código (`EmailUnsubscribes.tsx:54`, faltava `.eq("clinic_id", …)`): uma remoção
de descadastro feita por super admin reabria aquele e-mail em **todas** as
clínicas. O `delete` agora usa o `clinic_id` da própria linha. Fica registrado
como lembrete: **todo `delete`/`update` por e-mail nesse módulo precisa do par
`(clinic_id, email)`** — a PK é composta.


**G-21** (Pausar que não pausa) é um índice. Se uma campanha de 146k precisar
ser interrompida hoje, o botão falha em silêncio — só o `UPDATE` direto no SQL
Editor resolve.

## 5. Fases

Ordem deliberada: **medir → SQL puro → edge → telas → estrutural**. As duas
primeiras não exigem deploy — o acesso disponível é só o SQL Editor do Lovable
Cloud; edge function só sobe pedindo ao agente do Lovable.

### Fase 0 — medir (não altera nada)

Antes de otimizar, confirmar contra a produção: o repositório **não reproduz o
banco** (achado de [MIGRACAO_SUPABASE](./MIGRACAO_SUPABASE.md)).

- **F0.1** Tamanho das 22 tabelas do módulo (`pg_total_relation_size`).
- **F0.2** Policies vigentes (`pg_policy`) — quais ainda são por linha.
- **F0.3** Índices vigentes (`pg_indexes`) e uso real (`pg_stat_user_indexes`).
- **F0.4** Tetos configurados: `clinics.settings->'email'` do MCD (`quota_daily`,
  `throttle_recipient_enabled`), idade/cap em `email_domain_warmup`,
  `email_domains.status`.
- **F0.5** Distribuição de domínio de destino da lista — define o custo real do G-07.
- **F0.6** Crons de e-mail (`cron.job`) e volume de `email_operational_alerts`
  (mede o G-12).

SQL pronto no §7.

#### Resultado da Fase 0 (21/08/2026)

| Medida | Valor |
|---|---|
| `email_logs` | 57 MB / 57.193 linhas |
| `email_segment_contacts` | 56 MB / 177.916 linhas |
| `email_queue` | 35 MB / 61.321 linhas |
| `email_send_dedup` | 30 MB / 60.706 linhas |
| `resend_webhook_events` | 11 MB / 49.741 linhas |
| `email_operational_alerts` | **307 linhas** — 273 `queue_backlog` + 34 `high_failure_rate` (confirma o G-12) |
| MCD `settings.email` | `quota_daily 50.000.000`, `throttle_recipient_enabled false` |
| `email_domain_warmup` | **vazia** — warm-up inativo |
| Domínios | os três `partially_verified` |
| Crons | `process-email-queue` **a cada 10s**, `email-automations-tick` 5min, `refresh-email-metrics-daily` 15min, `email-daily-summary` 11h |

Índices sem uso relevante (candidatos a remoção depois de nova medição, os
contadores são cumulativos desde o último reset): `email_queue_dedup_idx`
(3,1 MB, 0), `email_logs_idempotency_idx` (9,7 MB, 1), `email_send_dedup_created_idx`
(2,7 MB, 0), `email_queue_pending_idx` (320 kB, 0), `email_logs_variant_idx` (0).
Cada índice a mais é escrita a mais nos 146k INSERTs de uma campanha.

**Ainda no padrão por linha** (F1.1): `email_send_dedup`, `email_unsubscribes`,
`email_metrics_daily`, `email_automation_enrollments`, `email_automations`,
`email_campaigns`, `email_campaign_variants`, `email_segments`, `email_templates`,
`email_template_folders`, `email_domains`, `email_domain_warmup`,
`email_health_alerts` — e, crítico, as policies de **escrita** de `email_queue`
(`admin_update`/`admin_delete`), que são o que o botão Pausar atravessa em 146k
linhas.

### Fase 1 — SQL puro, sem deploy

| # | Ação | Gargalo | Risco |
|---|---|---|---|
| F1.1 🔄 | Migrar a RLS restante para InitPlan (`email_unsubscribes`, `email_send_dedup`, `email_send_state`, `email_campaign_variants`, `email_templates`, `email_segments`, `email_campaigns`, `email_automations`) | G-16 | baixo — semântica idêntica |
| F1.2 ✅ | Índices `email_logs (created_at DESC)` e `email_logs (clinic_id, created_at DESC)` | G-11, G-15 | baixo |
| F1.2b ✅ | Índice `email_queue (clinic_id, related_lead_table)` e `email_logs (clinic_id, related_lead_table)` — aplicado 21/08 | G-20, G-21 | baixo — destrava o botão Pausar |
| F1.3 ✅ | Repetição de alerta resolvida por **guarda de 30 min por tipo** dentro do `check_email_operational_health` (índice único em `date_trunc` não é possível — a expressão não é IMMUTABLE) | G-12 | baixo |
| F1.4 ✅ | Retenção `cleanup_email_runtime()` + cron diário: `email_queue` sent >30d, `email_send_dedup` >90d, `resend_webhook_events` >30d, `campaign_throughput` >90d, `email_recipient_throttle` >7d, alertas resolvidos >30d. **`email_logs` fica** | G-10 | médio — janelas precisam de decisão do usuário |
| F1.5 ✅ | `check_email_operational_health`: filtrar por `sent_at` (indexado) em vez de `created_at`, e rodar 1× a cada N ciclos | G-11 | baixo |
| F1.6 | `refresh_email_metrics_daily`: janela de 2d no cron de 15 min; 35d num cron diário | G-13 | baixo |
| F1.7 ✅ | `autovacuum_vacuum_scale_factor = 0.01` nas tabelas de linha quente | G-06 | baixo |
| F1.8 ✅ | **`ORDER BY` determinístico em `resolve_email_segment`** (as duas ramificações) — sem isso a paginação por OFFSET **em disparo por segmento** perde linhas. Aplicado 21/08 | G-29 (parcial) | baixo — só ordena, não muda o conjunto |

#### Resultado da Fase 1 (21/08/2026)

Primeira execução de `cleanup_email_runtime()`: **6.920** linhas removidas de
`email_queue` (enviados >30d) e **6.381** de `resend_webhook_events` (>30d). As
demais tabelas ainda não tinham dado velho o bastante — o valor do item é
preventivo, não a limpeza inicial. Cron `cleanup-email-runtime` às 03:40.

Limpeza pontual dos alertas repetidos: mantida apenas a ocorrência mais recente
por tipo/clínica; as repetições que o health check gerava a cada 10s foram
removidas.

### Fase 2 — edge functions (via agente Lovable)

| # | Ação | Gargalo |
|---|---|---|
| F2.1 | `dispatch-campaign`: enfileirar **no banco** (`INSERT … SELECT` a partir de `resolve_email_segment`) em vez de trazer 146k para a memória do edge; ou fatiar em invocações retomáveis com cursor na campanha | G-05 |
| F2.2 | `process-email-queue`: claim atômico via RPC com `FOR UPDATE SKIP LOCKED` devolvendo os jobs já marcados | G-14 |
| F2.3 | Gates em lote: RPC `claim_send_slots(clinic, domain, dest_domains[], n)` resolvendo cota + warm-up + throttle por lote em vez de por e-mail | G-06 |
| F2.4 | Contadores de campanha por agregação periódica, ou trigger `FOR EACH STATEMENT` | G-06 |
| F2.5 | `send-email`: token de unsubscribe e lookup de suppression por lote | G-06 |

### Fase 3 — telas

| # | Ação | Gargalo |
|---|---|---|
| F3.1 | `EmailSegments`: RPC `segment_counts(clinic)` devolvendo a contagem de todos os segmentos numa query — nunca paginar `resolve_email_segment` para contar | G-03 |
| F3.2 ✅ | `CampaignRecipientsPreview`: RPC `email_segment_preview(clinic, ids[], limit)` devolvendo **total + descadastrados + amostra** numa query (migration `20260821170000_email_segment_preview.sql`) | G-04 |
| F3.3 | `EmailContacts`: paginação e busca **no servidor** | G-17 |
| F3.4 | `CampaignReportDialog`: usar `report_campaign_stats` (já existe) em vez de baixar as linhas | — |
| F3.6 | **Realtime com filtro de clínica + debounce de 5s** em `EmailQueue` e `EmailDashboard`; nunca refazer o `load()` inteiro no handler | G-18, G-19 |
| F3.7 | RPC `automation_step_stats(automation_id)` no lugar das quatro drenagens do relatório de automação | G-20 |
| F3.8 | Fim das truncagens silenciosas: contagem de fila por RPC `group by status`; `fetchAllPaged` devolvendo `{ rows, truncated }`; prévia devolvendo total real, não o `LIMIT 5000` | G-22, G-26 |
| F3.9 | Importação por `upsert(onConflict: "segment_id,email", ignoreDuplicates)` — remove o dedup e o fallback linha a linha | G-24 |
| F3.5 | Padrão para o módulo: `try/catch` que renderiza o que já tem e avisa, em vez de abortar (o bug do "1–6 de 6") | G-02 |

### Fase 4 — estrutural (decidir, não executar ainda)

- **Segmento materializado**: `email_segment_members(segment_id, email, name, lead_id)`
  mantida por refresh, substituindo `resolve_email_segment` no caminho quente.
  Resolve G-03, G-04 e G-05 de uma vez.
- **Envio por lote como padrão** no provedor, não como agrupamento oportunista.
- **Particionamento de `email_logs`** por mês, se a retenção não bastar.

## 6. Invariantes (não regredir)

- Policy de tabela grande **sempre** na forma InitPlan com `::uuid[]`.
- Nenhuma tela do módulo baixa lista de destinatários para contar — contagem é
  do servidor.
- `resolve_email_segment` **nunca** é paginada por `.range()` em loop: cada
  página recalcula tudo.
- `email_send_dedup` é o que garante que ninguém receba duas vezes: não remover
  o gate, mesmo "otimizando".
- Retenção nunca apaga `email_logs` sem decisão explícita — é a base dos
  relatórios.

## 7. Apêndice — SQL da Fase 0

```sql
-- F0.1 tamanho das tabelas do modulo
select 'tamanho' as tipo, relname as chave,
       pg_size_pretty(pg_total_relation_size(relid)) as valor
from pg_stat_user_tables
where relname like 'email%' or relname in ('resend_webhook_events','campaign_throughput')
union all
-- F0.2 policies ainda por linha
select 'policy', (polrelid::regclass)::text || '.' || polname,
       coalesce(pg_get_expr(polqual, polrelid), '')
from pg_policy
where (polrelid::regclass)::text like '%email%'
union all
-- F0.3 indices existentes
select 'indice', tablename || '.' || indexname, ''
from pg_indexes
where schemaname = 'public'
  and (tablename like 'email%' or tablename in ('resend_webhook_events','campaign_throughput'))
union all
-- F0.4 tetos configurados
select 'config', 'settings.email', coalesce((settings->'email')::text, '(vazio)')
from public.clinics where slug = 'mcd'
union all
select 'config', 'warmup:' || domain,
       'iniciado ' || started_at::date || ' enviados_hoje ' || sent_today || ' ativo ' || enabled
from public.email_domain_warmup
union all
select 'config', 'dominio:' || domain, status
from public.email_domains
union all
-- F0.6 crons e volume de alertas
select 'cron', jobname, schedule from cron.job where command ilike '%email%'
union all
select 'alertas', alert_type, count(*)::text
from public.email_operational_alerts group by alert_type
order by 1, 2;
```

```sql
-- F0.7 duplicidade da lista (decide entre G-28 e G-29)
select coalesce(s.name, '(sem segmento)') as segmento,
       count(*) as linhas,
       count(distinct lower(c.email)) as emails_unicos,
       count(*) - count(distinct lower(c.email)) as duplicadas,
       count(*) filter (where c.email is null or c.email !~ '@') as invalidas
from public.email_segment_contacts c
left join public.email_segments s on s.id = c.segment_id
where c.clinic_id = (select id from public.clinics where slug = 'mcd')
group by 1
order by 2 desc;
```

```sql
-- F0.5 distribuicao de dominio de destino (define o custo do G-07)
select lower(split_part(email, '@', 2)) as dominio,
       count(*) as contatos,
       round(count(*) * 100.0 / sum(count(*)) over (), 1) as pct,
       ceil(count(*) / 1000.0) as horas_no_throttle_atual
from public.email_segment_contacts
where clinic_id = (select id from public.clinics where slug = 'mcd')
group by 1
order by 2 desc
limit 20;
```

## 8. Histórico

- **2026-08-21 (3)** — G-04 corrigido (RPC `email_segment_preview`, commit
  `c57740cd`) a partir do relato "não carrega os contatos para enviar campanha".
  A investigação levantou **G-28** e **G-29**: o segmento de 146.683 contatos
  produziu campanhas de 17.020 destinatários, e ainda não se sabe se a lista é
  duplicada ou se o disparo truncou em silêncio. F0.7 no §7 decide.
- **2026-08-21 (2)** — varredura completa do frontend do módulo (24 arquivos):
  G-18 a G-27. Achados que mudam a leitura: as subscriptions realtime sem
  filtro são piores que qualquer drenagem de lista, vários números na tela
  estão silenciosamente errados por truncagem, e o Pausar de campanha não
  funciona em campanha grande.
- **2026-08-21** — documento criado a partir do incidente do MCD. G-01 e G-02
  corrigidos no mesmo dia (migrations `20260821120000_esc_rls_initplan.sql` e
  `20260821150000_email_logs_queue_rls_initplan.sql`; commits `28ffb00a`,
  `d0e8f43a`, `b7df98f2`). Os demais itens foram **levantados por leitura de
  código, não medidos em produção** — a Fase 0 existe para confirmar antes de
  executar.
