---
title: Roadmap — Manutenção da Documentação
topic: roadmap
kind: roadmap
audience: agent
updated: 2026-06-12
summary: "Checklist vivo da saúde de docs/: rotina, métricas, backlog priorizado (F-DOC-1..6) para zerar drift de code_refs/rotas/edges e institucionalizar a manutenção."
code_refs:
  - scripts/docs-sync.mjs
  - scripts/gen-support-kb-manifest.mjs
  - docs/INDEX.json
  - docs/DRIFT.md
  - src/pages/admin/AdminDocs.tsx
related_docs:
  - docs/README.md
  - docs/MAP.md
  - docs/conventions/COMMIT_PR.md
  - docs/CHANGELOG.md
---

# Roadmap — Manutenção da Documentação

> **Para quê:** este arquivo é a **fonte da verdade** para manter a documentação do CRM saudável ao longo do tempo. Ele define o sistema, a rotina, as métricas e o backlog priorizado de "limpezas de doc".
>
> **Status atual (2026-06-12):** 148 docs, drift acumulado — 1 `code_ref` quebrado (corrigido em F-DOC-1), 19 rotas órfãs, 86 edge functions sem `code_ref` em nenhuma doc.

---

## 1. Visão geral do sistema de docs

```text
docs/                              ← markdown humano (fonte da verdade)
├── INDEX.json                     ← índice gerado (path, title, code_refs, summary)
├── DRIFT.md                       ← relatório de drift gerado a cada sync
├── architecture/ database/ ...    ← agente interno
└── support/                       ← KB do agente de IA de suporte ao cliente
    └── _templates/                ← gabaritos page.md / journey.md

public/
├── docs-index.json                ← consumido por /admin/docs (resumo)
└── docs-content.json              ← consumido por /admin/docs (corpo)

supabase/functions/_shared/
├── support-kb/                    ← espelho enxuto (sem frontmatter)
└── support-kb-manifest.ts         ← gerado, usado pelo RAG do SupportPanel

scripts/
├── docs-sync.mjs                  ← regenera INDEX.json + docs-*.json + DRIFT.md
└── gen-support-kb-manifest.mjs    ← regenera o manifesto do RAG
```

Pontos de consumo:
- **Agente Lovable** (sessões futuras de IA construindo o produto) — lê `docs/INDEX.json` primeiro, depois os `.md` referenciados.
- **`/admin/docs`** (super admin) — `AdminDocs.tsx` consome `public/docs-*.json`.
- **Agente de suporte ao cliente** — RAG sobre `support-kb-manifest.ts`.

## 2. Princípios

1. **Frontmatter obrigatório** em todo `.md` de `docs/` (`title`, `topic`, `kind`, `audience`, `updated`, `summary`, `code_refs`, `related_docs`).
2. **`code_refs` aponta para path real** (arquivo ou diretório terminando em `/`). Se some, vira drift.
3. **`updated` sobe** sempre que a doc for tocada.
4. **Cross-link** via `related_docs` — nunca deixar uma doc isolada.
5. **PT-BR claro** em `docs/support/**`; PT-BR técnico no resto.
6. **Nada de segredos** no markdown — só nomes de variáveis de ambiente.

## 3. Fluxo "ao mudar código"

| Mudou… | Atualize obrigatoriamente |
|---|---|
| Rota nova em `src/App.tsx` ou página em `src/pages/` | `docs/maps/<FEATURE>.md` (Rotas) + `docs/frontend/PAGES.md` |
| Edge function nova ou assinatura mudou | `docs/edge-functions/<DOMÍNIO>.md` + mapa de feature + `code_refs` |
| Tabela / RLS / migration relevante | `docs/database/SCHEMA.md` ou `RLS_POLICIES.md` + mapa de feature |
| Invariante quebrável | seção 7 do mapa correspondente |
| Texto visível, label de botão, fluxo de tela | `docs/support/pages/<rota>.md` |
| Jornada transversal nova (criar agente, importar leads…) | `docs/support/journeys/<tema>.md` |
| Mensagem de erro / recuperação | `docs/support/troubleshooting/<área>.md` |

## 4. Rotina semanal

1. `node scripts/docs-sync.mjs` (regenera índices e DRIFT).
2. Abrir `docs/DRIFT.md` — para cada item novo, abrir tarefa (F-DOC-N+1) e adicionar ao backlog abaixo.
3. Métricas (seção 8) viram um print/anotação curta no `docs/CHANGELOG.md`.

## 5. Rotina por release

- Atualizar `docs/CHANGELOG.md` com a fase entregue.
- Bumpar `updated:` em todas as docs tocadas.
- Confirmar que `DRIFT.md` ficou igual ou melhor (nunca pior).

## 6. Backlog priorizado

### F-DOC-1 — Limpeza imediata ✅ (2026-06-12)
- Corrigido `code_ref` quebrado em `docs/roadmap/CLINIC_PIPELINE.md` (`src/pages/automations/` removido; substituído por refs reais).
- Roadmap salvo neste arquivo e linkado em `docs/README.md` e `docs/conventions/COMMIT_PR.md`.

### F-DOC-2 — Cobrir rotas órfãs (mapas)  ⏳
Para cada rota listada em `DRIFT.md → Rotas em src/App.tsx sem mapa`, decidir:
- já coberta por um map existente → adicionar `code_refs` para o arquivo da página;
- não coberta → criar/expandir mapa.

