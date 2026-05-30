# Auditoria da Documentação — Fase 1: Inventário & Mapa

> **Gerado:** 2026-05-30
> **Escopo:** varredura de `docs/` (70 arquivos `.md`, ~11.363 linhas) cruzada contra `src/`, `supabase/functions/` (64 edge functions) e `supabase/migrations/` (50+ migrations).
> **Propósito:** servir de guia para as Fases 2–6. Esta fase **não altera** outros docs — só classifica.

---

## 1. Sumário executivo

| Métrica | Valor |
|---|---|
| Arquivos `.md` em `docs/` | 70 |
| Linhas totais | ~11.4k |
| Subpastas | 12 |
| Última atualização declarada no README | 2026-05-25 |
| Última atualização real (CHANGELOG) | 2026-05-26 |
| Edge functions no código | 64 |
| Edge functions mencionadas em algum doc | 62 |
| Migrations pós-CHANGELOG (não documentadas) | 9 |
| Páginas React | 43 (raiz + subpastas) |
| Páginas React não mencionadas em `docs/frontend/PAGES.md` | 6+ |

**Veredicto geral:** a estrutura está sólida (v1.0 bem desenhada), mas a doc parou em **2026-05-26** enquanto o código evoluiu por mais 4 dias com mudanças não-triviais (multi-segmento de campanhas, hub de IA com "Engajamento", scheduled reports, novas RLS, novas triggers). **~30 % dos arquivos precisam de update pontual** e **~10 % estão funcionalmente desatualizados** (citam comportamento antigo).

---

## 2. Status por arquivo

Legenda: ✅ ok · 🟡 atualização pontual (acrescentar 1-3 itens) · 🔴 desatualizado (descreve estado antigo) · ➕ falta (existe no código, não há doc) · 🗑️ órfão (não reflete mais nada do código)

### 2.1 Raiz (`docs/*.md`)

| Arquivo | Linhas | Status | Notas |
|---|---:|---|---|
| `README.md` | 157 | 🟡 | Diz "v1.0 completa, última atualização 2026-05-25". Atualizar data; menção a "52 arquivos" está errada (são 70). |
| `OVERVIEW.md` | 313 | 🟡 | Lista de edge functions OK, mas não cita `scheduled-report-tick`, `evolution-fetch-groups`, hub de "Engajamento" em IA. |
| `CHANGELOG.md` | 121 | 🟡 | Última entrada 2026-05-26. Faltam: multi-segmento (2026-05-30), `replied_at` em sequences (2026-05-30), revoke das RPCs `engagement_*` (2026-05-30). |
| `GLOSSARY.md` | 35 | 🟡 | Adicionar: "segmento múltiplo", "engajamento", "warmup pool", "rotation domain". |
| `AI.md` | 7 | ✅ | Stub redirect — ok. |
| `EMAIL.md` | 5 | ✅ | Stub redirect — ok. |
| `TRACKING.md` | 5 | ✅ | Stub redirect — ok. |

### 2.2 `architecture/`

| Arquivo | Status | Notas |
|---|---|---|
| `STACK.md` | ✅ | Stack não mudou. |
| `MULTI_TENANCY.md` | ✅ | Política `clinic_id` intacta. |
| `AUTH.md` | 🟡 | Não menciona endurecimento de `clinic_email_integrations` SELECT (2026-05-27) nem revoke de colunas sensíveis em `whatsapp_instances`/`ai_agents`. |
| `FEATURE_FLAGS.md` | 🟡 | Verificar se novas flags foram adicionadas (rotação de domínio, A/B). |
| `REALTIME.md` | 🟡 | Tabelas adicionadas à `supabase_realtime` em 2026-05-27 (`campaign_throughput`, `email_campaigns`) — confirmar se já estão listadas. |

### 2.3 `database/`

