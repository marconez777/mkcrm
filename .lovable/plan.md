## Onde paramos

✅ **Fase 1** — Inventário (`docs/AUDIT_PHASE1.md`).
✅ **Fase 2** — Banco & backend core (6 docs atualizados).
✅ **Fase 4 (parcial)** — Engajamento movido para aba de IA + `PAGES.md` + `ROUTING.md` + `CHANGELOG.md` já refletem a mudança.

## O que ainda falta

Pela auditoria, restam **4 fases** (3 → 4(resto) → 5 → 6) + encerramento. Vou rodá-las em ordem de impacto, sem tocar runtime — só `docs/`.

---

### Fase 4 — Resto: Features & Fluxos (multi-segmento + engajamento)

- `docs/features/BROADCASTS.md` — sem mudança esperada (WhatsApp, não email); só conferir.
- ➕ **Criar** `docs/features/EMAIL_CAMPAIGNS.md` cobrindo: multi-segmento (`segment_ids[]`), A/B (`email_campaign_variants` + `pick_ab_winner`), rotação de domínio (`pick_rotation_domain` + warmup), throttle por destinatário, agendamento, supressão por bounce. Linkar `flows/EMAIL_CAMPAIGN.md`.
- ➕ **Criar** `docs/features/ENGAGEMENT.md` (curto): o que mede, RPCs `engagement_*`, onde está a UI (aba `/ai/engagement`).
- `docs/flows/EMAIL_CAMPAIGN.md` — atualizar passo "seleção de segmento" → multi-segmento + union dedupe; mencionar A/B, rotação, throttle.
- `docs/flows/AI_AGENT_LOOP.md` — citar `messages.bot_agent_id` como loop-guard e `replied_at` em sequences.

### Fase 5 — Frontend (resto além de Engajamento)

- `docs/frontend/PAGES.md` — adicionar `EmailContacts`, `EmailUnsubscribes`, `EmailReports`, `ScheduledReports` se faltarem (Engajamento já feito); checar `Settings/Forms` e novas páginas.
- `docs/frontend/ROUTING.md` — adicionar quaisquer rotas faltando (`/settings/email`, `/email/contacts`, `/email/unsubscribes`, `/email/reports`, etc.).
- `docs/frontend/COMPONENTS.md` / `HOOKS_LIB.md` / `STATE_DATA.md` — verificação leve; só atualizar se houver hook/componente novo relevante (`CampaignRecipientsPreview` multi-segmento, `useHealth`, etc.).

### Fase 3 — Edge Functions & Integrações

- `docs/edge-functions/INDEX.md` — adicionar `scheduled-report-tick`, `evolution-fetch-groups`, qualquer outra função recente que falte na listagem.
- `docs/edge-functions/EMAIL.md` — refletir `dispatch-campaign` multi-segmento e A/B; cobrir warmup/rotação/throttle do lado do dispatcher se aplicável.
- `docs/edge-functions/AI.md` — mencionar `scheduled-report-tick` (ou criar bloco "Reports"), `bot_agent_id` no loop-guard.
- `docs/integrations/` — checar Evolution (groups), Resend (warmup/rotação se mudou), Lovable AI (sem mudança esperada).

### Fase 6 — Integração JS, Operations, Roadmap, Known-issues

- `docs/integracao/*` — varredura curta: confirmar que os 13 snippets ainda batem com o tracking real; ajustar se houver drift.
- `docs/operations/OBSERVABILITY.md` + `ERROR_HANDLING.md` — citar `email_operational_alerts`, `email_health_alerts`, views `email_system_health`/`email_throughput_stats`.
- `docs/roadmap/` (se existir) e `docs/known-issues/` — marcar como entregue: multi-segmento, R-17 a R-21, engajamento UI.
- `docs/EMAIL_SCALE.md`, `docs/IMPROVEMENTS.md` — marcar itens concluídos (notado na auditoria).

### Encerramento

- `docs/README.md` — atualizar data e contagem de arquivos.
- `docs/CHANGELOG.md` — entry consolidada final apontando para auditoria completa.
- Atualizar `docs/AUDIT_PHASE1.md` marcando todos os itens 🔴/🟡/➕ como resolvidos (ou virar `AUDIT_FINAL.md`).

---

## Execução proposta

Posso seguir **uma fase por turno**, cada uma com seu patch e relatório curto. Sugiro começar pela **Fase 4 (resto)** já que é a de maior impacto de produto e complementa o trabalho de hoje. Confirma?
