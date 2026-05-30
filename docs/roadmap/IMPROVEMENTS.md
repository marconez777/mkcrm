# Roadmap / Melhorias propostas

> **Quando ler:** ao planejar próximo trimestre, ao pegar um item para implementar, ou ao priorizar.
> **Última atualização:** 2026-05-30

Diferente de `known-issues/DEBT.md` (o que **deveria** estar melhor): aqui ficam **novas capacidades** propostas. Sem compromisso de prazo.

---

## Tier 1 — Próximo trimestre (alto valor)

### R-1. Streaming de resposta IA no Inbox
- Token-a-token via SSE + Realtime.
- Reduz percepção de latência drasticamente.
- Depende: TD-4.

### R-2. Merge de leads duplicados
- UI + função `merge_leads`.
- Resolve TD-1.

### R-3. Dashboard de billing por clínica
- Gráfico diário de gasto IA + email + projeção mensal.
- Botão "topar budget".

### R-4. Virtualização Kanban
- `@tanstack/react-virtual`.
- Resolve TD-2.

### R-5. Transcrição de áudio inbound (Whisper)
- Áudios viram texto no Inbox + alimentam contexto da IA.
- Hoje IA responde "não escuto áudios".

### R-6. Captcha invisível em forms públicos
- Resolve TD-9.

---

## Tier 2 — 6 meses (impacto médio/longo)

### R-7. Multi-timezone por clínica
- Resolve TD-14. Abre porta para internacionalização.

### R-8. A/B test de assunto em email + variant de prompt IA
- Tabelas `email_campaign_variants` + `ai_prompt_variants`.
- UI compare lado-a-lado.

### R-9. WhatsApp Cloud API oficial (alternativa ao Evolution)
- Clínicas com volume alto / risco de ban.
- Provider abstraction layer (Evolution | Cloud API).

### R-10. Workflow builder visual (n8n-like)
- Substitui parte de `automations` por canvas drag-and-drop.
- Mais flexível que regras YAML/JSON atuais.

### R-11. Knowledge Base com versionamento + auto-reindex
- Hoje upload manual + reindex manual.
- Webhook quando KB muda → reindex incremental.

### R-12. Score de lead automático
- Modelo simples (regressão logística) com `lead_events` como features.
- Campo `leads.score` já existe; falta o cálculo.

### R-13. SLA por stage + alerta
- "Lead parado em `contato` há >2 dias" → notificação.
- Tabela `stage_slas` + cron.

### R-14. Mobile app (React Native ou PWA polida)
- Hoje preview mobile do web funciona mas não é nativo.

### R-15. Integrações: Google Calendar (sync 2-way appointments)
- Connector já existe (`google_calendar`).
- Sync `appointments` ↔ calendário do responsável.

---

## Tier 3 — Visão / explorar

### R-16. Workflow voice agent (ligações IA)
- Vapi / Retell-like integrado ao funil.
- Complementa WhatsApp em conversões altas.

### R-17. Self-serve onboarding (sem provisionar manual)
- Hoje admin cria clínica. Permitir signup → wizard.

### R-18. Marketplace de templates
- Sequences, broadcasts, formulários compartilháveis entre clínicas (opt-in).

### R-19. Analytics avançado: cohorts, funil multi-touch
- Hoje só métricas básicas.
- Materialized views + UI com filtros.

### R-20. White-label completo
- Clínicas grandes querem subdomínio + branding próprio.

### R-21. Versionamento de prompts da IA (git-like)
- Diff, rollback, deploy gradual.

### R-22. Federação multi-clínica (rede)
- Grupos de clínicas compartilhando dashboards consolidados.

---

## Capacidades técnicas habilitadoras

Coisas que destravarão vários itens acima:

- **Cache layer** (Upstash Redis) → R-1, R-3, R-19.
- **Job queue dedicada** (pgmq ou BullMQ-like) → R-5, R-11.
- **Feature flags por usuário** (hoje só por clínica) → rollout gradual de qualquer R-*.
- **Observabilidade real** (Sentry + métricas) → debug de R-1, R-9.

---

## Como propor item

```
### R-N. Título
- 1–2 linhas explicando o quê e por quê.
- Depende: TD-X / R-Y se aplicável.
```

Mantenha numeração contínua; não reciclar IDs.

---

## Arquivos-chave

- `known-issues/DEBT.md`
- `known-issues/PITFALLS.md`
- `OVERVIEW.md` (visão de produto)
