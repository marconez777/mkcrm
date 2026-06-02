# Limpeza inteligente do conteúdo importado

Hoje `ai-ingest-url` (e `ai-ingest-pdf`) só remove tags HTML e colapsa espaços — o resultado vira um "bolo" sem pontuação/seções (menus, breadcrumbs, CRM, RQE, etc. ficam grudados no conteúdo). Isso polui chunks e embeddings.

## Solução

Adicionar uma etapa de **normalização via Lovable AI** entre a extração bruta e o chunking.

### Backend

1. Novo helper em `supabase/functions/_shared/ai.ts`:
   - `cleanForKnowledge(rawText, { sourceUrl?, title? }): Promise<string>`
   - Usa Lovable AI Gateway (`google/gemini-3-flash-preview`, sem streaming) com prompt PT-BR pedindo:
     - remover menus, navegação, rodapés, CTAs ("Agendar Consulta"), dados de registro profissional repetidos, boilerplate;
     - preservar 100% do conteúdo informativo;
     - reescrever em parágrafos com títulos `##` e listas quando fizer sentido;
     - manter idioma original; não inventar fatos; não resumir.
   - Trunca entrada a ~30k chars para caber em uma chamada; se maior, processa em janelas e concatena.
   - Em caso de erro (402/429/timeout): faz fallback para o texto original e loga aviso (ingest não pode falhar por isso).

2. Integrar em:
   - `ai-ingest-url/index.ts` — após `htmlToText`, antes do insert em `ai_documents` e do `chunkText`.
   - `ai-ingest-pdf/index.ts` — após `extractText`.
   - `ai-ingest-document/index.ts` — NÃO aplicar (já é texto curado pelo usuário).
   - `ai-reingest-document/index.ts` — NÃO aplicar (usuário já editou).

3. Salvar o texto limpo tanto em `ai_documents.content` quanto como base para os chunks, e guardar o original em `metadata.raw_text` (truncado a 50k) para auditoria/reprocesso.

### Frontend

- Sem mudanças de UX. O modal "Editar documento" continua mostrando `content` — agora já vem formatado.
- Pequeno hint no card "Importar URL": "O conteúdo é limpo e formatado automaticamente por IA antes da indexação."

### Validação

1. Reimportar `https://clinicaohrpsiquiatria.com/tratamento/estimulacao-magnetica-transcraniana`.
2. Abrir "Editar documento" e confirmar texto em parágrafos/seções legíveis.
3. Conferir `chunks` ≥ 5 e teste rápido de pergunta no chat do agente.

### Não-objetivos

- Não trocar o pipeline de embeddings.
- Não alterar schema do banco.
- Não introduzir nova função edge (helper compartilhado é suficiente).