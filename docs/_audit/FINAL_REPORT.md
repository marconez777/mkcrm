---
title: "F-DOC-FULL — Relatório final"
topic: general
kind: reference
audience: agent
updated: 2026-07-01
summary: "Encerramento do roadmap F-DOC-FULL: entregas por fase, cobertura, invariantes catalogadas e dívidas pendentes."
related_docs:
  - docs/_audit/PROGRESS.md
  - docs/_audit/INVENTORY.md
  - docs/README.md
---

# F-DOC-FULL — Relatório final

Roadmap iniciado em 2026-07-01, encerrado em 2026-07-01 (14 fases). Objetivo:
elevar a documentação de 62 arquivos dispersos para uma malha navegável por
mapas de feature usáveis pelo agente Lovable em qualquer sessão futura.

## Entregas por fase

| # | Tema | Entregável principal |
|---|---|---|
| 0 | Baseline | `_audit/INVENTORY.md` (467 arquivos mapeados), `_audit/PROGRESS.md` |
| 1 | Frontend core | `maps/FRONTEND_CORE.md` |
| 2 | Inbox / Kanban / Leads | `maps/INBOX_KANBAN_LEADS.md` |
| 3 | Pipeline runtime | `maps/PIPELINE_RUNTIME.md` + revalidação de `pipeline/runtime/` |
| 4 | Agentes IA | `maps/AI_AGENTS.md` |
| 5 | WhatsApp / Evolution / Broadcasts | `maps/{WHATSAPP,EVOLUTION_EDGES,BROADCASTS}.md` |
| 6 | Automações / Sequências / Templates / Tarefas | `maps/{AUTOMATIONS,SEQUENCES,TEMPLATES,TASKS}.md` |
| 7 | Email marketing | `maps/EMAIL_MARKETING.md` |
| 8 | Tracking / Forms / Métricas | `maps/{TRACKING,FORMS,METRICS}.md` |
| 9 | Billing | `maps/BILLING.md` |
| 10 | Admin console | `maps/ADMIN_CONSOLE.md` |
| 11 | Storage / uploads | `maps/STORAGE_UPLOADS.md` |
| 12 | Integrações externas | `maps/EXTERNAL_INTEGRATIONS.md` |
| 13 | i18n & multi-região | `maps/I18N_MULTIREGION.md` |
| 14 | Consolidação | `docs/README.md` (reescrito), este relatório |

## Cobertura

- **20 mapas** em `docs/maps/`, cobrindo o front, edge functions, banco,
  integrações e plataforma.
- Cada mapa lista `code_refs` verificados no repositório na data acima e
  cross-links (`related_docs`) para docs especializadas.
- Diretórios especializados (`pipeline/`, `estudo/`, `i18n/`, `clinics/`,
  `agents/`) mantidos intactos e referenciados pelo `docs/README.md`.

## Invariantes catalogadas (top-level)

Cada mapa mantém sua própria seção "Invariantes (não quebrar sem ler)".
Recortes críticos que se repetem em vários mapas:

1. **RLS por tenant**: toda tabela em `public` filtra por `current_clinic_id()`.
2. **Grants explícitos**: `CREATE TABLE` sempre acompanhado de `GRANT` no mesmo
   commit — a Data API não concede default.
3. **Roles em tabela separada**: nunca em `profiles`; checar via
   `has_role(auth.uid(), ...)`.
4. **RegionConfig espelhado**: `src/lib/region.ts` e
   `supabase/functions/_shared/region.ts` editados no mesmo commit.
5. **Paridade de locales**: pt-BR/es-ES/en-US têm a mesma árvore de chaves.
6. **Webhook dedup**: todo webhook público passa por `webhook_dedup`.
7. **BYOK de IA**: agentes lêem chave por clínica em `clinic_secrets`; fallback
   para Lovable Gateway; Spend Guard bloqueia excesso.
8. **Storage privado por padrão**: buckets `chat-attachments`/`task-attachments`
   exigem primeiro segmento = `message_id`/`task_id` para autorizar.

## Dívidas técnicas conhecidas (agregadas)

Cada mapa lista as próprias; principais transversais:

- Roteamento por prefixo `/es` `/en` reservado mas não montado.
- Sync manual do `_shared/region.ts` sem teste de paridade.
- Falta de formatadores utilitários centralizados (`formatCurrency/Date`).
- Falta de quotas de storage por clínica e job de limpeza de órfãos.
- Templates transacionais legados ainda em pt-BR hardcoded.
- Meta Cloud API (F-META) pendente — hoje 100% Evolution.
- `docs-sync.mjs` (skill docs-maintainer) **não existe** no repo; auditoria
  segue manual via `_audit/PROGRESS.md`. Adotar depois.

## Como usar esta malha

1. Sessão nova → abrir `docs/README.md`.
2. Identificar feature/área → abrir o mapa correspondente em `docs/maps/`.
3. Ler seções "Invariantes" e "Dívidas técnicas" antes de mexer no código.
4. Ao mudar código, atualizar o mapa (rotas, edges, tabelas) e o campo
   `updated` do frontmatter.

## Métricas finais

- 20 mapas de feature + 5 docs de auditoria/índice atualizadas.
- 3 idiomas × ~1.3k chaves de tradução mapeados.
- 5 webhooks públicos catalogados.
- 4 buckets de storage documentados.
- 60+ edge functions cruzadas nos mapas.

Roadmap encerrado. Próximo passo natural: adotar o pipeline `docs-sync.mjs`
descrito na skill `docs-maintainer` para manter `INDEX.json` e detectar drift
automaticamente.
