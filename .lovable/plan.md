# Fix — `ai_chunks.clinic_id` NOT NULL nas funções de ingest

## Causa-raiz (logs)

```
code: 23502
message: 'null value in column "clinic_id" of relation "ai_chunks" violates not-null constraint'
```

Resolvi `ai_documents.clinic_id` antes, mas o mesmo NOT NULL existe em **`ai_chunks`** e nenhuma das funções de ingest seta o campo no insert dos chunks.

## Correção

Em cada função, propagar `clinic_id` (já carregado do agente) também para os objetos do array `rows` antes do `insert("ai_chunks")`.

Arquivos a editar:
1. `supabase/functions/ai-ingest-url/index.ts` — adicionar `clinic_id: agent.clinic_id` em cada row.
2. `supabase/functions/ai-ingest-pdf/index.ts` — idem.
3. `supabase/functions/ai-ingest-document/index.ts` — `ingestChunks` precisa receber/usar o `clinic_id`. Refator: passar `clinic_id` como parâmetro adicional (chamada interna já tem o valor após o lookup do agente).
4. `supabase/functions/ai-reingest-document/index.ts` — idem; já carrega o agente, basta usar `agent.clinic_id` nos rows.

## Validação

1. Reimportar a URL `https://clinicaohrpsiquiatria.com/tratamento/estimulacao-magnetica-transcraniana` — deve retornar `{ok:true, chunks:N}`.
2. Conferir nos logs que não aparece mais 23502 em `ai_chunks`.
3. Testar também PDF, texto manual e reingest.

## Não-objetivos
- Não alterar a constraint (multi-tenant correto).
- Sem mudanças de UI.