
## Diagnóstico

**O que já existe hoje**

- `docs/agente_de_pipeline_da_clinica_or/` — 5 arquivos, já **sem menção à Febracis** (grep confirmou). Está tenant-puro.
- `docs/pipeline/MANUAL_CRIACAO_AGENTE.md` — manual genérico já criado, mas cita "Clínica OR vs Febracis" como exemplo inline, misturando conceito genérico com casos concretos.
- `docs/agents/FEBRACIS_*.md` (3 arquivos) — específicos da Febracis, sem paralelo para Clínica ÓR nesse diretório.
- `docs/agents/pipeline-classify/` e `docs/agents/pipeline-classify-febracis/` — diretórios paralelos (uma doc por edge function, formato diferente do `agente_de_pipeline_da_clinica_or/`).
- Código: `supabase/functions/pipeline-classify/febracis/` está **aninhado** dentro do classifier da ÓR — contradiz a decisão arquitetural do dev backend ("edge function isolada por tenant").

**Problemas de organização**

1. Não existe padrão claro de "uma pasta de docs por tenant". A ÓR está em `docs/agente_de_pipeline_da_clinica_or/`, a Febracis está espalhada entre `docs/agents/FEBRACIS_*`, `docs/febracis-pipeline.md`, `docs/febracis-pipeline-current-state.md`.
2. O manual dev mistura "regras universais" com exemplos concretos de tenants — dificulta manter quando surgir o 3º cliente.
3. As docs por edge function em `docs/agents/pipeline-classify*/` competem com as docs por tenant — não está claro qual é o source of truth.
4. Nada documenta o **contrato mínimo** que todo novo agente hardcoded precisa cumprir (assinaturas de I/O, gates obrigatórios, telemetria em `ai_usage`/`pipeline_run_items`, whitelist de tags em `app_settings`).

## Proposta de reorganização

### A. Docs por tenant — um diretório isolado por cliente

Padrão único: `docs/tenants/<slug-do-cliente>/`. Um arquivo `README.md` obrigatório + os 5 tópicos canônicos que a ÓR já tem.

```text
docs/
└── tenants/
    ├── README.md                       # índice de tenants + tabela (clinic_id, edge fn, status)
    ├── clinica-or/
    │   ├── README.md                   # ex-01-visao-geral.md
    │   ├── agentes-e-modelos.md
    │   ├── gatilhos-e-automacoes.md
    │   ├── tags-chips-e-campos.md
    │   ├── glossario-e-bugs.md
    │   └── fluxo.md                    # migra docs/estudo/clinica-or-fluxo-novo.md
    └── febracis/
        ├── README.md                   # migra docs/febracis-pipeline*.md
        ├── agentes-e-modelos.md        # micro-agentes O(1) + modelos
        ├── gatilhos-e-automacoes.md
        ├── tags-chips-e-campos.md      # whitelist ["aluno_antigo","reclamacao",...]
        └── glossario-e-bugs.md
```

**Ações concretas:**
- Mover `docs/agente_de_pipeline_da_clinica_or/*` → `docs/tenants/clinica-or/` (renomeando `01-…`→`README.md`, dropando prefixos numéricos).
- Consolidar `docs/agents/FEBRACIS_ATENDIMENTO.md`, `FEBRACIS_PRI.md`, `FEBRACIS_ROADMAP.md`, `docs/febracis-pipeline.md`, `docs/febracis-pipeline-current-state.md` → `docs/tenants/febracis/`. Um `README.md` faz o índice, o resto vira as 4 abas canônicas.
- Cada tenant recebe frontmatter obrigatório (`topic: pipeline`, `kind: feature`, `code_refs` apontando para a edge function específica do tenant).
- `docs/tenants/README.md` traz **uma tabela única**: slug, `clinic_id`, edge function, status (produção / rascunho), link para README de cada tenant.

### B. Manual dev — genérico, sem exemplos inline de clientes

Renomear e reescrever `docs/pipeline/MANUAL_CRIACAO_AGENTE.md` → `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md`, com estas seções:

