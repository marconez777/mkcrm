## Auditoria da Documentação — Plano em Fases

A pasta `docs/` tem ~60 arquivos espalhados em 12 subpastas + 7 markdowns na raiz. Em vez de tentar revisar tudo de uma vez (estouraria contexto e ficaria superficial), divido em **6 fases independentes**. Cada fase termina com um patch de docs atualizado e um relatório do que mudou. Você aprova fase a fase.

### Fase 1 — Mapa + Índice Mestre
- Varrer `docs/` inteiro, gerar inventário (arquivo → tema → última menção de feature).
- Conferir `docs/README.md`, `OVERVIEW.md`, `CHANGELOG.md`, `GLOSSARY.md` e arquivos "stub" da raiz (`AI.md`, `EMAIL.md`, `TRACKING.md` têm só 5–7 linhas — provavelmente desatualizados/redirects).
- Entregável: tabela "doc × status (ok / desatualizado / órfão / faltando)" para guiar as fases seguintes.

### Fase 2 — Banco de Dados & Backend Core
- `docs/database/*` (SCHEMA, RLS_POLICIES, FUNCTIONS_TRIGGERS, MIGRATIONS) vs. migrations reais em `supabase/migrations/` e `src/integrations/supabase/types.ts`.
- `docs/architecture/*` (AUTH, MULTI_TENANCY, REALTIME, STACK, FEATURE_FLAGS).
- Foco: tabelas/colunas novas (ex: `email_campaigns.segment_ids` adicionado agora), policies, triggers.

### Fase 3 — Edge Functions & Integrações
- `docs/edge-functions/*` vs. `supabase/functions/*` (comparar lista, assinaturas, secrets).
- `docs/integrations/*` (RESEND, EVOLUTION_API, LOVABLE_AI, PG_NET_CRON, EXTERNAL_FORMS) vs. código real + secrets configurados.
- Atualizar `SHARED_HELPERS.md` se helpers mudaram.

### Fase 4 — Features & Fluxos
- `docs/features/*` (BROADCASTS, FORMS, SEQUENCES_AUTOMATIONS) e `docs/flows/*` (EMAIL_CAMPAIGN, BROADCAST, AI_AGENT_LOOP, LEAD_LIFECYCLE, etc.) vs. páginas/componentes em `src/pages/` e `src/components/`.
- Foco: novidades recentes (multi-segmento em campanhas de email, tela "Engajamento" movida para dentro de "IA", etc.).

### Fase 5 — Frontend & Convenções
- `docs/frontend/*` (PAGES, ROUTING, COMPONENTS, HOOKS_LIB, STATE_DATA, DESIGN_SYSTEM) vs. estrutura atual de `src/`.
- `docs/conventions/*` (CODE_STYLE, COMMIT_PR, SECURITY, SUPABASE_RULES) — checagem mais leve, atualizar só se divergente.

### Fase 6 — Integração JS, Operações, Roadmap & Known Issues
- `docs/integracao/*` (13 arquivos do snippet de tracking) vs. código de tracking real e edge functions de ingest.
- `docs/operations/*` (BACKUPS, COSTS, ERROR_HANDLING, OBSERVABILITY, PERFORMANCE).
- `docs/known-issues/*` — remover itens já resolvidos, adicionar novos.
- `docs/roadmap/*` — marcar entregues, repriorizar.
- Atualizar `CHANGELOG.md` consolidando tudo que mudou nas fases 2–5.

### Como cada fase funciona
1. Eu leio os docs da fase + o código correspondente (uso `acp_subagent--explore` para varrer em paralelo quando faz sentido).
2. Produzo um diff de docs (sem mexer em código de aplicação).
3. Entrego um resumo "X arquivos atualizados, Y criados, Z marcados como obsoletos" e aguardo seu OK para a próxima fase.

### Observações
- Nenhuma fase mexe em código de runtime — só em `docs/`.
- Se quiser, posso reordenar (ex: começar pela Fase 4 que reflete mudanças mais recentes que você fez).
- Posso também rodar fases em paralelo via subagents se preferir velocidade sobre revisão incremental.
