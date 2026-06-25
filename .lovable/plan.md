# Plano: criar `docs/Fluxo-atual.md`

Criar um único arquivo de documentação contendo o fluxo comercial/operacional do pipeline enviado, para servir como referência de análise posterior.

## Arquivo
- `docs/Fluxo-atual.md`

## Conteúdo
- Frontmatter padrão de docs (`title`, `topic: operations`, `kind: flow`, `audience: agent`, `updated`, `summary`, `code_refs` vazio/comentado, `related_docs` apontando para `docs/pipeline/runtime/FLOW_MATRIX.md` e `docs/skill-datas.md`).
- Corpo: as 14 seções enviadas (Entrada do lead → Objetivo principal), preservadas integralmente, apenas formatadas em Markdown (H2 por seção, sub-bullets onde já existem listas).

## Pós-criação
- Rodar `node scripts/docs-sync.mjs` para indexar o novo doc em `docs/INDEX.json`.
- Aguardar próximas instruções suas antes de qualquer mudança de código ou outras docs.

Sem alterações de código, rotas, banco ou edge functions nesta etapa.
