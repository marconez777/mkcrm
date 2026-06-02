# Fix — Erro em todas as importações da Base de Conhecimento

## Causa-raiz (confirmada nos logs)

`ai-ingest-pdf` retornou:
```
code: "23502"
message: 'null value in column "clinic_id" of relation "ai_documents" violates not-null constraint'
```

As funções de ingestão inserem em `ai_documents` apenas `{ agent_id, title, content, source, metadata }` — sem `clinic_id`. Uma migration recente tornou `ai_documents.clinic_id` NOT NULL, então todo insert quebra com 500, e o frontend mostra o genérico "Edge Function returned a non-2xx status code".

Afeta: **Importar URL, Importar PDF, Texto manual, Importar lote de URLs, Reingest de documento**.

## Correção

Em cada função, ao carregar o agente já trazer `clinic_id` e propagar para o insert de `ai_documents`.

Arquivos a editar:
1. `supabase/functions/ai-ingest-document/index.ts` — adicionar lookup do `clinic_id` do agente e incluir no insert.
2. `supabase/functions/ai-ingest-url/index.ts` — incluir `clinic_id: agent.clinic_id` no insert.
3. `supabase/functions/ai-ingest-pdf/index.ts` — idem.
4. `supabase/functions/ai-reingest-document/index.ts` — não insere doc novo, mas vale conferir se `update` precisa do campo (provavelmente não).
5. `supabase/functions/ai-ingest-urls/index.ts` — conferir e, se inserir docs direto, aplicar o mesmo fix; caso contrário só delega para `ai-ingest-url`.

Validação obrigatória: rejeitar com 400 se `agent.clinic_id` for null (evita 500 silencioso futuro).

## UX (bônus pequeno)

Melhorar a mensagem de erro no `KbAssistant.tsx` e nos botões de import: ler `data.error` quando vier, em vez de só `error.message` do supabase-js. Mesmo padrão já aplicado no `CopilotPanel`.

## Validação

1. Após editar, deploy automático das 4 funções.
2. Reproduzir: importar a URL `https://clinicaohrpsiquiatria.com/...` e o PDF do print → ambos devem retornar `{ok:true, document_id, chunks}`.
3. Conferir nos logs que não aparece mais `23502`.

## Não-objetivos

- Não vou alterar a migration nem tornar `clinic_id` nullable (a constraint é correta para multi-tenancy).
- Sem mudanças de UI além do refinamento da mensagem de erro.