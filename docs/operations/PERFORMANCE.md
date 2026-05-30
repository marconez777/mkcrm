# Operações: Performance

> **Quando ler:** antes de adicionar nova query/listagem, otimizar tela lenta, ou debugar latência alta.
> **Última atualização:** 2026-05-30

---

## Alvos (SLO informais)

| Métrica | Alvo |
|---|---|
| TTFB primeira página | <800ms (preview), <300ms (publicado) |
| Inbox abrir conversa | <500ms |
| Kanban carregar 1000 leads | <1.5s |
| Webhook Evolution → INSERT | <300ms p95 |
| AI auto-reply (texto curto) | <4s p95 |
| Broadcast tick (lote 30 msgs) | <30s |

---

## Frontend

### Build / bundle
- Vite 5, code-splitting por rota via `lazy()` nas pages.
- shadcn-ui (tree-shakable). Evitar imports `*` de `lucide-react` — sempre nomeado.
- Imagens: importar como módulo (`import x from '...png'`) para hash + caching. Para grandes/hero, considerar `vite-imagetools` (não instalado ainda).

### Render
- Listas longas (Inbox, Kanban) usam virtualização **parcial** — Kanban hoje renderiza todos os cards (gargalo >2k leads). TODO: `react-window` ou `tanstack/react-virtual`.
- Memoização: `useMemo`/`useCallback` em props de cards do Kanban.
- Evitar `Date.now()` em render — quebra memoization.

### Realtime
- `useRealtimeList` mantém uma única subscription por (table, filter). Não criar N subscriptions iguais.
- Após >30min sem evento, alguns browsers fecham WS — `useRealtimeList` reconecta + invalida cache.

### Network
- TanStack Query com `staleTime` por tipo:
  - Estáticos (`stages`, `clinic_settings`): 5min.
  - Listagens (`leads`): 30s + realtime.
  - Mensagens (`wa_messages`): 0 (sempre fresh; realtime cuida).
- Sem prefetch automático — adicionar em hover de card do Kanban (futuro).

---

## Backend / DB

### Índices críticos (não remover)

```sql
-- leads
CREATE INDEX idx_leads_clinic_phone ON leads(clinic_id, phone);
CREATE INDEX idx_leads_clinic_stage ON leads(clinic_id, stage_id);
CREATE INDEX idx_leads_clinic_updated ON leads(clinic_id, updated_at DESC);

-- wa_messages
CREATE UNIQUE INDEX uq_wa_msg_evolution ON wa_messages(clinic_id, evolution_message_id);
CREATE INDEX idx_wa_msg_lead_created ON wa_messages(lead_id, created_at DESC);

-- lead_events
CREATE INDEX idx_lead_events_lead_created ON lead_events(lead_id, created_at DESC);
CREATE INDEX idx_lead_events_clinic_event ON lead_events(clinic_id, event, created_at DESC);

-- tracking_events
CREATE INDEX idx_tracking_events_visitor_ts ON tracking_events(visitor_id, created_at DESC);
```

### Queries que escalam mal (vigilância)

- `SELECT * FROM lead_events WHERE clinic_id=$1 ORDER BY created_at DESC LIMIT 100` — OK com índice composto.
- `SELECT count(*) FROM leads WHERE clinic_id=$1` — pode ser lento >100k. Usar `pg_stat_user_tables.n_live_tup` aproximado em dashboards.
- Joins com `auth.users`: evitar; usar `profiles` já desnormalizado.

### RLS performance
- `has_role()` é `STABLE SECURITY DEFINER` → cache por transação. OK.
- Evitar subselect com `auth.uid()` em loop (pega plan ruim). Sempre wrappar em função stable.

---

## Edge functions

### Cold start
- Deno boots em 100–500ms (visto nos logs). Aceitável para ticks de 1min.
- Funções **muito** chamadas (webhook) ficam quentes naturalmente.
- Evitar import síncrono pesado no topo (lazy import).

### Concorrência
- Cada invocação = 1 isolate Deno. Sem estado compartilhado entre invocações (não confiar em vars top-level para cache).
- Para cache cross-invocation usar `wa_settings_cache` table ou Redis externo.

### Batch
- Workers (broadcast/sequence) processam em lotes de 30–50. Aumentar batch reduz overhead mas estoura timeout (max 150s edge functions).

---

## WhatsApp / Evolution

- 1 msg/s por instância é o limite seguro. Acima → risco de ban.
- `broadcast-tick` adiciona jitter (50–300ms) entre envios para parecer humano.
- Áudio/imagem têm latência maior (upload mídia) — contar 3–5s vs 500ms texto.

---

## Como medir

### Frontend
- DevTools Performance tab.
- `browser--performance_profile` (CPU/memory snapshot).
- `browser--start_profiling` / `stop_profiling` em ação específica.

### Backend
- `supabase--analytics_query` com p95 por função (ver `OBSERVABILITY.md`).
- `EXPLAIN ANALYZE` em query suspeita.
- `pg_stat_statements` (se habilitado) para top queries.

---

## Pegadinhas

- **`select *` no Realtime**: payload pesado se a tabela tem colunas grandes. Filtrar colunas explícitas.
- **Subscription Realtime sem cleanup**: vaza WS conexões. Sempre `channel.unsubscribe()` em `useEffect` cleanup.
- **Imagem do Storage sem dimensão**: causa CLS alto. Definir `width`/`height` em `<img>`.
- **Polling em vez de realtime**: alguém adicionou `setInterval` em algum lugar? Procurar antes de aumentar quota.
- **Index não usado**: `EXPLAIN` para confirmar; `ANALYZE` após muitos INSERTs.
- **Função em RLS sem `STABLE`**: re-executa por linha. Tragédia em listagem grande.

---

## Melhorias sugeridas

- Virtualização no Kanban (`tanstack/react-virtual`).
- Prefetch em hover de card.
- View materializada para dashboards (`mv_clinic_daily_stats`, refresh nightly).
- Migrar imagens hero para AVIF/WebP.
- Habilitar `pg_stat_statements` em prod.
- Cache de `clinic_settings` em edge functions (KV layer).

---

## Arquivos-chave

- `src/hooks/useRealtimeList.ts`
- `src/pages/Kanban.tsx` (gargalo conhecido)
- `database/SCHEMA.md` (índices)
- `operations/OBSERVABILITY.md`
