
# Roadmap — Performance e escalabilidade do módulo de Email

Contexto: vamos colocar um cliente com **alto volume de contatos e disparos**. A doc atual (`docs/edge-functions/EMAIL.md`, `flows/EMAIL_CAMPAIGN.md`) está atualizada com o código, mas o pipeline foi desenhado para volumes médios. Abaixo, gargalos reais identificados no código e o roadmap priorizado para destravar throughput, latência de entrega e robustez de múltiplas automações em paralelo.

---

## Gargalos identificados no código atual

1. **Throughput limitado do dispatcher** — `process-email-queue` roda **a cada 1 min**, pega no máx. **50 jobs**, com **concorrência 5** dentro do batch. Teto prático: ~50 emails/min por clínica = **3.000/h**. Para um cliente grande isso é pouco.
2. **`send-email` é pesado por envio** — cada chamada faz 6–8 queries (template, domínio, integração, suppression, idempotência, cota, token, slug da clínica) + 1 HTTP Resend + 2 writes. Sem cache de template/domínio/quota → muita pressão no Postgres.
3. **Idempotência via `email_logs`** — `SELECT ... maybeSingle()` em `email_logs` por envio. Sem índice composto explícito documentado em `(clinic_id, template_slug, recipient_email, related_lead_table)` pode degradar com milhões de linhas.
4. **`dispatch-campaign` enfileira em chunks de 20 sequenciais** — para 50k destinatários = 2.500 RPCs sequenciais → estoura 150s da edge function. Hoje só funciona "no susto".
5. **`email-automations-tick` é serial por automação** — `for...of` em todas as automações ativas, sem paralelismo. Com 50+ automações ativas vai ficar lento.
6. **Cota diária global por clínica** com `UPDATE email_send_state` linha-a-linha → contenção (lock) quando há paralelismo alto.
7. **Sem priorização** — auth/transacional, drip e campanha competem na mesma fila. Campanha massiva atrasa email transacional.
8. **Sem warm-up de IP/domínio nem rate-limit per-domain** — risco de ban/spam quando subir volume.
9. **Webhook Resend** insere events sem dedup → eventos duplicados inflam `email_logs.events[]`.
10. **`dispatch-campaign` carrega leads em 1 query (limit 10k)** e segura tudo em memória — não escala para >10k destinatários.

---

## Roadmap

### Tier 0 — Quick wins (1–2 dias, sem mudança de arquitetura)

- **R-1. Subir throughput do dispatcher**
  - cron: `1min → 15s` (via `pg_cron` ou self-trigger no fim da execução).
  - `BATCH_SIZE: 50 → 200`, `CONCURRENCY: 5 → 20`.
  - Resultado esperado: **~12.000 emails/h** por instância sem mudar código.

- **R-2. Índices críticos**
  - `email_queue(status, scheduled_at)` parcial `WHERE status='pending'`.
  - `email_logs(clinic_id, template_slug, recipient_email, related_lead_table)` para idempotência.
  - `email_logs(resend_id)` para webhook.

- **R-3. Self-trigger pós-batch**
  - `process-email-queue`: se sobrou fila, dispara a si mesma no fim (já faz pattern parecido em `dispatch-campaign`). Elimina espera do cron.

- **R-4. Paralelizar enqueue do `dispatch-campaign`**
  - Substituir RPC `enqueue_email` por **INSERT em lote** (`email_queue` em chunks de 500) — 1 round-trip por 500 destinatários em vez de 500.

- **R-5. Dedup de webhook Resend**
  - Chave única em `email_logs.events` por `(type, at)` ou tabela `email_log_events` normalizada.

### Tier 1 — Performance estrutural (1 sprint)

- **R-6. Cache em `send-email`**
  - Templates, `email_domains`, `clinic_email_integrations` em cache (memória do isolate + invalidação por `updated_at` ou TTL de 60s).
  - Cota: ler `email_send_state` 1x por batch, não por envio.

- **R-7. Filas com prioridade**
  - Coluna `priority` em `email_queue` (`auth=1, transactional=2, campaign=3, drip=4`).
  - Dispatcher pega ordenado por `priority ASC, scheduled_at ASC`.
  - Garante que email transacional/auth não fica atrás de campanha de 50k.

- **R-8. `dispatch-campaign` em modo streaming**
  - Paginar leads (`range(offset, offset+500)`) e enfileirar em background.
  - Para campanha >5k: marcar `status='enqueuing'`, criar job recursivo de chunk, terminar a request rapidamente.

- **R-9. Paralelizar `email-automations-tick`**
  - `Promise.all` por automação (com limite de concorrência ~10).
  - Cursor por automação já existe; só falta paralelismo.

- **R-10. Idempotência via UNIQUE constraint**
  - Trocar o `SELECT ... maybeSingle()` por `INSERT ON CONFLICT DO NOTHING` em uma tabela `email_send_dedup(clinic_id, template_slug, email, context)` com unique. Elimina race condition + 1 query.

