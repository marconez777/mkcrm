---
name: docs-maintainer
description: Manter os 130+ arquivos de docs/ desta base sincronizados com o código. Use SEMPRE que o usuário pedir para criar, atualizar, revisar ou auditar documentação, ou quando você editar rotas de src/pages, edge functions em supabase/functions, ou tabelas — para também atualizar o(s) .md correspondentes.
---

# docs-maintainer

Documentação aqui é **infra** — agentes dependem dela para localizar arquivos em
sessões futuras. Mantenha-a saudável seguindo este fluxo.

> ⚠️ **Esta skill foi reescrita em 11/08/2026.** A versão anterior descrevia uma
> infraestrutura que **não existe neste repositório**: `docs/INDEX.json`,
> `docs/DRIFT.md`, `docs/support/`, `public/docs-index.json`,
> `scripts/docs-sync.mjs`, `scripts/gen-support-kb-manifest.mjs` e
> `src/pages/admin/AdminDocs.tsx`. Nenhum deles existe — a maioria foi deletada em
> 18/06/2026. Se você encontrar instruções para usá-los em outro lugar, estão
> erradas. Decisão registrada em `docs/_audit/PLANO_DOCS.md` (Decisão 3).

---

## 0. Regra que precede todas as outras

> ## **NÃO EXISTE FLUXO PADRÃO ENTRE CLIENTES.**
>
> Cada cliente (tenant) terá um fluxo de pipeline **completamente** diferente.
> Toda doc que descreva fluxo, coluna, gatilho, campo ou chip **deve declarar
> `tenant:` no frontmatter**. Doc de fluxo sem tenant declarado é bug de
> documentação — o leitor vai assumir que vale para todos, e não vale.
>
> Hoje o único tenant com pipeline ativo é a **Clínica ÓR**
> (`cf038458-457d-4c1a-9ac4-c88c3c8353a1`). Isso **não** faz dela o padrão.
>
> Contexto: `docs/roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md`

---

## 1. Ordem de confiança

**banco → código → documentação.** Nunca o inverso.

A documentação desta base **contradiz a produção** em vários pontos. Uma auditoria
em 11/08/2026 refutou 3 conclusões que tinham sido derivadas de docs. Antes de
afirmar qualquer coisa sobre como o sistema se comporta, verifique no código ou no
banco.

Fontes de verdade já verificadas:

| Doc | Cobre |
|---|---|
| `docs/_audit/MAPA_CODIGO_PIPELINE.md` | Gatilhos, crons, movimentação, campos, chips, configuração |
| `docs/tenants/clinica-or/auditoria-11-08-2026.md` | Estado real do pipeline da ÓR |
| `docs/_audit/INVENTARIO_DOCS.md` | Censo de todos os `.md` |
| `docs/_audit/PLANO_DOCS.md` | Destino decidido para cada doc |

---

## 2. Como encontrar docs

Não existe índice gerado. Use busca direta:

```bash
# por tópico no frontmatter
grep -rl "^topic: kanban" docs/ --include=*.md

# docs cujo code_refs cobre um arquivo
grep -rl "src/pages/Inbox.tsx" docs/ --include=*.md

# docs de um tenant
grep -rl "^tenant: clinica-or" docs/ --include=*.md
```

---

## 3. Frontmatter obrigatório

```yaml
---
title: "..."                    # H1 do documento, em PT-BR
topic: kanban                   # email|ai|inbox|kanban|tracking|auth|admin|billing|automations|integracao|operations|roadmap|conventions|architecture|database|known-issues|general
kind: map                       # map|feature|flow|reference|troubleshooting|roadmap|audit|doc
audience: agent                 # agent | user | both
status: vigente                 # vigente | historico | planejado
updated: 2026-08-11             # data ISO da última edição relevante
summary: "Uma frase descrevendo o que esta doc cobre."
tenant: clinica-or              # OBRIGATÓRIO em qualquer doc de fluxo (ver §0)
clinic_id: cf038458-...         # junto com tenant
code_refs:                      # OBRIGATÓRIO em maps/features/flows
  - src/pages/Kanban.tsx
  - supabase/functions/pipeline-deterministic/
related_docs:
  - docs/tenants/clinica-or/auditoria-11-08-2026.md
---
```

### `status:` — o campo que evita decisão errada

| Valor | Significado |
|---|---|
| `vigente` | Descreve o sistema hoje; foi verificada |
| `historico` | Já foi verdade; **não** usar para decidir |
| `planejado` | Descreve intenção, não realidade |

Doc sem `status` é tratada como não confiável.

---

## 4. Ao editar código, atualize a doc

| Você mudou… | Atualize obrigatoriamente |
|---|---|
| rota nova em `src/App.tsx` ou `src/pages/<X>.tsx` | `docs/maps/<FEATURE>.md` + `docs/frontend/PAGES.md` |
| edge function nova ou assinatura mudou | `docs/maps/<FEATURE>.md` + `docs/edge-functions/INDEX.md` |
| migration relevante | `docs/database/MIGRATIONS.md` |
| **qualquer regra de fluxo de um tenant** | a doc daquele tenant em `docs/tenants/<slug>/` — **nunca** uma doc genérica |
| invariante quebrável | seção de invariantes do mapa correspondente |

---

## 5. Finalização: conferência manual

Não há validação automática. Confira à mão:

1. **`code_refs` existem?** Foi a ausência dessa checagem que deixou
   `supabase/functions/pipeline-inactivity-tick/` — que nunca existiu — citada em
   6 docs por quase dois meses.
2. **`updated:` é de hoje?**
3. **`status:` está definido?**
4. **Doc de fluxo declara `tenant:`?** (§0)
5. **Afirmação sobre produção cita a fonte e a data da verificação?** (§1)

Comando para o item 1:

```bash
grep -rhn "^  - \(src\|supabase\|scripts\)/" docs/ --include=*.md | sed 's/.*- //' | sort -u | while read p; do [ -e "$p" ] || echo "QUEBRADO: $p"; done
```

---

## 6. Pegadinhas

- Linhas de `summary:` com `:` ou `#` precisam estar entre aspas. **Ninguém faz isso
  por você** — não há gerador.
- Nomes de coluna de pipeline mudam na UI sem aviso. Doc que cita nome de coluna
  envelhece rápido; prefira o **nome canônico** (`stage_canonical_aliases`) e diga
  que é canônico. Dois defeitos de produção vieram de comparação por nome real.
- Ao marcar uma doc como `historico`, **diga o que nela é falso**. Um aviso genérico
  não impede ninguém de usar o conteúdo errado.
