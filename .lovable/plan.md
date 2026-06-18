# Plano — Documentação completa do pipeline "Clínica ÓR"

Objetivo: produzir um pacote de documentação **autossuficiente** (em `docs/pipeline/runtime/`) que descreva exatamente o que está **rodando hoje** — não o que estava planejado em v4.2. Outro agente deve conseguir auditar o sistema lendo só esses arquivos, sem abrir código nem banco.

A documentação atual em `docs/pipeline/` é de **planejamento** (decisões D1–D8, fases 0→4). Falta o espelho do **estado real**: o que de fato foi implementado, com quais prompts, em quais edge functions, escrevendo o quê na base.

## Entregáveis (todos em `docs/pipeline/runtime/`)

```text
docs/pipeline/runtime/
├── README.md                    # hub + status de cada componente (ativo/parcial/planejado)
├── ARCHITECTURE.md              # diagrama end-to-end, quem chama quem
├── STAGES_LIVE.md               # 11 colunas reais com IDs, ordem, flags
├── CLASSIFIER.md                # pipeline-classify: prompt, schema, validações
├── DETERMINISTIC_RULES.md       # pipeline-deterministic: 13 regras auto:*
├── AUDITORS.md                  # A1 position-auditor + A2 post-move-verifier
├── SUMMARIZER.md                # pipeline-summarize: trigger, prompt, campos
├── HUMAN_REACTOR.md             # reator de ação manual (D7) + lock manual 7d
├── FIELDS_LIVE.md               # custom_fields realmente existentes + enums
├── TAGS_LIVE.md                 # tags na whitelist + quem escreve cada
├── DATABASE_LIVE.md             # tabelas, colunas-chave, triggers ativos
├── EVENTS_TELEMETRY.md          # lead_events, pipeline_runs, lead_stage_history
├── GATES.md                     # G1–G11 com referência ao código que aplica
├── KNOWN_ISSUES.md              # bugs conhecidos (ex.: data 19/06 vs 18/06, 1ª consulta em paciente antigo)
└── AUDIT_CHECKLIST.md           # 30 perguntas que outro agente deve conseguir responder
```

## Fases

### Fase 1 — Inventário (read-only, gera relatório bruto)

Sem escrever doc ainda. Spawn de subagent `acp_subagent--explore` em paralelo para mapear:
- Todas as edge functions `pipeline-*` + `automations-tick` + `ai-auto-reply` (assinatura, triggers, secrets usados).
- Migrations recentes (`20260617*` e `20260618*`) — extrair tabelas/colunas/enums efetivamente criados.
- `app_settings` no banco: quais toggles `automation.*` existem e estão `enabled=true`.
- `lead_custom_fields` defs reais da clínica `cf038458-…`.
- `pipeline_stages` reais do pipeline `17c27f4d-…` (IDs, nomes, ordem, is_final, is_terminal).
- Tags efetivamente presentes em `leads.tags` (top 30 com contagem).

Saída: `/tmp/runtime-inventory.md` (rascunho para a fase 2 consumir).

### Fase 2 — Núcleo: arquitetura + stages + banco

Escreve `README.md`, `ARCHITECTURE.md`, `STAGES_LIVE.md`, `DATABASE_LIVE.md`, `EVENTS_TELEMETRY.md`. Inclui diagrama Mermaid do fluxo: mensagem WhatsApp → `evolution-webhook` → `pipeline-deterministic` → `pipeline-classify` → `pipeline-move` → `pipeline-post-move-verifier`. Cron diário → `pipeline-position-auditor`.

### Fase 3 — Componentes de IA (o que o usuário mais quer auditar)

Um arquivo por agente, cada um com a mesma estrutura: **Quando dispara · Inputs · Prompt (literal, copiado do código) · Schema de saída · Validações server-side · O que escreve no banco · Toggle/feature flag · Telemetria · Limitações conhecidas**.

- `CLASSIFIER.md` — inclui o `buildSystemPrompt` atual com `LeadContext`, `fmtBR`, `sanitizeDateField`, tools (`get_lead_history`).
- `AUDITORS.md` — A1 (cron) e A2 (hook async) lado a lado.
- `SUMMARIZER.md` — quando regenera `ai_summary`, quais campos lê.
- `HUMAN_REACTOR.md` — tabela de inferências (humano fez X → reator faz Y ou tag `precisa_atencao_humana`).

### Fase 4 — Regras determinísticas + campos + tags

- `DETERMINISTIC_RULES.md` — uma seção por regra `auto:*` (precondição SQL, ação, idempotência, evento gerado).
- `FIELDS_LIVE.md` — tabela de `lead_custom_fields` reais (chave, label, tipo, enum, writers, exemplos).
- `TAGS_LIVE.md` — whitelist real com quem escreve, quando, e exemplo.
- `GATES.md` — G1–G11 com link para o arquivo:linha que faz cumprir.

### Fase 5 — Auditoria e fechamento

- `KNOWN_ISSUES.md` — bugs reportados pelo usuário (data 19/06 vs 18/06, tag "1ª consulta" em paciente de 5 anos, lock manual sem botão até hoje) com status do fix.
- `AUDIT_CHECKLIST.md` — 30 perguntas (ex.: "Onde se valida que `consulta_agendada_em` não está no passado?", "Qual o threshold de confiança que dispara `precisa_atencao_humana`?") com link para a doc que responde.
- Atualizar `docs/pipeline/README.md` apontando para `runtime/` como fonte de verdade do **estado atual**, mantendo os outros docs como **planejamento histórico**.
- Atualizar `mem://docs/pipeline-v4-2` registrando que existe agora um espelho runtime.

## Detalhes técnicos

- **Frontmatter obrigatório** em todo `.md` (skill `docs-maintainer`): `title`, `topic: kanban`, `kind: reference|map|flow`, `audience: agent`, `updated: 2026-06-18`, `summary`, `code_refs`, `related_docs`.
- **Prompts copiados literalmente** dos arquivos `supabase/functions/*/index.ts` — não parafrasear. Se >80 linhas, colocar em bloco ```` ```ts ```` com cabeçalho indicando arquivo:linha.
- **Sem `scripts/docs-sync.mjs`** (não existe neste projeto, conforme memória). Sem regenerar `INDEX.json`.
- **Não tocar em código** — só leitura + escrita de docs.
- **Não inventar**: se um componente está no plano mas não no código, marcar `Status: planejado, não implementado` em vez de descrever como se rodasse.

## Estimativa

- Fase 1: 1 subagent explore + 3 read_query (5 min).
- Fases 2–4: ~10 arquivos `.md`, escritos em paralelo dentro de cada fase.
- Fase 5: 3 arquivos + atualização de 2 índices.

Total ~14 arquivos novos, zero código alterado.

## Pergunta antes de executar

A documentação deve ser **em PT-BR** (padrão do projeto) e focar no **estado real implementado**, mantendo os docs `v4.2` atuais como referência de planejamento. Confirma? Se sim, aprovo e parto da Fase 1.
