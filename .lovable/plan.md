## Objetivo

Gerar um novo `.zip` em que cada pasta de `docs/` vira **um único arquivo `.md` consolidado**, com divisões internas claras, para upload em um agente de IA que não aceita estrutura de pastas.

## Estrutura final do zip (`docs-consolidado.zip`)

Tudo flat, sem subpastas:

```
00-root.md                 (arquivos soltos de docs/: README, OVERVIEW, AI, EMAIL,
                            TRACKING, GLOSSARY, CHANGELOG, AUDIT_PHASE1)
architecture.md
conventions.md
database.md
edge-functions.md
features.md
flows.md
frontend.md
integracao.md              (inclui também integracao/exemplos/*)
integrations.md
known-issues.md
operations.md
roadmap.md
INDEX.md                   (sumário com links âncora para cada seção)
```

## Formato de cada arquivo consolidado

Cada `.md` de pasta segue o mesmo padrão:

```markdown
# <NOME_DA_PASTA>

> Consolidação dos arquivos de `docs/<pasta>/` em um único documento.
> Última atualização: 2026-05-30

## Sumário
- [ARQUIVO_1.md](#arquivo_1md)
- [ARQUIVO_2.md](#arquivo_2md)
...

---

## ARQUIVO_1.md
<conteúdo original do arquivo, sem alterações>

---

## ARQUIVO_2.md
<conteúdo original>
```

Regras:
- **Conteúdo preservado integralmente** (nenhuma edição de texto, só concatenação).
- Separador entre arquivos: `\n\n---\n\n## <nome-original.md>\n\n`.
- Subpastas (ex.: `integracao/exemplos/`) entram no mesmo arquivo do pai, com prefixo no título da seção (ex.: `## exemplos/foo.md`).
- Arquivos não-`.md` (se houver) são listados ao final em "Anexos não-markdown".

## INDEX.md

Sumário geral apontando para cada arquivo consolidado, com 1 linha de descrição por pasta, para o agente de IA usar como mapa.

## Detalhes técnicos

- Script Python rodado em `code--exec` que:
  1. Varre `docs/` e separa raiz × subpastas.
  2. Para cada pasta, lê os `.md` em ordem alfabética e concatena com cabeçalho/sumário.
  3. Escreve os consolidados em `/tmp/docs-consolidado/`.
  4. Gera `INDEX.md`.
  5. Empacota tudo em `/mnt/documents/docs-consolidado.zip` (flat, sem subpastas).
- Entrega via `<presentation-artifact>` para download.
- **Não altera** nada em `docs/` — só lê.

## Fora de escopo

- Reescrever/encurtar conteúdo.
- Converter para outros formatos (PDF, JSON).
- Mexer em código da aplicação.
