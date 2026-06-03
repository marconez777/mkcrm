## Objetivo

Revisar **um por um** os ~85 arquivos em `docs/` e reescrever/ajustar cada trecho que divergir do código atual (migrations, edge functions, frontend, `supabase/config.toml`, hooks/lib). Sem margem para erro — cada fato citado (nome de tabela, coluna, RPC, edge function, rota, prop, env var, limite) é validado contra a fonte antes de ser mantido ou corrigido.

## Método por arquivo

1. Ler o arquivo inteiro.
2. Extrair afirmações verificáveis: tabelas, colunas, RPCs, triggers, RLS, edge functions, env vars, rotas, componentes, hooks, limites, fluxos.
3. Validar contra a fonte (migrations mais recentes, código da função, componente atual). Buscas com `rg`, leitura de arquivos relevantes, `supabase--read_query` quando preciso confirmar schema vivo.
4. Aplicar edits cirúrgicos (`code--line_replace`) — reescrever inteiro só quando o drift for grande.
5. Atualizar carimbo `> Última atualização: 2026-06-03` quando o arquivo for tocado.
6. No fim da fase, anotar no `docs/CHANGELOG.md` o que mudou e dar resumo curto.

Convenções: PT-BR, nomes de produto em inglês (Lovable Cloud, Resend, Evolution API), nunca expor "Supabase" para o usuário final.

## Fases (aprovação entre cada uma)

### Fase 1 — Raiz + Arquitetura (12 arquivos)
`docs/README.md`, `OVERVIEW.md`, `GLOSSARY.md`, `CHANGELOG.md`, `AI.md`, `EMAIL.md`, `TRACKING.md`, `AUDIT_PHASE1.md`, `copilot.md`, e `architecture/{AUTH,FEATURE_FLAGS,MULTI_TENANCY,PLANS_LIMITS,REALTIME,STACK}.md`.
Foco: índice de docs, stack, multi-tenancy (`current_clinic_id`, `is_super_admin`), plans/limits, feature flags refletindo `src/lib/features.ts`, `src/lib/admin-plans.ts`, `clinics.settings`, edge `admin-apply-plan`.

### Fase 2 — Database (4 arquivos) ✅ concluída 2026-06-03
`database/{SCHEMA,RLS_POLICIES,FUNCTIONS_TRIGGERS,MIGRATIONS}.md`.
Varredura completa de `supabase/migrations/*.sql` (139) + `pg_catalog`. Achados principais: 12 tabelas ausentes adicionadas, `auth_lockouts` confirmada como inexistente (removida), contagem real 111 relações, RPCs admin reescritas, total de migrations 139.

### Fase 3 — Edge Functions (6 arquivos) ✅ concluída 2026-06-03
`edge-functions/{INDEX,AI,EMAIL,TRACKING,WHATSAPP,SHARED_HELPERS}.md`.
Achados principais: total 71 (não 70); 5 funções ausentes adicionadas (`ai-builder`, `ai-analyst-run`, `ai-reingest-document`, `agent-followups-tick`, `agent-learn-from-thread`); shared 14 módulos (não 13) + `builder-knowledge/`; ghost references removidas (`auth-login`, `BROADCASTS.md`, `SEQUENCES_AUTOMATIONS.md`, `FORMS.md`, `AUTH.md` em `edge-functions/`); bug latente `auth_lockouts` em `admin-*` documentado.

### Fase 4 — Frontend (6 arquivos) ✅ concluída 2026-06-03
`frontend/{COMPONENTS,DESIGN_SYSTEM,HOOKS_LIB,PAGES,ROUTING,STATE_DATA}.md`.
Achados principais: rotas `/site`, `/reset-password`, `/ai/agents/new` ausentes em ROUTING/PAGES; `/` é gateada por `RootGate`; pastas `components/agents/*` (15) e `components/site/*` (13) inteiramente ausentes em COMPONENTS; `ui/` real é 55 primitives; `useLeads()` não tem teto de 2000 (usa `fetchAllPaged`); hook `useWhatsappInstances` e 9 módulos `lib/*` (`app-url`, `fetch-all`, `csv`, `diff-lines`, `template-vars`, `quality-ladder`, `agent-tools`, `builder-errors`, `builder-tooltips`) ausentes; tokens `--status-*`, `--surface-*`, `--site-*` em `index.css` agora documentados.

### Fase 5 — Features + Flows (13 arquivos)
`features/*.md` (6) + `flows/*.md` (7).
Validação cruzada com hooks/edge functions referenciados; corrigir nomes de tabelas/colunas/triggers; alinhar com Plans/Limits e novas feature flags.

### Fase 6 — Integrações + Operações + Known issues + Roadmap + Conventions + Site (16 arquivos)
`integrations/*.md` (5), `operations/*.md` (5), `known-issues/*.md` (3), `roadmap/*.md` (3), `site/FEATURE_PAGES.md`, `conventions/*.md` (4).
Foco: secrets reais (Resend webhook secret agora obrigatório), limites, custos, retenção, pitfalls atualizados.

### Fase 7 — Guia de integração externa (14 .md + 6 exemplos)
`docs/integracao/*.md` + `exemplos/*`.
Endpoints (`forms-ingest`, `external-lead-capture`, `tracking-*`), schemas Zod reais, limites; exemplos (curl, GTM, WP, Next.js) coerentes com o estado atual.

### Fase 8 — Auditoria final cruzada
Releitura de **todos** os docs já editados, com checagens automatizadas e manuais:

- **Links internos quebrados** (`rg -n "\]\(\.{0,2}/" docs/`) → cada link relativo é resolvido contra o filesystem; quebrados são corrigidos.
- **Referências a tabelas/colunas/funções inexistentes** → grep cruzado contra `supabase/migrations/` e `types.ts`.
- **Referências a edge functions inexistentes** → grep cruzado contra `supabase/functions/`.
- **Rotas/componentes/hooks fantasmas** → grep cruzado contra `src/App.tsx` e `src/**`.
- **Termos inconsistentes** (ex.: "Supabase" exposto onde deveria ser "Lovable Cloud"; nomes de feature flags divergentes entre docs).
- **Carimbos de data desatualizados** nos arquivos tocados.
- **Recontagem final**: somar arquivos por fase e conferir cobertura 100% do `docs/`.

Entregável: relatório com lista de achados + correções aplicadas; `docs/CHANGELOG.md` ganha entrada "Auditoria final 2026-06-03".

## Entregáveis por fase

- Edits aplicados.
- Bullet list curta no chat: arquivos tocados + principais divergências corrigidas.
- Entrada nova em `docs/CHANGELOG.md`.

## Fora do escopo

- Nenhuma mudança em `src/**`, `supabase/functions/**`, migrations. Bugs reais descobertos são sinalizados em nota separada.
- Sem mexer em `.workspace/skills`, `mem://`, `supabase/config.toml`.

Pronto para iniciar pela **Fase 1** após aprovação.