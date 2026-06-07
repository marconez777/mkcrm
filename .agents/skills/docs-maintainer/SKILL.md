---
name: docs-maintainer
description: Manter os 146+ arquivos de docs/ desta base sincronizados com o código. Use SEMPRE que o usuário pedir para criar, atualizar, revisar ou auditar documentação, ou quando você editar rotas de src/pages, edge functions em supabase/functions, ou tabelas — para também atualizar o(s) .md correspondentes.
---

# docs-maintainer

Documentação aqui é **infra** — o agente Lovable depende dela para localizar arquivos rapidamente em sessões futuras. Mantenha-a saudável seguindo este fluxo.

## 1. Ponto de entrada: `docs/INDEX.json`

**Antes de varrer `docs/`, leia `docs/INDEX.json`.** Ele tem `path`, `title`, `topic`, `kind`, `summary`, `headings`, `code_refs` e `related_docs` de todo `.md`. Filtrar/buscar nesse JSON é muito mais barato que `ls`/`rg` em 146 arquivos.

Exemplos de uso direto via `node -e`:

```bash
# achar o .md que documenta um tópico
node -e "const d=require('./docs/INDEX.json'); console.log(d.filter(x=>x.topic==='email').map(x=>x.path).join('\n'))"

# achar docs cujo code_refs cobre um arquivo
node -e "const d=require('./docs/INDEX.json'); console.log(d.filter(x=>x.code_refs.some(r=>'src/pages/Inbox.tsx'.startsWith(r))).map(x=>x.path).join('\n'))"
```

## 2. Frontmatter obrigatório

Todo `.md` em `docs/` começa com:

```yaml
---
title: "..."                    # H1 do documento, em PT-BR
topic: email                    # email|ai|inbox|kanban|tracking|auth|admin|billing|automations|integracao|support|operations|roadmap|conventions|architecture|database|known-issues|general
kind: map                       # map|feature|flow|support|journey|troubleshooting|reference|roadmap|doc
audience: agent                 # agent (interna) | user (suporte) | both
updated: 2026-06-07             # data ISO da última edição relevante
summary: "Uma frase descrevendo o que esta doc cobre."
code_refs:                      # OBRIGATÓRIO em maps/features/flows — arquivos/dirs que esta doc descreve
  - src/pages/email/
  - supabase/functions/send-email/
related_docs:                   # cross-links
  - docs/features/EMAIL_CAMPAIGNS.md
---
```

Regras:
- Sempre que você editar uma doc, atualize `updated` para a data de hoje.
- `code_refs` deve apontar para arquivo ou diretório (terminando em `/`) que realmente existe — o `docs-sync` falha se quebrar.
- Em docs novas de feature/map, sempre defina `code_refs` — é assim que o drift detector funciona.

## 3. Ao editar código, atualize a doc

Use esta tabela mental:

| Você mudou… | Atualize obrigatoriamente |
|---|---|
| rota nova em `src/App.tsx` ou `src/pages/<X>.tsx` nova | `docs/maps/<FEATURE>.md` (seção "Rotas") + `docs/frontend/PAGES.md` |
| edge function nova ou assinatura mudou | `docs/maps/<FEATURE>.md` (seção "Edge functions") + `docs/edge-functions/<FEATURE>.md` |
| tabela / RLS / migration relevante | `docs/maps/<FEATURE>.md` (seção "Banco") + `docs/database/SCHEMA.md` ou `RLS_POLICIES.md` |
| invariante quebrável ("não tocar sem ler") | adicionar/editar item na seção 7 do mapa correspondente |
| nova jornada do usuário | nova doc em `docs/support/journeys/` seguindo `docs/support/_templates/journey.md` |
| nova página com UI relevante p/ suporte | nova doc em `docs/support/pages/` seguindo `docs/support/_templates/page.md` |

Quando criar uma doc nova, use o template correspondente em `docs/support/_templates/` (para support) ou copie a estrutura de um mapa existente de tamanho parecido (para maps/features).

## 4. Finalização: rode o sync

Sempre depois de criar/editar docs **ou** depois de mudanças em código que afetem `code_refs`:

```bash
node scripts/docs-sync.mjs
```

Isso:
1. Preenche frontmatter faltante em docs novas.
2. Regenera `docs/INDEX.json`, `public/docs-index.json`, `public/docs-content.json`.
3. Regenera `docs/DRIFT.md` (revise!) — lista `code_refs` quebrados, rotas/edges sem doc.
4. Regenera `supabase/functions/_shared/support-kb-manifest.ts` (RAG do SupportPanel).

Modo CI: `node scripts/docs-sync.mjs --check` — só falha se houver `code_refs` quebrados.

## 5. Tela `/admin/docs` (consumo humano)

A tela em `src/pages/admin/AdminDocs.tsx` consome `public/docs-index.json` e `public/docs-content.json`. Não é necessário tocar nela ao editar docs — basta rodar `docs-sync` e o conteúdo aparece atualizado no próximo load.

## 6. Pegadinhas

- **Não** adicione frontmatter em `supabase/functions/_shared/support-kb/**` — esse diretório é separado e tem seu próprio gerador (`scripts/gen-support-kb-manifest.mjs`). `docs/support/` (que tem frontmatter) é o espelho legível.
- Linhas longas em `summary:` precisam estar entre aspas se contiverem `:` ou `#`. O gerador faz isso automaticamente.
- Se você adicionar uma chave nova ao frontmatter (ex: `owner`), ela é preservada pelo `docs-sync` — o script só preenche o que está ausente, nunca remove.
- DRIFT.md pode ter falsos positivos em "rotas sem doc" (rotas óbvias como `/onboarding` que vivem na doc de uma feature genérica). Use bom senso ao decidir o que documentar.