Agrupamento sugerido:
- `/admin/{clinics,users,plans,usage,observability,support,integrations,builder-manual,branding,docs}` → expandir `docs/maps/ADMIN_SUPER_ADMIN.md`.
- `/metrics`, `/metrics/ai-usage`, `/metrics/engagement` → criar `docs/maps/METRICS.md`.
- `/onboarding` → `docs/maps/AUTH_MULTI_TENANCY.md`.
- `/reset-password`, `/invite/:token`, `/unsubscribe` → `docs/maps/AUTH_MULTI_TENANCY.md` (auth) e `docs/maps/EMAIL.md` (unsubscribe).
- `/tracking-debug` → `docs/maps/TRACKING_FORMS.md`.
- `integrations/eduzz` → `docs/maps/BILLING_PLANS.md`.

**Meta:** rotas órfãs ≤ 3.

### F-DOC-3 — Cobrir edge functions órfãs (86) ⏳
Agrupar por domínio e adicionar `code_refs: - supabase/functions/<name>/` na doc de domínio:

| Domínio | Doc-alvo | Funções |
|---|---|---|
| WhatsApp / Evolution | `docs/edge-functions/WHATSAPP.md` + `docs/maps/INBOX_WHATSAPP.md` | `evolution-*` (15), `wa-redirect`, `fetch-wa-avatar`, `transcribe-audio` |
| IA / Agentes | `docs/edge-functions/AI.md` + `docs/maps/AI_RUNTIME.md` | `ai-*` (12), `agent-*` (3), `ai-spend-notify` |
| Email | `docs/edge-functions/EMAIL.md` + `docs/maps/EMAIL.md` | `send-email*`, `process-email-queue`, `dispatch-campaign`, `process-scheduled-campaigns`, `email-*`, `resend-webhook`, `backfill-resend-events` |
| Tracking / Forms | `docs/edge-functions/TRACKING.md` + `docs/maps/TRACKING_FORMS.md` | `track-event`, `tracking-*`, `forms-*`, `external-lead-capture`, `log-frontend-error` |
| Admin / Billing | `docs/maps/ADMIN_SUPER_ADMIN.md` + `docs/maps/BILLING_PLANS.md` | `admin-*`, `clinic-*`, `auth-login`, `cron-expire-manual-grants`, `eduzz-webhook`, `integrations-status` |
| Automations / Sequences / Broadcasts | `docs/maps/AUTOMATIONS_SEQUENCES.md` | `automations-tick`, `sequence-*`, `broadcast-*`, `scheduled-dispatcher`, `scheduled-report-tick`, `watch-stale-leads`, `daily-summary` |
| Suporte | `docs/maps/ADMIN_SUPER_ADMIN.md` (ou novo `SUPPORT.md`) | `support-*` |

**Meta:** "Edge functions sem code_ref" = 0.

### F-DOC-4 — Refresh das docs do Pipeline IA (F0-F9) ⏳
- Bumpar `updated` em: `support/journeys/usar-pipeline-ia.md`, `support/pages/settings.md`, `support/pages/kanban.md`, `support/pages/tasks.md`.
- Adicionar cross-link mútuo entre essas e `CLINIC_PIPELINE.md` + este roadmap.
- Verificar `src/hooks/useClinicTeam.ts` mencionado em `support/pages/tasks.md` (mudança recente).

### F-DOC-5 — Hardening de processo ⏳
- Adicionar nota em `docs/conventions/COMMIT_PR.md` apontando para este roadmap (✅ feito junto com F-DOC-1).
- Avaliar adicionar `node scripts/docs-sync.mjs --check` em pre-commit/CI (proposta, não execução).

### F-DOC-6 — Higiene contínua 🔁
- Rodar a rotina semanal (§4) e por release (§5).
- Qualquer item novo em `DRIFT.md` vira F-DOC-N no fim deste backlog.

## 7. Definition of Done (copiar pro PR)

```markdown
- [ ] Frontmatter atualizado (`updated:` = hoje) em toda doc tocada.
- [ ] `code_refs` apontam para paths reais (sem drift novo).
- [ ] Páginas/rotas adicionadas/removidas refletidas em `docs/support/pages/`.
- [ ] Fluxos novos refletidos em `docs/support/journeys/`.
- [ ] `node scripts/docs-sync.mjs` rodado e índices commitados.
- [ ] `docs/DRIFT.md` revisado; itens não resolvidos viraram F-DOC-N no roadmap.
```

## 8. Métricas (preencher a cada release)

| Data | Total docs | code_refs quebrados | Rotas órfãs | Edges sem code_ref |
|---|---|---|---|---|
| 2026-06-12 (baseline) | 148 | 0 (após F-DOC-1) | 19 | 86 |
| _próximo release_ | | | | |

## 9. Glossário rápido

- **drift** — divergência entre código e doc (ex: `code_ref` que não existe mais).
- **map** (`docs/maps/<FEATURE>.md`) — guia "onde editar código" por feature, 9 seções fixas.
- **support page** (`docs/support/pages/<rota>.md`) — versão usuário-final de uma tela.
- **journey** (`docs/support/journeys/<tema>.md`) — sequência de passos do usuário cruzando várias telas.
