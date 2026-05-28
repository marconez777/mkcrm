# Remover limite de 1000 em toda a ferramenta de e-mail

## Causa raiz

O PostgREST do Supabase aplica um limite default de 1000 linhas por resposta. Onde quer que o código faça `select(...)` sem `.range(0, N)` (ou com `.limit(N)` mas confiando que N será maior que o total), só vêm 1000 linhas. Isso afeta a prévia de "Nova campanha" (a badge "1000 enviáveis" da screenshot), os relatórios de campanha/automação e o dashboard.

Já temos o helper `src/lib/fetch-all.ts` (`fetchAllPaged`) que pagina automaticamente. Vamos usá-lo em todos os pontos.

## Mudanças

### 1. `src/components/email/CampaignRecipientsPreview.tsx` (a tela da screenshot)
- `supabase.rpc("resolve_email_segment", { _segment_id })` → adicionar `.range(0, 99999)` para receber todos os contatos do segmento (RPCs respeitam range no PostgREST).
- Fallback "todos os leads" (`.from("leads").limit(5000)`) → trocar por `fetchAllPaged` com filtros existentes (`clinic_id`, `email not null`, `email != ''`).
- `email_unsubscribes ... .in("email", emails)` → quebrar `emails` em chunks de 500 e agregar resultado (a cláusula `IN` com 4000+ valores também pode estourar o limite de resposta e/ou tamanho da URL).
- Badge passa a refletir o total real (ex.: "4287 enviáveis").

### 2. `src/components/email/CampaignReportDialog.tsx` (relatório de campanha)
- `email_logs.limit(10000)` e `email_queue.limit(10000)` → `fetchAllPaged` paginando por `related_lead_table = campaign_<id>`.
- Stats (enviados, abertos, clicados, falhados, na fila) e união por e-mail passam a refletir todos os destinatários.

### 3. `src/components/email/AutomationReportDialog.tsx` (relatório de automação)
Trocar todos os `.limit(2000|5000|10000)` por `fetchAllPaged`:
- `load()`: `email_logs` e `email_queue` por `related_lead_table`.
- `loadLeadsForBucket()` em todos os buckets:
  - `enrolled` → `email_automation_enrollments`
  - `all` → `email_queue` + `email_logs` (usado também por campanhas)
  - `queued`, `failed` → `email_queue` + `email_logs`
  - `sent`, `opened`, `clicked` → `email_logs`

### 4. `src/pages/email/EmailDashboard.tsx`
- `email_logs.limit(1000)` na função `load()` → `fetchAllPaged` com `gte("sent_at", since)` e `order("sent_at", desc)`, com `hardCap` razoável (ex.: 50.000) para não travar a UI em janelas longas.

### 5. `src/pages/email/EmailCampaigns.tsx`
- Agregados de `email_logs` e `email_queue` com `.limit(20000)` (linhas 93-94) → `fetchAllPaged` para que `sent_count` / totalizações por campanha listada não sejam truncados quando uma clínica tem muitas campanhas grandes.

### 6. `src/pages/email/EmailReports.tsx`
- Dropdown de campanhas (`email_campaigns.limit(100)`) → aumentar para usar `fetchAllPaged` (clínicas com mais de 100 campanhas não conseguem selecionar as antigas). Demais stats já usam RPCs do servidor (`report_template_stats`, `report_campaign_stats`), sem limite client-side.

### 7. Loaders adequados
A prévia de destinatários e os relatórios passam a fazer múltiplos round-trips: manter o `Loader2` já existente enquanto a paginação roda, sem mudar a UX.

## Onde NÃO mexer (já estão corretos)

- `EmailContacts.tsx`, `EmailSegments.tsx` — já corrigidos em loops anteriores.
- `EmailLogs.tsx`, `EmailQueue.tsx`, `EmailUnsubscribes.tsx` — usam paginação com `count: exact` + `.range(from, to)` controlada pelo usuário; cada página tem 1000 por design.
- `CampaignLiveDialog.tsx` — `email_queue.limit(20)` é intencional (últimos 20 itens da fila ao vivo).
- RPCs server-side (`report_template_stats`, `report_campaign_stats`, `campaign_throughput`, `email_metrics_daily`) — agregam no banco, sem limite de linhas.

## Detalhes técnicos

- `fetchAllPaged(build, pageSize=1000, hardCap=100_000)` recebe uma factory que devolve um query builder sem `.range/.limit`. Vamos usá-lo em todos os pontos acima.
- Para RPCs (`resolve_email_segment`) o helper não se aplica — usamos `.range(0, 99999)` direto, mesmo padrão já adotado em `EmailSegments.tsx`.
- Para `.in("email", [...])` com listas grandes, criar utilitário inline que divide em chunks de 500 e concatena resultados (evita 414 URI Too Long e o teto de 1000 por resposta).
- Nenhuma alteração de schema, RLS ou edge function.
