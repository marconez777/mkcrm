# Plano: Documentação Completa do Sistema CRM mkart

## Objetivo

Criar uma documentação **viva, profunda e estruturada** dentro de `docs/`, escrita para consumo do próprio chat Lovable em sessões futuras. Ela serve como "memória externa" para evitar releitura de dezenas de arquivos a cada modificação. Cobre: arquitetura, banco, edge functions, frontend, fluxos, integrações, erros conhecidos, melhorias sugeridas e convenções.

Hoje já existem 4 arquivos em `docs/`: `OVERVIEW.md`, `AI.md`, `EMAIL.md`, `TRACKING.md`. O plano **reaproveita e expande** o que existe, sem duplicar.

---

## Princípios da documentação

1. **Otimizada para LLM**: cabeçalhos previsíveis, tabelas, listas, blocos de código. Cada arquivo começa com um índice e um "quando ler este doc".
2. **Referências cruzadas**: links relativos entre docs (`[veja](./AI.md#rag)`).
3. **Fonte da verdade citada**: para cada afirmação técnica, citar arquivo + função (`supabase/functions/ai-auto-reply/index.ts`).
4. **Seção "Pegadinhas / erros conhecidos"** em cada doc — onde a IA costuma errar.
5. **Seção "Melhorias sugeridas"** separada do que existe hoje, para não confundir realidade vs. desejo.
6. **Datado**: cada arquivo tem `Última atualização: YYYY-MM-DD` no topo.
7. **Sem segredos**: nunca incluir chaves, apenas nomes de variáveis.

---

## Estrutura final de `docs/`

```text
docs/
├── README.md                    # Índice mestre + como navegar a doc
├── OVERVIEW.md                  # (já existe — será revisado/atualizado)
├── architecture/
│   ├── STACK.md                 # Stack, build, deploy, env vars
│   ├── MULTI_TENANCY.md         # clinic_id, RLS, papéis, funções SQL
│   ├── AUTH.md                  # Login, lockouts, convites, Google OAuth
│   ├── FEATURE_FLAGS.md         # Sistema de features por clínica
│   └── REALTIME.md              # Tabelas em realtime, padrões de subscribe
├── database/
│   ├── SCHEMA.md                # Todas as ~75 tabelas agrupadas + colunas chave
│   ├── RLS_POLICIES.md          # Padrões de RLS + tabelas administrativas
│   ├── FUNCTIONS_TRIGGERS.md    # Funções SQL e triggers (current_clinic_id, etc)
│   └── MIGRATIONS.md            # Convenção de migrações + histórico relevante
├── edge-functions/
│   ├── INDEX.md                 # Tabela: função → propósito → cron? → JWT?
│   ├── WHATSAPP.md              # evolution-* + webhook + dedup
│   ├── AI.md                    # (mover/expandir AI.md atual para cá)
│   ├── EMAIL.md                 # (mover/expandir EMAIL.md atual)
│   ├── TRACKING.md              # (mover/expandir TRACKING.md atual)
│   ├── BROADCASTS.md            # broadcast-control, broadcast-tick, janelas
│   ├── SEQUENCES_AUTOMATIONS.md # sequence-*, automations-tick, gatilhos
│   ├── FORMS.md                 # forms-* + plugin WordPress
│   └── SHARED_HELPERS.md        # _shared/* (ai, evolution, rag, mcp, metrics, spend-guard)
├── frontend/
│   ├── ROUTING.md               # App.tsx, ProtectedRoute, FeatureRoute, AppShell
│   ├── PAGES.md                 # Cada page do src/pages com o que faz
│   ├── COMPONENTS.md            # Inbox, Kanban, Tasks, Email editor, Admin
│   ├── HOOKS_LIB.md             # hooks/ e lib/ (helpers puros)
│   ├── DESIGN_SYSTEM.md         # tokens HSL, index.css, tailwind.config
│   └── STATE_DATA.md            # React Query keys, padrões de cache, drafts
├── flows/
│   ├── INBOUND_WHATSAPP.md      # webhook → ingest → realtime → auto-reply
│   ├── OUTBOUND_WHATSAPP.md     # composer → evolution-send → ack/retry
│   ├── AI_AGENT_LOOP.md         # prompt + RAG + memória + tools + traces
│   ├── EMAIL_CAMPAIGN.md        # template → segment → queue → resend → webhook
│   ├── LEAD_LIFECYCLE.md        # criação, stage history, deleção/tombstones
│   ├── BROADCAST.md             # criação, congelamento, janela, rotação
│   └── TRACKING_TO_LEAD.md      # pixel → session → identify → atribuição
├── integrations/
│   ├── EVOLUTION_API.md         # endpoints usados, payloads, auth
│   ├── RESEND.md                # domínios, eventos, quota
│   ├── LOVABLE_AI.md            # modelos suportados, custo, gateway
│   ├── PG_NET_CRON.md           # uso de pg_net e cron jobs ativos
│   └── EXTERNAL_FORMS.md        # external-lead-capture + plugin WP
├── operations/
│   ├── COSTS_LIMITS.md          # ai_usage, ai_spend_limits, daily reset
│   ├── OBSERVABILITY.md         # audit_log, agent_traces, edge logs
│   ├── ERROR_HANDLING.md        # padrões de erro em edge + frontend (402, lockout, etc)
│   ├── BACKUPS_RECOVERY.md      # tombstones, soft delete, restore
│   └── PERFORMANCE.md           # índices críticos, paginação, query limits 1000
├── known-issues/
│   ├── PITFALLS.md              # erros recorrentes que a IA comete neste repo
│   └── DEBT.md                  # dívidas técnicas conhecidas
├── roadmap/
│   └── IMPROVEMENTS.md          # melhorias sugeridas (separado do que existe)
└── conventions/
    ├── CODE_STYLE.md            # nomes, RHF+zod, tanstack, error patterns
    ├── SUPABASE_RULES.md        # nunca editar client.ts/types.ts/.env/config.toml
    ├── SECURITY.md              # RLS-first, role checks, secrets
    └── COMMIT_PR.md             # padrão de migrações, naming
```

