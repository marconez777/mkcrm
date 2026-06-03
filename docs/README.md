# Documentação — CRM mkart

> **Quem deve ler:** o próprio chat Lovable (em sessões futuras), antes de modificar qualquer parte do sistema. Esta documentação é a **memória externa** do projeto: ler primeiro evita varrer 50+ arquivos.
>
> **Última atualização:** 2026-06-03
> **Status da doc:** ✅ v1.0 + auditoria 2026-05-30 + atualização jun/2026 (Admin v2, catálogo `plans`, redesign Agentes) + auditoria documental Fase 1/8 (2026-06-03) — **80 arquivos `.md`** em `docs/` + 6 exemplos em `docs/integracao/exemplos/`. Ver `CHANGELOG.md`.

---

## Como navegar

1. Leia este `README.md` inteiro (mapa de leitura abaixo).
2. Leia [`OVERVIEW.md`](./OVERVIEW.md) para entender o produto em 10 min.
3. Em dúvida sobre um termo? `GLOSSARY.md`.
4. Vá direto ao(s) arquivo(s) específico(s) da área que você vai mexer.
5. **Antes de qualquer mudança**, leia `known-issues/PITFALLS.md` (40 armadilhas recorrentes).

**Regra de ouro:** se você só precisa mudar uma tela → leia `frontend/*` + o `flows/*` correspondente. Se vai mexer no banco → `database/*` + `architecture/MULTI_TENANCY.md`. Se vai mexer numa edge function → `edge-functions/INDEX.md` + o arquivo do domínio.

---

## Mapa de leitura por tipo de tarefa

| Tarefa | Leia primeiro |
|---|---|
| Adicionar/alterar página | `frontend/ROUTING.md` → `frontend/PAGES.md` → `frontend/COMPONENTS.md` |
| Adicionar coluna / tabela | `database/SCHEMA.md` → `database/RLS_POLICIES.md` → `conventions/SUPABASE_RULES.md` |
| Mexer numa edge function | `edge-functions/INDEX.md` → arquivo do domínio (ex.: `WHATSAPP.md`) → `SHARED_HELPERS.md` |
| Novo agente / tool de IA | `flows/AI_AGENT_LOOP.md` → `edge-functions/AI.md` → `integrations/LOVABLE_AI.md` |
| Mexer em email marketing | `flows/EMAIL_CAMPAIGN.md` → `edge-functions/EMAIL.md` → `integrations/RESEND.md` |
| Debug de WhatsApp | `flows/INBOUND_WHATSAPP.md` ou `OUTBOUND_WHATSAPP.md` → `integrations/EVOLUTION_API.md` |
| Custos / limites de IA | `operations/COSTS_LIMITS.md` |
| Erro/bug recorrente | `known-issues/PITFALLS.md` antes de qualquer coisa |
| Autenticação / login | `architecture/AUTH.md` |
| Feature flag | `architecture/FEATURE_FLAGS.md` |

---

## Estrutura completa