| Arquivo | Status | Notas |
|---|---|---|
| `SCHEMA.md` | 🔴 | **Falta:** `email_campaigns.segment_ids` (array), `email_campaigns.send_rate_per_minute`, `email_campaigns.variant_strategy`, `email_campaigns.winner_picked_at`, `email_campaigns.from_domain_pool`, `email_campaigns.last_sent_at`, `email_campaign_variants` (tabela nova), `email_domain_warmup`, `email_recipient_throttle`, `email_health_alerts`, `email_operational_alerts`, `email_send_dedup`, colunas `replied_at`/`stage_id_at_send`/`stage_position_at_send` em `message_sequence_runs`, colunas `rotation_pool`/`rotation_weight` em `email_domains`, `from_domain_override` em `email_queue`/`email_logs`, `priority` em `email_queue`, `bot_agent_id` em `messages`. |
| `RLS_POLICIES.md` | 🔴 | Mudanças não refletidas: política de `clinic_email_integrations` (2026-05-27), revoke em `whatsapp_instances`/`ai_agents` (2026-05-28), revoke das RPCs `engagement_*` (2026-05-30), policy `pipeline_enter` em `message_sequences`. |
| `FUNCTIONS_TRIGGERS.md` | 🔴 | **Falta:** `claim_email_quota`, `claim_domain_warmup`, `release_domain_warmup`, `claim_recipient_throttle`, `pick_ab_winner`, `pick_rotation_domain`, `check_email_operational_health`, `check_clinic_bounce_health`, `report_campaign_stats`, `tg_email_queue_campaign_counters`, `tg_suppress_on_bounce`, `email_queue_health_trigger`, `email_logs_bounce_health_trigger`, `engagement_broadcasts_summary`, `engagement_sequences_summary`, `engagement_sequence_steps`. |
| `MIGRATIONS.md` | 🟡 | Convenção continua válida — só atualizar contagem se aplicável. |

### 2.4 `edge-functions/`

| Arquivo | Status | Notas |
|---|---|---|
| `INDEX.md` | ✅ | Atualizado na Fase 3 (2026-05-30): 67 functions, `evolution-fetch-groups`, `send-email-batch` e `scheduled-report-tick` listados; 13 helpers compartilhados. |
| `AI.md` | ✅ | `bot_agent_id` loop-guard já documentado em §evolution-send / changelog interno. |
| `EMAIL.md` | ✅ | Atualizado na Fase 3: `dispatch-campaign` multi-segmento (`segment_ids[]`), tabela `email_campaigns` com `segment_ids/last_sent_at`. |
| `TRACKING.md` | ✅ | Sem mudanças de payload em `tracking-event`/`tracking-identify` desde 2026-05-25. |
| `WHATSAPP.md` | ✅ | Atualizado na Fase 3: `evolution-fetch-groups` adicionado, `bot_agent_id` documentado em `evolution-send`. |
| `SHARED_HELPERS.md` | ✅ | Atualizado na Fase 3: incluído `template-vars.ts` (13 módulos). |

### 2.5 `features/`

| Arquivo | Status | Notas |
|---|---|---|
| `BROADCASTS.md` | ✅ | Estável. |
| `FORMS.md` | 🟡 | Conferir tokens revoke (2026-05-28). |
| `SEQUENCES_AUTOMATIONS.md` | 🟡 | Adicionar trigger `pipeline_enter` (2026-05-28) e tracking `replied_at`/`stage_id_at_send` (2026-05-30). |

### 2.6 `flows/`

| Arquivo | Status | Notas |
|---|---|---|
| `EMAIL_CAMPAIGN.md` | 🔴 | Reescrever bloco "Seleção de segmento" → agora é multi-segmento (union/OR de N segmentos). |
| `AI_AGENT_LOOP.md` | 🟡 | Conferir loop-guard de `bot_agent_id`. |
| `INBOUND_WHATSAPP.md` | ✅ | |
| `OUTBOUND_WHATSAPP.md` | 🟡 | Mencionar `bot_agent_id` no `evolution-send`. |
| `BROADCAST.md` | ✅ | |
| `LEAD_LIFECYCLE.md` | ✅ | |
| `TRACKING_TO_LEAD.md` | ✅ | |

