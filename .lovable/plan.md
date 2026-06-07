## Objetivo

Reduzir o tempo que eu (Lovable) gasto para localizar, editar e manter sincronizados os **146 arquivos `.md` (~20k linhas)** de `docs/`, e te dar uma tela no app para enxergar/abrir tudo isso.

Hoje os problemas são três e atacamos os três com a mesma base — um **índice único** que descreve cada doc.

---

## Arquitetura — 4 camadas

```text
   [ frontmatter nos .md ]   ← fonte da verdade (humano edita)
            │
            ▼
   [ scripts/docs-sync.mjs ] ← gera + valida + detecta drift
            │
            ├──► docs/INDEX.json          (consumido pelo agente + tela)
            ├──► docs/DRIFT.md            (relatório do que está desatualizado)
            └──► support-kb-manifest.ts   (já existe; integra ao mesmo runner)
            │
            ▼
   [ .agents/skills/docs-maintainer ]   ← me ensina o workflow
   [ /admin/docs (UI) ]                 ← você navega, busca, abre
```

---

## 1. Frontmatter padrão em todo `.md`

Adicionar no topo de cada arquivo de `docs/`:

```yaml
---
title: "Mapa: Email"
topic: email                    # email | ai | inbox | kanban | tracking | auth | admin | ...
kind: map                       # map | feature | flow | support | troubleshooting | reference
audience: agent                 # agent (interna) | user (suporte) | both
updated: 2026-06-07
code_refs:                      # arquivos/dirs que esta doc descreve
  - src/pages/email/
  - supabase/functions/send-email/
  - supabase/functions/_shared/email.ts
related_docs:
  - docs/features/EMAIL_CAMPAIGNS.md
  - docs/edge-functions/EMAIL.md
---
```

- Migração: script faz **best-effort** lendo H1, primeira linha "Última atualização" e heurísticas de path → preenche; eu reviso depois.
- Lint falha se `kind`/`topic` faltar ou se `code_refs` apontar para arquivo inexistente.

## 2. `docs/INDEX.json` (gerado)

Um arquivo único, ~50 KB, com tudo que preciso para achar e editar:

```json
[
  {
    "path": "docs/maps/EMAIL.md",
    "title": "Mapa: Email",
    "topic": "email",
    "kind": "map",
    "audience": "agent",
    "updated": "2026-06-07",
    "summary": "Localizar arquivos do subsistema de email…",
    "headings": ["Rotas", "Frontend", "Edge functions", "Banco", "Invariantes"],
    "code_refs": ["src/pages/email/", "supabase/functions/send-email/"],
    "size_lines": 142
  }
]
```

Eu leio **um arquivo** em vez de varrer `docs/` toda vez.

## 3. `scripts/docs-sync.mjs`

Comando único que faz tudo:

1. **Lint**: valida frontmatter de todo `.md` em `docs/`.
2. **Drift code → docs**: para cada `code_refs`, checa se o caminho existe. Se não, marca a doc como "stale".
3. **Drift docs → code**: varre rotas em `src/App.tsx`, edge functions em `supabase/functions/*`, tabelas em migrations recentes — lista o que **não tem doc** associada.
4. **Gera** `docs/INDEX.json` e `docs/DRIFT.md` (relatório legível).
5. **Reusa** o gerador existente `gen-support-kb-manifest.mjs` no mesmo passo.

Roda manual (`node scripts/docs-sync.mjs`) ou automático em pre-commit/CI (proposto, opcional).

## 4. Skill `docs-maintainer` (a peça que mais acelera você)

Diretório `.agents/skills/docs-maintainer/` com `SKILL.md` ensinando a próxima sessão minha a:

- Sempre começar lendo `docs/INDEX.json` em vez de listar `docs/`.
- Ao editar qualquer arquivo em `code_refs`, **abrir** as docs associadas e atualizar `updated:` + conteúdo.
- Ao adicionar rota/edge function/tabela nova, criar/atualizar o mapa correspondente em `docs/maps/`.
- Rodar `node scripts/docs-sync.mjs` ao final e revisar `DRIFT.md`.
- Templates prontos por `kind` (`map`, `feature`, `support page`) para não inventar estrutura.

Resultado: nas próximas vezes que você pedir "atualiza a doc disso", eu já sei o caminho exato e o formato sem precisar explorar.

## 5. Tela `/admin/docs` (consumo da infra)

Página simples, restrita a `super_admin`:

- Lista carregada de `docs/INDEX.json` (rápido — 1 fetch estático).
- **Sidebar** com filtros por `topic` e `kind`, busca por título/summary/heading.
- **Painel direito**: render do `.md` (react-markdown) + badge **"Drift"** quando aplicável + link "Abrir no editor" (deep link Lovable para o arquivo).
- Aba **Saúde**: contadores (total, por topic, com drift, docs sem `code_refs`, código sem doc) — basicamente `DRIFT.md` em formato visual.

Sem editor inline na v1 (manter escopo) — o botão leva você a editar pelo Lovable, e eu cuido das mudanças via chat.

---

## Entregáveis nesta tarefa

1. Script `scripts/docs-sync.mjs` + integração do `gen-support-kb-manifest.mjs`.
2. Frontmatter aplicado nos ~146 `.md` (migração automática + revisão).
3. `docs/INDEX.json` e `docs/DRIFT.md` versionados.
4. Skill `docs-maintainer` ativada via `skills--apply_draft`.
5. Rota `/admin/docs` com lista, busca, viewer e aba Saúde.
6. Update em `docs/conventions/COMMIT_PR.md` referenciando o novo workflow.

## Fora de escopo (v2, se quiser depois)

- Editor inline na tela (Monaco + commit via API).
- Geração automática do conteúdo dos mapas a partir do código (apenas detectamos drift, não reescrevemos).
- Tradução/multi-idioma da KB de suporte.
- Pre-commit hook obrigatório — proponho só rodar manual + na CI.

---

## Risco / pegadinhas

- **Frontmatter pode quebrar parsers existentes** (ex.: `support-kb` que copia `.md` cru pro agente). Vou checar `_shared/support-kb/*` antes de migrar e, se necessário, stripar frontmatter no `gen-support-kb-manifest.mjs`.
- **Migração inicial é grande** (146 arquivos): faço em commit separado, sem mudança de conteúdo, só frontmatter — fácil de revisar.
- **`code_refs` vai envelhecer**: por isso o `DRIFT.md` — sem ele, o índice mente igual.