```text
docs/
├── README.md                    ← você está aqui
├── OVERVIEW.md                  Visão geral do produto
├── GLOSSARY.md                  Termos do projeto
├── CHANGELOG.md                 Mudanças na própria doc
├── architecture/                Decisões transversais
│   ├── STACK.md
│   ├── MULTI_TENANCY.md
│   ├── AUTH.md
│   ├── FEATURE_FLAGS.md
│   └── REALTIME.md
├── database/                    Tudo do Postgres
│   ├── SCHEMA.md
│   ├── RLS_POLICIES.md
│   ├── FUNCTIONS_TRIGGERS.md
│   └── MIGRATIONS.md
├── edge-functions/              Cada função Deno
│   ├── INDEX.md
│   ├── WHATSAPP.md
│   ├── AI.md
│   ├── EMAIL.md
│   ├── TRACKING.md
│   └── SHARED_HELPERS.md
├── features/                    Domínios completos (DB + edge + frontend)
│   ├── BROADCASTS.md
│   ├── SEQUENCES_AUTOMATIONS.md
│   ├── BUILDER_AGENTS.md          ⭐ Construtor de Agentes (Builder) — 9 fases
│   └── FORMS.md

├── frontend/                    React / Vite
│   ├── ROUTING.md
│   ├── PAGES.md
│   ├── COMPONENTS.md
│   ├── HOOKS_LIB.md
│   ├── DESIGN_SYSTEM.md
│   └── STATE_DATA.md
├── flows/                       Fluxos end-to-end (atores + setas)
│   ├── INBOUND_WHATSAPP.md
│   ├── OUTBOUND_WHATSAPP.md
│   ├── AI_AGENT_LOOP.md
│   ├── EMAIL_CAMPAIGN.md
│   ├── LEAD_LIFECYCLE.md
│   ├── BROADCAST.md
│   └── TRACKING_TO_LEAD.md
├── integrations/                APIs externas
│   ├── EVOLUTION_API.md
│   ├── RESEND.md
│   ├── LOVABLE_AI.md
│   ├── PG_NET_CRON.md
│   └── EXTERNAL_FORMS.md
├── integracao/                  ⭐ Guia completo p/ integradores externos (PT)
│   ├── README.md                  índice + decision tree
│   ├── 01-visao-geral.md
│   ├── 02-instalacao-snippets.md
│   ├── 03-tracking-eventos.md
│   ├── 04-formularios.md
│   ├── 05-atribuicao-leads.md
│   ├── 06-eventos-customizados.md
│   ├── 07-webhooks-api-direta.md
│   ├── 08-seguranca.md
│   ├── 09-troubleshooting.md
│   ├── 10-referencia-tecnica.md
│   └── exemplos/                  snippets copy-paste por stack

├── operations/                  Confiabilidade, custos, observabilidade
│   ├── COSTS_LIMITS.md
│   ├── OBSERVABILITY.md
│   ├── ERROR_HANDLING.md
│   ├── BACKUPS_RECOVERY.md
│   └── PERFORMANCE.md
├── known-issues/                Onde a IA costuma errar
│   ├── PITFALLS.md
│   └── DEBT.md
├── roadmap/
│   └── IMPROVEMENTS.md
└── conventions/                 Regras inegociáveis
    ├── CODE_STYLE.md
    ├── SUPABASE_RULES.md
    ├── SECURITY.md
    └── COMMIT_PR.md
```

---

## Convenções da própria documentação

1. **Português técnico** em todo lugar. Termos de código permanecem em inglês.
2. Todo arquivo começa com bloco `> **Quando ler:** ... > **Última atualização:** YYYY-MM-DD`.
3. Cite a **fonte da verdade**: nome de arquivo + função/tabela (`supabase/functions/ai-auto-reply/index.ts`).
4. Toda seção técnica termina com **"Pegadinhas"** e **"Melhorias sugeridas"** quando aplicável.
5. Diagramas em ASCII dentro de blocos ```` ```text ````.
6. **Nunca** colocar segredos, chaves ou URLs com tokens. Apenas nomes de variáveis de ambiente.
7. Links internos sempre relativos (`./AI.md#secao`).
8. Quando o código mudar, **atualizar a doc no mesmo PR** e renovar a data do topo.

---

## Status da construção da doc

✅ **v1.0 completa em 2026-05-25.** As 12 etapas foram concluídas. Próximas evoluções entram via `CHANGELOG.md`.

| # | Etapa | Status |
|---|---|---|
| 1 | Fundação (README, OVERVIEW, conventions) | ✅ |
| 2 | Architecture & multi-tenancy | ✅ |
| 3 | Banco de dados | ✅ |
| 4 | Edge functions — WhatsApp + Shared | ✅ |
| 5 | Edge functions — IA, Email, Tracking | ✅ |
| 6 | Features — Broadcasts, Sequences/Automations, Forms | ✅ |
| 7 | Frontend | ✅ |
| 8 | Fluxos end-to-end | ✅ |
| 9 | Integrações externas | ✅ |
| 10 | Operações & confiabilidade | ✅ |
| 11 | Pegadinhas, dívidas, roadmap | ✅ |
| 12 | Validação e polish (glossário, changelog) | ✅ |

**Manutenção contínua:** ao mudar código, atualizar a doc no mesmo PR + renovar `Última atualização:` do topo do arquivo + registrar em `CHANGELOG.md`.