---

## Execução em etapas (cada etapa = 1 mensagem do usuário em modo build)

Cada etapa tem escopo fechado e produz um conjunto de arquivos completos. Após cada etapa, atualizamos `docs/README.md` com o status.

**Etapa 1 — Fundação** *(meta-doc + revisão do OVERVIEW)*
- `docs/README.md` (índice mestre, convenções da doc, mapa de "quando ler o quê")
- Atualizar `docs/OVERVIEW.md` para ficar consistente com as novas seções e apontar para elas
- `docs/conventions/*` (4 arquivos curtos)

**Etapa 2 — Arquitetura & multi-tenancy**
- `docs/architecture/STACK.md`
- `docs/architecture/MULTI_TENANCY.md`
- `docs/architecture/AUTH.md` (incluindo `auth-login`, lockouts, fluxo Google)
- `docs/architecture/FEATURE_FLAGS.md`
- `docs/architecture/REALTIME.md`

**Etapa 3 — Banco de dados**
- `docs/database/SCHEMA.md` (varredura completa via `supabase--read_query` em `information_schema` para garantir precisão)
- `docs/database/RLS_POLICIES.md` (via `pg_policies`)
- `docs/database/FUNCTIONS_TRIGGERS.md` (via `pg_proc`/`pg_trigger`)
- `docs/database/MIGRATIONS.md`

**Etapa 4 — Edge functions (parte 1: WhatsApp + Shared)**
- `docs/edge-functions/INDEX.md` (tabela mestre de todas as ~60 funções)
- `docs/edge-functions/WHATSAPP.md`
- `docs/edge-functions/SHARED_HELPERS.md`

**Etapa 5 — Edge functions (parte 2: IA, Email, Tracking)**
- `docs/edge-functions/AI.md` (consolidando/expandindo o atual)
- `docs/edge-functions/EMAIL.md`
- `docs/edge-functions/TRACKING.md`

**Etapa 6 — Edge functions (parte 3: Broadcasts, Sequences, Forms)**
- `docs/edge-functions/BROADCASTS.md`
- `docs/edge-functions/SEQUENCES_AUTOMATIONS.md`
- `docs/edge-functions/FORMS.md`

**Etapa 7 — Frontend**
- `docs/frontend/ROUTING.md`
- `docs/frontend/PAGES.md`
- `docs/frontend/COMPONENTS.md`
- `docs/frontend/HOOKS_LIB.md`
- `docs/frontend/DESIGN_SYSTEM.md`
- `docs/frontend/STATE_DATA.md`

**Etapa 8 — Fluxos end-to-end**
Diagramas ASCII + passo a passo para cada um dos 7 arquivos em `docs/flows/`.

**Etapa 9 — Integrações externas**
Os 5 arquivos em `docs/integrations/`.

**Etapa 10 — Operações & confiabilidade**
Os 5 arquivos em `docs/operations/` — destaque para `COSTS_LIMITS.md` (sistema de spend limit recém-criado) e `ERROR_HANDLING.md`.

**Etapa 11 — Pegadinhas, dívidas e roadmap**
- `docs/known-issues/PITFALLS.md` — coletar erros que a IA cometeu nas últimas sessões (auto-restart de edge, edição de arquivos proibidos, RLS recursiva, etc.)
- `docs/known-issues/DEBT.md`
- `docs/roadmap/IMPROVEMENTS.md`

**Etapa 12 — Validação e polish**
- Reler todos os arquivos, checar links cruzados
- Verificar que `docs/README.md` lista 100% dos docs
- Verificar `OVERVIEW.md` aponta para a nova estrutura
- Atualizar memória do projeto (`mem://index.md`) apontando que `docs/README.md` é o índice canônico

---

## Detalhes técnicos / como cada etapa é gerada

- **Banco**: usar `supabase--read_query` contra `information_schema.tables`, `information_schema.columns`, `pg_policies`, `pg_proc`, `pg_trigger`, `pg_cron.job` — garante precisão sem alucinar colunas.
- **Edge functions**: para cada função, ler `index.ts`, extrair: entrypoint, secrets usados, tabelas tocadas, chamadas externas, schedule (se houver em `pg_cron`), códigos de erro HTTP.
- **Frontend**: varrer `src/pages`, `src/components`, `src/hooks`, `src/lib` listando exports principais e dependências (React Query keys, RPCs chamadas).
- **Fluxos**: cada diagrama mostra atores (User, UI, Edge, DB, Externo) com setas numeradas + tabela de "pontos de falha".

## O que NÃO está no escopo

- Documentação para usuário final (manuais de uso do produto)
- Tradução para inglês — toda a doc fica em **português técnico** (consistente com o código e comentários atuais)
- Reescrita de código — esta tarefa é **somente documentação**

## Critério de "pronto"

- Todos os arquivos da árvore acima existem
- `docs/README.md` é navegável e dá um caminho claro de leitura
- Uma sessão nova do Lovable consegue, lendo apenas `docs/README.md` + 1–3 arquivos relevantes, fazer modificações em qualquer área do sistema sem precisar varrer o código.

---

## Próximo passo

Aprove o plano e eu executo a **Etapa 1** (fundação) imediatamente. Cada etapa subsequente será disparada por uma nova mensagem sua (`"próxima etapa"` basta), para mantermos qualidade alta e revisarmos incrementalmente.
