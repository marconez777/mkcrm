# Fase 9 — Versionamento separado do Manual de Boas Práticas

Hoje o manual vive como **arquivo estático** em `supabase/functions/_shared/builder-knowledge/best-practices.md`, carregado em runtime pelo `buildBuilderSystemPrompt()` e concatenado ao prompt do Builder. Qualquer edição exige redeploy de edge function, não há histórico, não há quem/quando, e o usuário admin não consegue editar pela UI.

Objetivo desta fase: **tirar o manual do disco e colocar no banco com versionamento**, mantendo o arquivo `.md` apenas como seed inicial.

---

## 1. Schema (1 migration)

**`builder_manual_versions`** — uma linha por versão publicada (append-only)
- `id uuid pk`
- `version int` — auto-incrementa por trigger (`max(version)+1`)
- `content text not null` — markdown completo
- `summary text` — descrição curta da mudança (1 linha)
- `source text default 'manual' check in ('seed','manual','revert')`
- `published_at timestamptz default now()`
- `published_by uuid` (auth.users.id, nullable para seed)
- `is_active bool default false` — exatamente UMA linha ativa (partial unique index `where is_active`)
- `created_at timestamptz default now()`
- índice em `(version desc)`

GRANTs:
- `SELECT` para `authenticated` (qualquer usuário logado pode ler — Builder roda como service_role mesmo, mas a aba admin precisa listar).
- `INSERT/UPDATE` somente via RPC (não direto). `GRANT ALL ... TO service_role`.

RLS:
- `SELECT`: `authenticated` se `has_role(auth.uid(),'admin')` ou `has_role(auth.uid(),'super_admin')`. Demais users **não** veem (é conteúdo interno).
- `INSERT/UPDATE`: bloqueado para `authenticated`, liberado só para `service_role`.

**RPCs**
- `publish_builder_manual(_content text, _summary text) returns int` — security definer, só admin. Insere nova linha, marca como `is_active=true`, desativa as anteriores em transação. Retorna o novo `version`.
- `revert_builder_manual(_version int) returns int` — copia conteúdo da versão alvo para uma NOVA versão (`source='revert'`, summary "Revertido para vN") e ativa.
- `get_active_builder_manual() returns table(version int, content text, published_at timestamptz)` — usada pelo Builder.

**Seed**: na própria migration, fazer `INSERT` da versão 1 com o conteúdo atual do `.md` (lido e colado inline na SQL) marcada `source='seed'`, `is_active=true`.

---

## 2. Edge function — `buildBuilderSystemPrompt`

`supabase/functions/_shared/builder-system-prompt.ts`:
- Substituir `loadBestPractices()` (que lê do disco) por uma versão que consulta `get_active_builder_manual()` via Supabase service-role client.
- **Cache em memória por instância de edge function**: TTL 60s, chave única (manual é global). Evita 1 query Postgres por chamada do Builder.
- Invalidate via versão: cache guarda `{version, content, fetchedAt}`. Quando expira o TTL, refaz select. Se nova `publish` aconteceu, próxima leitura pega.
- Fallback: se a query falhar (cold start sem cache, DB indisponível), cai no `.md` do disco como rede de segurança. Logamos warning.
- Mantém a mesma assinatura `buildBuilderSystemPrompt(): Promise<string>` para não tocar em `ai-builder/index.ts`.

---

## 3. UI Admin — nova aba em `src/pages/Admin.tsx`

Aba **"Manual do Builder"** (visível só para admin/super_admin, mesmo gating das outras abas admin):

Componente novo `src/components/admin/BuilderManualPanel.tsx`:
- **Editor**: textarea grande monospace com o conteúdo da versão ativa carregado, campo `summary` curto, botão **Publicar nova versão**.
  - Validações: `content.length > 200`, `summary` obrigatório (3–120 chars).
  - Diff visual leve antes de publicar (linhas adicionadas/removidas, igual `PromptHistory`).
- **Histórico** (lista à direita): versões com `vN · source · autor · data · summary`. Ações por linha:
  - **Ver** (modal com `<pre>`).
  - **Restaurar** (chama `revert_builder_manual(v)`).
  - **Comparar com ativa** (diff simples linha-a-linha).
- Toast "Nova versão publicada — o Builder vai usar em até 60s" (sinaliza o TTL do cache).

Sem realtime — refresh manual na aba basta.

---

## 4. Limpeza

- O arquivo `.md` em `supabase/functions/_shared/builder-knowledge/best-practices.md` **permanece** como fallback e referência git (não é removido), mas para de ser a fonte canônica. Adicionamos no topo do arquivo um aviso:  
  `> ⚠️ A partir da Fase 9, a fonte canônica do manual é a tabela builder_manual_versions. Este arquivo é apenas fallback/seed.`

---

## 5. Pegadinhas / decisões

- **Concorrência de publish**: duas pubs simultâneas → o partial unique index `where is_active` garante que só uma fica ativa; a perdedora recebe erro. RPC trata em transação `for update`.
- **Tooltips do wizard** (`src/lib/builder-tooltips.ts`): hoje parsing estático do `.md`. Esta fase **não** altera isso — mudaria comportamento de UI sem o admin perceber. Documentamos como follow-up.
- **Sem export/import**: usuário copia/cola markdown.
- **Cache propagation**: cada instância da edge tem cache próprio (60s). Pico de 60s de inconsistência é aceitável para conteúdo de governance.

## Fora de escopo

- Branches / rascunhos paralelos do manual.
- Comentários por seção.
- Renderização markdown lado-a-lado (só textarea + diff simples).
- Migrar `builder-tooltips.ts` para consumir do banco (próxima fase).

## Entregáveis

- 1 migration: tabela + RPCs + GRANTs + RLS + seed da v1.
- Edit em `supabase/functions/_shared/builder-system-prompt.ts` (loader DB + cache + fallback).
- Novo `src/components/admin/BuilderManualPanel.tsx`.
- Nova aba em `src/pages/Admin.tsx`.
- Aviso no topo do `.md` atual.
