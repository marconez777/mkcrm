# Integração dos KBs de nicho no Builder

Os 12 arquivos do zip estão completos e seguem a spec (`clinic, dental, aesthetics, real_estate, restaurant, ecommerce, saas, law, education, agency, local_services, other`). Vou commitá-los no repo e fazer o Builder usá-los em runtime — **arquivos no edge function**, sem nova tabela.

## 1. Onde colocar os arquivos

Extrair os 12 `.md` para:

```text
supabase/functions/_shared/builder-knowledge/niches/
  clinic.md
  dental.md
  aesthetics.md
  real_estate.md
  restaurant.md
  ecommerce.md
  saas.md
  law.md
  education.md
  agency.md
  local_services.md
  other.md
```

Convive com o `best-practices.md` (manual genérico, fallback do DB). Os KBs de nicho **não** vão para `builder_manual_versions` — são estáticos, versionados via git.

## 2. Loader novo

Criar `supabase/functions/_shared/builder-knowledge/niche-loader.ts`:

- `loadNicheKb(slug: string): Promise<string>` — lê `./niches/<slug>.md` via `Deno.readTextFile(new URL(...))`.
- Cache em memória por instância (Map<slug, content>), sem TTL (conteúdo é estático).
- Fallback: se slug inválido ou arquivo ausente, retorna `""` (Builder segue com prompt sem KB de nicho — não quebra).
- Sanity: trunca para ~8 KB no caso bizarro de alguém colocar arquivo gigante.

## 3. Onde injetar no `ai-builder/index.ts`

Em cada action que já recebe `niche`, montar um bloco extra no system prompt antes do `chatCompletion`:

```text
--- Conhecimento do nicho: {NICHE_LABEL[slug]} ---
{conteúdo do .md}
---
```

Actions afetadas (todas que já têm `niche` no payload):

| Action | Por quê |
|---|---|
| `interview_plan` | Usa "Perguntas obrigatórias de qualificação" para sugerir as 3-5 perguntas |
| `generate_system_prompt` | Usa "Vocabulário", "Exemplo de abertura", "Armadilhas comuns" |
| `draft_knowledge_base` | Usa "Ofertas típicas", "Objeções + resposta-modelo", "Métricas" |
| `audit_kb` | Compara KB do cliente com "Sinais de lead quente/frio" e "Métricas" |
| `generate_scenarios` | Usa "Exemplo de qualificação" + "Objeções" para variar cenários |
| `copilot_chat` | Se o agente em edição tem nicho conhecido, anexa o KB ao contexto |

Actions **não** afetadas: `ping`, `suggest_kb_urls` (URLs externas), `run_evaluation` (avalia output, não gera), `generate_insights` (lê conversas reais).

## 4. Manter intacto

- `NICHE_LABEL` e `DOMINANT_OFFER_HINT` continuam — agora são complementares ao KB, não substituídos.
- `CORE_RULES`, `LEAD_CONTEXT_CLAUSE`, `MULTI_NICHE_CLAUSE` ficam como estão.
- `best-practices.md` (manual genérico do Builder) **não muda** — é outro nível (regras de como o Builder se comporta, não conhecimento do negócio do cliente).
- Sem migration, sem mudança de schema, sem mudança de UI.

## 5. Documentação a atualizar

- `docs/features/BUILDER_AGENTS.md` — nova seção "KBs de nicho": o que são, onde vivem, como são injetados, como adicionar um novo nicho (passos: criar `.md` → adicionar entry em `NICHE_LABEL` + `DOMINANT_OFFER_HINT` → deploy).
- `docs/maps/BUILDER_AGENTS.md` §3 (Compartilhado) e §4 — listar `niches/*.md` e o `niche-loader.ts`; §7 (invariantes) — adicionar "KBs de nicho são fonte de verdade do vocabulário/oferta por vertical; o `other.md` é genérico proposital, não popular com nicho específico".
- `docs/copilot.md` — menção curta de que o copilot herda KB de nicho do agente em edição.

## 6. Verificação

Após implementar:

1. `rg "loadNicheKb" supabase/functions/ai-builder/index.ts` — confirma uso em 6 actions.
2. Listar `supabase/functions/_shared/builder-knowledge/niches/` — 12 arquivos.
3. Teste manual: rodar `interview_plan` com `niche=saas` e conferir nos logs do edge function que o bloco "Conhecimento do nicho: SaaS / Software B2B" aparece no system prompt.

## Fora do escopo

- Editor de KB de nicho na UI (continua git-only).
- Versionamento em DB (não justifica — são estáticos).
- Tradução / outros idiomas.
- KB por sub-nicho (ex: "clinic > dermatologia") — se precisar no futuro, refina via DB.