### 2.7 `frontend/`

| Arquivo | Status | Notas |
|---|---|---|
| `ROUTING.md` | ✅ | Atualizado na Fase 5 (2026-05-30): rotas de `/ai/engagement`, `/ai/reports`, 11 sub-rotas de `/email/*` (incl. `/email/sites`), `/settings/integration`. |
| `PAGES.md` | ✅ | Atualizado nas Fases 4+5: AiHub com 9 abas, seção Email expandida (Contacts/Unsubscribes/Reports), `MetricsOps`/`MetricsEngagement`/`MetricsAiUsage` enquadradas. |
| `COMPONENTS.md` | ✅ | Atualizado na Fase 5: seção Email reescrita (editor + dialogs + live) com `CampaignRecipientsPreview` (multi-segmento), `CampaignReportDialog`, `AutomationReportDialog`, `DnsWizard`, `DomainHealthCard`, `StatusBadge`, `TablePager`, `live/*`. |
| `HOOKS_LIB.md` | ✅ | Adicionados `useEmailMetrics`, `useCustomFieldDefs`, `useCountUp`. |
| `DESIGN_SYSTEM.md` | ✅ | |
| `STATE_DATA.md` | ✅ | Nota 2026-05-30 sobre realtime de `campaign_throughput`/`email_campaigns`. |

### 2.8 `integrations/`

| Arquivo | Status | Notas |
|---|---|---|
| `RESEND.md` | ✅ | Já cobre R-21 (multi-domínio rotativo) + dedup `resend_webhook_events`. |
| `EVOLUTION_API.md` | 🟡 | Lista 18 endpoints — vale acrescentar `evolution-fetch-groups` futuramente, mas WHATSAPP.md já cobre. |
| `LOVABLE_AI.md` | 🟡 | Lista de modelos pode ser ampliada (GPT-5.4/5.5, Gemini 3.1 preview) — não bloqueante. |
| `PG_NET_CRON.md` | ✅ | Atualizado na Fase 3: `scheduled-report-tick` adicionado, `scheduled-dispatcher` re-descrito. |
| `EXTERNAL_FORMS.md` | ✅ | |

### 2.9 `integracao/` (snippet de tracking — guia em PT para clientes)

13 arquivos numerados + README. ✅ Fase 6 (2026-05-30): payload de `tracking-event`/`tracking-identify`/`forms-ingest` revisado sem drift — guia continua válido.

### 2.10 `operations/`

| Arquivo | Status | Notas |
|---|---|---|
| `COSTS_LIMITS.md` | 🟡 | Adicionar limites de warmup, rotation pool, throttle por destinatário. |
| `OBSERVABILITY.md` | ✅ | Fase 6: views `email_throughput_stats`/`email_system_health` + tabelas `email_operational_alerts`/`email_health_alerts` documentadas. |
| `ERROR_HANDLING.md` | ✅ | Fase 6: pausa automática via `check_clinic_bounce_health` + `tg_suppress_on_bounce` documentados. |
| `BACKUPS_RECOVERY.md` | ✅ | |
| `PERFORMANCE.md` | 🟡 | Cross-link com `roadmap/EMAIL_SCALE.md`. |

### 2.11 `known-issues/`

| Arquivo | Status | Notas |
|---|---|---|
| `PITFALLS.md` | ✅ | Fase 6: pegadinhas 41 (segment_ids vazio = todos), 42 (pausa por bounce-health), 43 (loop bot-↔-bot) adicionadas. |
| `DEBT.md` | ✅ | Fase 6: itens A/B (R-20), warm-up (R-12), feedback bounce (R-16) e multi-segmento marcados como resolvidos. |
| `CORS_FORMS_INGEST.md` | ✅ | |

### 2.12 `roadmap/`

