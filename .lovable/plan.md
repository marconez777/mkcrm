# Plano — Atualização da Documentação + Roadmap permanente

## Objetivo
Sair do estado atual (148 docs, drift acumulado: **86 edge functions sem `code_ref`**, **19 rotas sem mapa**, 1 `code_ref` quebrado em `CLINIC_PIPELINE.md`) e deixar um **roadmap salvo no próprio repo** que vire o "checklist vivo" das próximas atualizações de doc.

## Diagnóstico rápido (já levantado)
- `docs/DRIFT.md` aponta:
  - 1 `code_ref` quebrado → `src/pages/automations/` em `roadmap/CLINIC_PIPELINE.md`.
  - 19 rotas em `src/App.tsx` sem mapa (admin/*, /onboarding, /metrics/*, /tracking-debug, etc.).
  - 86 edge functions sem nenhum `code_ref` apontando pra elas (praticamente todas as funções "antigas" do projeto).
- O sistema de docs já tem boa fundação: `INDEX.json`, `docs-sync.mjs`, `support-kb-manifest`, frontmatter padronizado, templates em `docs/support/_templates/`.
- O que falta é **fechar o drift** e **institucionalizar a rotina** num arquivo único.

## Entregáveis

### 1. Roadmap permanente (arquivo novo)
`docs/roadmap/DOCS_MAINTENANCE.md` — vira a "fonte da verdade" pra manutenção contínua de docs. Estrutura:

```text
1. Visão geral do sistema de docs (INDEX.json, docs-sync, support-kb, /admin/docs)
2. Princípios (frontmatter obrigatório, code_refs, updated, related_docs)
3. Fluxo "ao mudar código" (tabela: mudou X → atualizar Y)
4. Rotina semanal (rodar docs-sync, revisar DRIFT.md, fechar pendências)
5. Rotina por release (CHANGELOG.md, bump updated nas docs tocadas)
6. Backlog priorizado (fases F1..Fn — ver abaixo)
7. Definition of Done de doc (checklist copiável pra PR)
8. Métricas (nº de drift items, % edges com code_ref, % rotas com mapa)
```

Esse arquivo é **vivo**: cada fase concluída marca `✅`, novas fases entram no fim.

### 2. Fases de execução (vão para o backlog do roadmap)

**F-DOC-1 — Limpeza imediata (1 PR pequeno)**
- Corrigir `code_ref` quebrado em `docs/roadmap/CLINIC_PIPELINE.md` (remover `src/pages/automations/`, apontar pro arquivo correto).
- Rodar `node scripts/docs-sync.mjs` e commitar índices regenerados.

**F-DOC-2 — Cobrir rotas órfãs (mapas)**
- Para cada rota sem mapa, decidir: já coberta por um map existente (citar) ou criar/expandir map.
- Alvos prioritários: `/admin/*` (5 rotas) → `docs/maps/ADMIN_SUPER_ADMIN.md`; `/metrics/*` (3 rotas) → novo `docs/maps/METRICS.md`; `/onboarding`, `/reset-password`, `/invite`, `/unsubscribe`, `/tracking-debug` → adicionar à doc do domínio existente (`AUTH_MULTI_TENANCY.md`, `TRACKING_FORMS.md`).

**F-DOC-3 — Cobrir edge functions órfãs (86)**
- Agrupar por domínio (whatsapp, ai, email, tracking, admin, forms, broadcast, agent, etc.).
- Para cada grupo, adicionar `code_refs: - supabase/functions/<name>/` na doc de domínio correspondente (`docs/edge-functions/WHATSAPP.md`, `AI.md`, `EMAIL.md`, `TRACKING.md`, ou no mapa equivalente).
- Onde a função não tem doc de domínio (ex: `cron-expire-manual-grants`, `eduzz-webhook`), adicionar parágrafo curto na doc mais próxima ou criar stub.
- Critério de pronto: `DRIFT.md` → "Edge functions sem code_ref" zerada.

**F-DOC-4 — Atualizar docs tocadas pelas últimas fases F0-F9 do Pipeline IA**
- Verificar `code_refs` e `updated` em: `CLINIC_PIPELINE.md`, `support/journeys/usar-pipeline-ia.md`, `support/pages/settings.md`, `support/pages/kanban.md`, `support/pages/tasks.md` (mudou com `useClinicTeam`).
- Cross-link entre eles e com `architecture/PLANS_LIMITS.md` se aplicável.

**F-DOC-5 — Hardening do CI**
- Confirmar que `node scripts/docs-sync.mjs --check` está rodando em algum hook/CI; se não, deixar **documentado** no roadmap como próximo passo (sem mexer em CI nesta rodada).
- Adicionar nota em `docs/conventions/COMMIT_PR.md` reforçando: "PR que muda rota/edge/tabela deve atualizar `code_refs` da doc correspondente".

**F-DOC-6 — Higiene contínua (recorrente, fica no roadmap)**
- Semanal: rodar `docs-sync`, revisar `DRIFT.md`, abrir issues para itens novos.
- A cada release: atualizar `docs/CHANGELOG.md` e datas `updated:` das docs tocadas.

### 3. Atualizações de suporte ao roadmap
- `docs/README.md` — adicionar linha apontando para `roadmap/DOCS_MAINTENANCE.md`.
- `docs/conventions/COMMIT_PR.md` — referência cruzada ao novo roadmap.

## O que NÃO faz parte deste plano
- Não vou reescrever as 86 docs de edge function uma a uma agora — F-DOC-3 só adiciona `code_refs` (linka) na doc de domínio existente. Reescritas profundas viram fases futuras se necessário.
- Não vou alterar CI/GitHub Actions nesta rodada (só documentar a recomendação).
- Não vou mexer em código de produto, só em `docs/**` e índices gerados.

## Critério de "pronto" desta rodada
- `docs/roadmap/DOCS_MAINTENANCE.md` criado e linkado no README.
- F-DOC-1 executado (drift de `code_ref` quebrado = 0).
- F-DOC-2, F-DOC-3, F-DOC-4 executados → `DRIFT.md` reduz drasticamente (meta: rotas sem mapa ≤ 3, edges sem code_ref = 0).
- `docs-sync` roda limpo, `/admin/docs` mostra tudo atualizado.

## Pergunta antes de seguir
Você quer que eu execute **tudo** (F-DOC-1 a F-DOC-5) nesta mesma rodada, ou prefere que eu entregue só **F-DOC-1 + o roadmap salvo** primeiro e a gente vá fechando as outras fases em PRs separados?
