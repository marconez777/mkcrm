## Objetivo

Hoje, na seção **Documentos** do agente (`/ai/agents`), só é possível ver o título e excluir. Vou adicionar a capacidade de **abrir um documento e editar seu conteúdo** (título + texto), salvando de volta em `ai_documents`.

## Mudanças

### 1. `src/pages/Agents.tsx` — seção "Documentos"

- Cada linha da lista ganha um botão **"Abrir"** (ícone de lápis/olho) ao lado do botão de excluir.
- Ao clicar, abre um `Dialog` com:
  - Campo **Título** (`Input`)
  - Campo **Conteúdo** (`Textarea` grande, ~60vh, monospace para legibilidade)
  - Badge indicando se é documento `padrão` do sistema (apenas informativo — pode editar mesmo assim, igual ao excluir).
  - Botões **Cancelar** e **Salvar alterações**.
- Ao salvar:
  - `UPDATE ai_documents SET title, content WHERE id`.
  - Mostra aviso curto: *"Conteúdo atualizado. Re-indexe para refletir nas buscas."* + botão **Re-indexar agora** que chama a edge function `ai-ingest-document` (ou um fluxo equivalente) para regerar os chunks/embeddings desse doc.
  - Recarrega a lista.

### 2. Re-indexação dos chunks (opcional mas recomendado)

Quando o conteúdo muda, os `ai_chunks` antigos ficam desatualizados. Duas opções:

- **A (simples, recomendado):** ao salvar, deletar `ai_chunks WHERE document_id = X` e chamar uma função que re-gera embeddings do novo conteúdo. Posso reutilizar a lógica de `ai-ingest-document` extraindo `ingestChunks` ou criando uma nova função `ai-reingest-document` que recebe `document_id`.
- **B (mínimo):** só atualizar `title`/`content` e deixar um botão manual "Re-indexar" para o usuário disparar.

Sugiro **A automático** — usuário não precisa lembrar.

### 3. Carregamento do conteúdo

A query atual de `docs` não traz `content` (só `title, source, source_type, created_at, metadata`). Ao abrir o dialog, faço um fetch pontual `select content` por id (evita carregar conteúdo grande de todos os docs na lista).

## Fora de escopo

- Editor rico (markdown/WYSIWYG) — fica `Textarea` simples por enquanto.
- Histórico de versões do documento (diferente do manual do Builder, que tem versionamento próprio).
- Edição de `metadata` (nicho, source) — só título + conteúdo.

## Arquivos afetados

- `src/pages/Agents.tsx` (UI do dialog + handlers)
- `supabase/functions/ai-reingest-document/index.ts` (nova edge function, se formos pela opção A)
- `docs/features/BUILDER_AGENTS.md` (nota curta sobre editar docs)