| Arquivo | Status | Notas |
|---|---|---|
| `EMAIL.md` | ✅ | Aviso de escopo presente. |
| `EMAIL_SCALE.md` | ✅ | R-17 a R-21 já marcados como entregues (Tier 2/3 completos). |
| `IMPROVEMENTS.md` | ✅ | Fase 6: R-8 (A/B email) marcado como entregue. |

---

## 3. O que está faltando totalmente (➕)

Itens do código que não têm doc dedicada hoje:

1. **Hub "Engajamento" dentro de IA** (`/ai/engagement`) — movido nesta sessão, sem doc.
2. **Página `ScheduledReports.tsx` + edge `scheduled-report-tick`** — sem doc.
3. **Página `AgentMemories.tsx`** (memórias persistentes do agente) — sem doc.
4. **Páginas `MetricsEngagement/AiUsage/Ops`** + RPCs `engagement_*` — sem doc.
5. **`evolution-fetch-groups`** — sem doc (provavelmente trivial; basta entrada no INDEX).
6. **Multi-segmento em `email_campaigns`** (mudança de hoje) — código e migração existem, doc precisa refletir.

---

## 4. Migrations pós-CHANGELOG (a documentar)

Em ordem cronológica, pendentes de menção no `CHANGELOG.md` da doc:

| Data | Migration | Resumo |
|---|---|---|
| 2026-05-27 | `..._84015d1f-...` | Realtime: `campaign_throughput`, `email_campaigns` adicionadas à publication. |
| 2026-05-27 | `..._66ba50cd-...` | RPC `report_campaign_stats`. |
| 2026-05-27 | `..._ba34dac1-...` | Hardening RLS de `clinic_email_integrations`. |
| 2026-05-27 | `..._5fd7651b-...` | Revoke colunas sensíveis de `whatsapp_instances` para `authenticated`. |
| 2026-05-28 | `..._4cfd67a9-...` | Idem para `anon` em `whatsapp_instances` + tokens de `form_integrations`. |
| 2026-05-28 | `..._64bcd467-...` | Trigger idempotente `tg_email_queue_campaign_counters`. |
| 2026-05-28 | `..._9b8013dd-...` | Índices `email_segment_contacts` e `leads`. |
| 2026-05-28 | `..._b8a57b5c-...` | Revoke `api_key/embedding_api_key/reranker_api_key` em `ai_agents`. |
| 2026-05-28 | `..._2671f560-...` | Trigger `tg_suppress_on_bounce`. |
| 2026-05-28 | `..._24b889f5-...` | Novo `trigger_type='pipeline_enter'` em `message_sequences`. |
| 2026-05-30 | `..._e70f4d5a-...` | Sequences: colunas `replied_at`, `stage_id_at_send`, `stage_position_at_send`. |
| 2026-05-30 | `..._ae1f2058-...` | Revoke EXECUTE das RPCs `engagement_*` para `PUBLIC/anon`. |
| 2026-05-30 | `..._dacc9939-...` | `email_campaigns.segment_ids uuid[]` + backfill. |

---

## 5. Próximas fases — recomendação

Com base no que apareceu nesta varredura, sugiro reordenar levemente:

1. **Fase 2 — Banco** (alta prioridade: 3 arquivos 🔴 + 9 migrations a registrar).
2. **Fase 4 — Features & Fluxos** (multi-segmento e engajamento são as mudanças mais visíveis de produto).
3. **Fase 5 — Frontend** (`PAGES.md` e `ROUTING.md` estão 🔴).
4. **Fase 3 — Edge Functions & Integrations** (médio impacto).
5. **Fase 6 — Integracao/Ops/Roadmap/Known-issues** (mais limpeza que reescrita).
6. **Encerramento** — atualizar `README.md` (data, contagem) + entry consolidada no `CHANGELOG.md`.

Cada fase produzirá um patch só em `docs/` e um relatório curto. Confirmar para prosseguir com a **Fase 2 (Banco de Dados & Backend Core)**.
