# Fase 7 — Limpeza fina da documentação

Escopo exclusivo: `docs/`. Zero alteração de runtime. Objetivo: zerar todos os 🟡 remanescentes do `AUDIT_PHASE1.md` e levar a auditoria para 100% verde.

Cada item é uma edição curta (1–3 linhas, no máximo um parágrafo). A maioria é "adicionar bullet faltante" + bump da data do topo.

---

## Prioridades

- **P1 (alto sinal, leitor interno encontra primeiro):** OVERVIEW, GLOSSARY, REALTIME, SEQUENCES_AUTOMATIONS, OUTBOUND_WHATSAPP.
- **P2 (defaults operacionais e custos):** COSTS_LIMITS, PERFORMANCE, FEATURE_FLAGS.
- **P3 (espelhar info já existente em outro doc):** EVOLUTION_API, LOVABLE_AI, FORMS.

Implementar em **uma única passada** com edições paralelas — não precisa ser dividido em rodadas.

---

## Checklist (11 itens)

### P1

- [ ] **1. `docs/OVERVIEW.md`** — acrescentar à lista de edge functions: `scheduled-report-tick`, `evolution-fetch-groups`, `send-email-batch`. Mencionar "Engajamento" como aba do hub de IA na seção de produto. Bump data.
- [ ] **2. `docs/GLOSSARY.md`** — adicionar 4 termos: *segmento múltiplo*, *engajamento*, *warmup pool*, *rotation domain*. Bump data.
- [ ] **3. `docs/architecture/REALTIME.md`** — confirmar/adicionar `campaign_throughput` e `email_campaigns` na lista de tabelas da publication `supabase_realtime`. Bump data.
- [ ] **4. `docs/features/SEQUENCES_AUTOMATIONS.md`** — adicionar (a) `trigger_type='pipeline_enter'` (migration 2026-05-28) e (b) snapshot `replied_at`/`stage_id_at_send`/`stage_position_at_send` em `message_sequence_runs` (consumido por `engagement_*`). Cross-link `features/ENGAGEMENT.md`. Bump data.
- [ ] **5. `docs/flows/OUTBOUND_WHATSAPP.md`** — adicionar nota: ao enviar via IA, `evolution-send`/`evolution-send-media` gravam `messages.bot_agent_id` (loop-guard lido por `ai-auto-reply`). Cross-link `flows/AI_AGENT_LOOP.md`. Bump data.

### P2

- [ ] **6. `docs/operations/COSTS_LIMITS.md`** — adicionar bloco curto "Limites de email em escala": curva de warmup (`50→100→500→1k→5k→10k→25k→ilimitado`), throttle padrão por destinatário (1000/h por dest_domain), `quota_daily` default 1000 (override via `clinics.settings.email.quota_daily`), flag `throttle_recipient_enabled`. Cross-link `roadmap/EMAIL_SCALE.md` (R-12, R-13, R-23). Bump data.
- [ ] **7. `docs/operations/PERFORMANCE.md`** — adicionar cross-link explícito para `roadmap/EMAIL_SCALE.md` na seção de SLOs/throughput de email; reusar a tabela de SLOs já existente lá. Bump data.
- [ ] **8. `docs/architecture/FEATURE_FLAGS.md`** — verificar e listar (se houver) flags relacionadas a rotação de domínio (`from_domain_pool`), A/B (`variant_strategy`) e throttle (`throttle_recipient_enabled`). Se forem só colunas de config (não flags globais), registrar nota explicando a distinção. Bump data.

### P3

- [ ] **9. `docs/integrations/EVOLUTION_API.md`** — acrescentar `evolution-fetch-groups` à lista de endpoints (usado por Scheduled Reports). Bump data.
- [ ] **10. `docs/integrations/LOVABLE_AI.md`** — atualizar lista de modelos suportados (acrescentar GPT-5.4, GPT-5.4-mini/nano/pro, GPT-5.5, GPT-5.5-pro, Gemini 3.1 pro/flash-lite preview, Gemini 3.5 flash, Gemini 3 flash preview, Gemini 3.1 flash-image preview). Bump data.
- [ ] **11. `docs/features/FORMS.md`** — registrar o revoke de tokens em `form_integrations` (migration 2026-05-28) na seção de segurança. Bump data.

### Encerramento

- [ ] **12. `docs/AUDIT_PHASE1.md`** — marcar todos os 11 itens acima como ✅ e adicionar nota no topo: "Auditoria 2026-05-30 encerrada — todos os 🔴/🟡 resolvidos."
- [ ] **13. `docs/CHANGELOG.md`** — entry consolidada `2026-05-30 — Auditoria Fase 7 (limpeza fina)` com bullet por arquivo tocado.

---

## Critérios de aceitação

- `rg "🔴|🟡" docs/AUDIT_PHASE1.md` retorna **0 ocorrências** fora do bloco de legenda.
- Todos os arquivos editados têm `Última atualização: 2026-05-30` no topo.
- Nenhuma alteração em `src/`, `supabase/functions/` ou `supabase/migrations/`.
- CHANGELOG tem nova entry e o cabeçalho do `README.md` continua coerente (data 2026-05-30).

---

## Detalhes técnicos

- Edições paralelas via `code--line_replace` (não `code--write`) — todos os arquivos já existem e as mudanças são pontuais.
- Para o item **8 (FEATURE_FLAGS)**, vou precisar ler o arquivo antes para decidir se existe seção de flags por clínica ou só flags globais — pode virar uma nota de distinção em vez de novas entradas.
- Para o item **3 (REALTIME)**, vou ler antes para confirmar se as tabelas já estão listadas (a Fase 5 deixou nota só em `STATE_DATA.md`).
- Sem nova migração, sem deploy de edge function, sem alteração de UI.

---

## Estimativa

~13 edições pontuais em paralelo, 1 turno só. Posso executar assim que sair do modo de planejamento.