- **R-11. Contador de cota atômico**
  - Trocar UPSERT por `UPDATE email_send_state SET sent_today = sent_today + 1 WHERE ... RETURNING sent_today`.
  - Cheque a cota com o valor retornado (sem lock de leitura prévio).

### Tier 2 — Escala e deliverability (próximo mês)

- **R-12. Warm-up automático de domínio novo**
  - Tabela `email_domain_warmup_schedule(domain, day, max_sends)` — dispatcher respeita o teto do dia.
  - Curva 50 → 100 → 500 → 1k → 5k → 10k... ao longo de 2 semanas.

- **R-13. Rate-limit per-domain destinatário**
  - Limite "X emails / hora para `@gmail.com`" para evitar burst no mesmo provedor (anti-spam).
  - Implementar via janela em `email_send_state` por domínio dest.

- **R-14. Separar fila por tipo (queue tables)**
  - Opcional: `email_queue_auth`, `email_queue_campaign`. Workers dedicados. Alternativa a R-7 se prioridade não bastar.

- **R-15. Resend Batch API**
  - `POST /emails/batch` (até 100 por chamada) — corta 1 HTTP por envio.
  - Reescrever `send-email` para receber lote opcional.

- **R-16. Bounce/complaint feedback loop em tempo real**
  - Hoje rate de bounce só aparece em `EmailReports`. Adicionar trigger: se bounce_rate >5% nas últimas N msgs, **pausar campanhas** da clínica automaticamente.

- **R-17. Métricas em tempo real**
  - View materializada `mv_email_throughput_5min` para dashboard mostrar emails/min.
  - Alerta se fila pendente >1.000 jobs ou tempo médio em fila >5min.

### Tier 3 — Recursos novos para o cliente grande

- **R-18. Throttling por campanha**
  - Campo `email_campaigns.send_rate_per_minute` — disparo gradual em vez de tudo de uma vez.
  - Útil para clínica que quer "100 emails/h" em vez de 10k em 30min.

- **R-19. Segmentação avançada server-side**
  - Hoje `email_segments.filters` suporta só `tags` + `stage_ids`. Adicionar: `created_at` ranges, `last_message_at`, `score`, custom fields.
  - RPC `resolve_email_segment` virou single source of truth (bom!), expandir lá.

- **R-20. A/B test de assunto/template**
  - Tabela `email_campaign_variants` (split 50/50, vencedor pelo open rate em 24h).

- **R-21. Multi-domínio rotativo**
  - Clínica com vários domínios verificados (`notify1`, `notify2`...) — dispatcher rotaciona para distribuir reputação.

---

## Revisão da documentação (entregar junto)

- **`docs/edge-functions/EMAIL.md`** — adicionar seção "Performance & Throughput" com: limites atuais, alvos por tier, índices, configuração de cota.
- **`docs/flows/EMAIL_CAMPAIGN.md`** — documentar fluxo streaming (R-8) e prioridade (R-7).
- **`docs/operations/PERFORMANCE.md`** — adicionar SLOs específicos do email:
  - Auth/transacional p95 <30s da invocação até Resend.
  - Campanha 10k destinatários: 100% enfileirado em <60s; 100% enviado em <2h.
  - Drip: latência do trigger até enfileirar <6min (cron de 5min).
- **`docs/operations/OBSERVABILITY.md`** — métricas a expor: fila pendente, throughput por minuto, bounce rate, complaint rate, jobs em DLQ.
- **`docs/roadmap/EMAIL.md`** — renomear seção atual para `# Auth Emails` e adicionar nova seção `# Email Marketing — Roadmap de Escala` referenciando este plano.
- **`docs/CHANGELOG.md`** — entry `2026-05-26: Roadmap de performance de email criado`.

---

## Sugestão de priorização para o cliente novo

**Antes de subir o cliente (semana 1):** R-1, R-2, R-3, R-4, R-5, R-7, R-10, R-11.
→ Salto de **~3k/h → ~50k/h** sem mudar arquitetura, com prioridade garantida pra email transacional.

**Primeiras 4 semanas em produção:** R-6, R-8, R-9, R-15, R-17.
→ Reduz custo Postgres + suporta múltiplas automações + observabilidade real.

**Conforme volume crescer:** R-12, R-13, R-16, R-18, R-21.
→ Protege reputação e dá controle fino ao cliente.

---

## Próximos passos

Depois que você aprovar este roadmap, posso:
1. Implementar Tier 0 (R-1 a R-5) imediatamente — é mecânico e seguro.
2. Atualizar a documentação descrita acima refletindo o estado atual + roadmap.
3. Abrir as migrações de índices (R-2) e priority (R-7) para revisão.

Diga se quer que eu comece pela **implementação do Tier 0** ou pela **atualização da documentação** primeiro.