1. **Regra de ouro** (hardcoded, observador silencioso, nada aparece no front) — igual ao atual, sem citar cliente.
2. **Padrão de repositório**
   - Cada tenant recebe `supabase/functions/pipeline-classify-<slug>/index.ts` (edge function isolada, **não** aninhada em outra).
   - Ação corretiva paralela: `supabase/functions/pipeline-classify/febracis/` deve migrar para `supabase/functions/pipeline-classify-febracis/` (esse diretório já existe no `docs/agents/`, mas o código não). Registrar como TODO na doc.
3. **Contrato mínimo** que toda edge function nova precisa cumprir:
   - Entrada: `{ action: "tick" | "lead", leadId?, clinicId }`.
   - Guardas obrigatórios antes de qualquer LLM call: `manual_lock_until`, gates G10/G11, `try_classify_lock` RPC.
   - Whitelist de tags lida de `app_settings.automation.<slug>.allowed_tags` (com fallback global).
   - Telemetria obrigatória: `ai_usage` (tokens) + `pipeline_run_items` (decisão) — sem isso o custo por tenant fica invisível.
   - Watermark de summarizer: `last_processed_message_id_classifier` (processar apenas mensagens novas para custo O(1)).
4. **Passo a passo** (checklist 12 itens):
   1. Definir stages no `pipeline_stages` do tenant.
   2. Definir whitelist de tags em `app_settings` (chave namespaced por slug).
   3. Criar `docs/tenants/<slug>/` com os 5 arquivos canônicos (linkar template).
   4. Criar `supabase/functions/pipeline-classify-<slug>/` copiando o esqueleto (`index.ts`, `agent.ts`, `apply.ts`).
   5. Implementar micro-agentes (Resumidor + Tipificador no mínimo).
   6. Mapear intents → nome de coluna via `getStageIdByName`.
   7. Escrever testes de `apply.ts` (mock do `pipelineMove`).
   8. Registrar edge function em `supabase/config.toml` com `verify_jwt = false`.
   9. Agendar cron via `supabase.insert` (não `migration`), padrão `* * * * *` chamando `action=tick`.
   10. Rodar `node scripts/docs-sync.mjs` para atualizar `docs/INDEX.json`.
   11. Validar telemetria em `/metrics/ai-usage` filtrando por `clinic_id`.
   12. Auditar por 48h antes de habilitar o cron em produção (rodar `action=tick` manual via `curl_edge_functions`).
5. **Anti-padrões** — lista curta: não aninhar tenant dentro do classifier de outro, não expor prompt na UI, não hardcodar `clinic_id` no `pipeline-move`, não pular whitelist de tags.
6. **Template de esqueleto** — apontar para uma pasta nova `supabase/functions/_templates/pipeline-classify-tenant/` (opcional, fase 2) com `index.ts`/`agent.ts`/`apply.ts` mínimos comentados.

### C. Ajustes cruzados

- Atualizar `docs/README.md` e `docs/agents/README.md` para apontar para `docs/tenants/` como source of truth por tenant.
- Marcar `docs/agents/pipeline-classify/` e `docs/agents/pipeline-classify-febracis/` como **docs por edge function** (perspectiva runtime), com nota de que a visão de negócio vive em `docs/tenants/<slug>/`.
- Rodar `node scripts/docs-sync.mjs` no final para regenerar `docs/INDEX.json`, `public/docs-index.json`, `public/docs-content.json` e `DRIFT.md`.

## O que NÃO faz parte deste plano

- Corrigir os 6 bugs do código `pipeline-classify-febracis` (já foi discutido antes, é trabalho separado).
- Executar a migração `app_settings.clinic_id` (também separado).
- Mover o código `supabase/functions/pipeline-classify/febracis/` → `pipeline-classify-febracis/`: fica **apenas registrado como TODO** na nova doc, não executado agora.
- Preencher o conteúdo real dos 4 arquivos novos da Febracis — o plano só cria a estrutura e migra o que já existe; o refinamento de conteúdo entra em plano posterior.

## Entregáveis desta fase

1. Nova árvore `docs/tenants/` com Clínica ÓR migrada (5 arquivos) e Febracis consolidada (README + 4 arquivos a partir do que já existe).
2. Manual dev reescrito em `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md`, genérico, com checklist de 12 passos e contrato mínimo.
3. `docs/tenants/README.md` com tabela-índice de tenants.
4. `docs/INDEX.json` regenerado.

Se aprovar, começo pela migração da ÓR (mais simples, sem consolidação) e depois consolido a Febracis.
