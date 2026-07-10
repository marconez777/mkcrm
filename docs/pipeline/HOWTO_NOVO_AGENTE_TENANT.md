---
title: "How-to: criar um Agente de Pipeline hardcoded para uma nova conta"
topic: kanban
kind: reference
audience: agent
updated: 2026-07-10
summary: "Manual dev genérico para o time Chat Funnel AI construir e deployar um Agente de Pipeline exclusivo e hardcoded para uma nova conta (tenant), sem exposição na UI."
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/app-settings.ts
  - supabase/functions/_shared/metrics.ts
related_docs:
  - docs/tenants/README.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/CRON_JOBS.md
---

# How-to: criar um Agente de Pipeline hardcoded para uma nova conta

**Audiência:** apenas o time de desenvolvimento da Chat Funnel AI. Este manual é o passo a passo padrão para ligar um Agente de Pipeline exclusivo para um novo cliente. **Nada** aqui é exposto na UI do CRM — todo o comportamento (prompt, regras, whitelist de tags, movimentações) fica hardcoded no repositório.

## 1. Regra de ouro

1. **Observador silencioso.** O Agente de Pipeline **nunca** responde ao lead. Ele só lê a conversa (secretária ou Agente de Atendimento) e move o card no Kanban.
2. **Treinamento hardcoded.** System prompts, esquemas Zod, whitelist de tags e mapeamento de intents → estágio vivem apenas no código-fonte. O cliente não vê nem edita.
3. **UI mínima.** O que o cliente pode fazer em `Configurações → IA do Pipeline` é apenas: ligar/desligar a automação e fornecer sua própria chave BYOK (opcional). Nada além disso.
4. **Rule engine primeiro, LLM depois.** Se um `if/else`, um webhook ou um cron determinístico resolve, a IA fica de fora. LLM é para detectar intenção textual e extrair parâmetros.

## 2. Padrão de repositório

Cada tenant recebe uma edge function **isolada** — nunca aninhe o classifier de um tenant dentro do classifier de outro.

```text
supabase/functions/
├── pipeline-classify/                 # tenant Clínica ÓR (V6 — 5 agentes)
├── pipeline-classify-febracis/        # tenant Febracis (2 micro-agentes O(1))
└── pipeline-classify-<slug>/          # cada novo tenant vai aqui
    ├── index.ts                       # dispatcher: tick/lead, lock, watermark
    ├── agent.ts                       # micro-agentes (Resumidor, Tipificador, ...)
    └── apply.ts                       # move card + tags + telemetria
```

> **Dívida técnica registrada:** `supabase/functions/pipeline-classify/febracis/` ainda está aninhado dentro do classifier da ÓR e deve migrar para `supabase/functions/pipeline-classify-febracis/`. Isso é TODO em aberto — não repita esse padrão em tenants novos.

Utilitários compartilhados vão em `supabase/functions/_shared/` (`pipeline-move.ts`, `app-settings.ts`, `metrics.ts`, etc.). Nunca duplique lógica de `pipelineMove` ou de escrita de telemetria.

## 3. Contrato mínimo de uma edge function de tenant

Toda `pipeline-classify-<slug>/index.ts` **deve** cumprir:

### 3.1 Entrada

```ts
type Payload =
  | { action: "tick" }                              // rodada agendada — processa fila
  | { action: "lead"; leadId: string; clinicId: string }; // rodada pontual (webhook)
```

Rejeitar qualquer outro shape com `400`.

### 3.2 Guardas obrigatórias (antes de qualquer chamada LLM)

1. **Filtro por tenant:** validar `lead.clinic_id === TENANT_CLINIC_ID` (constante hardcoded no topo do arquivo). Se não bater, `skip` com razão `wrong_tenant`.
2. **Lock de reentrada:** chamar RPC `try_classify_lock(lead_id)`. Se retornar `false`, `skip` com razão `locked`.
3. **Manual lock:** se `lead.manual_lock_until > now()`, `skip` com razão `human_locked`.
4. **Gate G10:** ao emitir `custom_fields_patch`, remover chaves editadas pela secretária nos últimos 7 dias (`custom_fields_last_human_edit`).
5. **Gate G11:** IA **não** pode preencher datas de consulta/procedimento — remover essas chaves do patch antes de aplicar.
6. **Whitelist de tags:** filtrar `tags_suggested` contra `app_settings.automation.<slug>.allowed_tags`. Toda tag fora da whitelist é descartada silenciosamente.

### 3.3 Custo O(1) — Rolling Summary

- Manter `last_processed_message_id_classifier` no `leads`.
- Cada tick lê `ai_summary` antigo + apenas mensagens novas depois do watermark.
- Nunca reenvie o histórico inteiro para o LLM. O input do Resumidor precisa ser constante independentemente do tamanho do lead.

### 3.4 Telemetria obrigatória

Toda execução grava **duas fontes**, sem exceção:

- `ai_usage`: uma linha por chamada de modelo (`kind = "classifier:<slug>_<agent>"`, tokens, latência, modelo).
- `pipeline_run_items`: uma linha por lead processado, com `clinic_id`, `pipeline_id`, `run_type = "classifier"`, `status = "completed" | "skipped" | "failed"`, `result` (JSON com intent, action_taken, tags aplicadas).

Sem essas duas fontes o custo do tenant fica invisível no painel `/metrics/ai-usage` e no `/admin/pipeline-health`.

### 3.5 Movimento de card

Sempre via `pipelineMove()` de `_shared/pipeline-move.ts` (nunca `UPDATE` direto). Passar:

```ts
await pipelineMove(client, {
  leadId,
  toStageId,
  source: `auto:classifier-<slug>`,
  reason: `IA detectou intenção: ${intent}`,
  idempotencyKey: `<slug>:${leadId}:${lastMessageId}`,
});
```

## 4. Passo a passo (checklist)

- [ ] **1. Mapear regras de negócio.** Desenhar Kanban do cliente. Separar gatilho sistêmico (Stripe, cron, agendamento) vs. gatilho de IA (intenção). Registrar em `docs/tenants/<slug>/README.md`.
- [ ] **2. Estágios no banco.** Inserir/renomear em `pipeline_stages` para o `pipeline_id` do tenant. Confirmar que os nomes usados no código (`getStageIdByName`) batem exatamente com o `name` da linha.
- [ ] **3. Whitelist de tags.** Registrar `app_settings.automation.<slug>.allowed_tags` (JSON array). Se o `app_settings` já foi migrado para ter `clinic_id`, gravar por tenant; senão, namespaced pelo slug.
- [ ] **4. Diretório de docs.** Criar `docs/tenants/<slug>/` com os 5 arquivos canônicos (ver template em [`docs/tenants/README.md`](../tenants/README.md)). Preencher frontmatter com `tenant`, `clinic_id` e `code_refs`.
- [ ] **5. Edge function.** Criar `supabase/functions/pipeline-classify-<slug>/{index.ts,agent.ts,apply.ts}`. Copiar esqueleto de um tenant existente (Febracis é o mais enxuto).
- [ ] **6. Micro-agentes.** Mínimo: **Resumidor Incremental** + **Tipificador de Intenção**. Modelos baratos por padrão (`google/gemini-2.5-flash-lite` ou `openai/gpt-5-nano`). Só adicione Maestro se a complexidade justificar (caso ÓR).
- [ ] **7. Mapeamento intent → estágio.** Em `apply.ts`, `switch(intent)` que resolve o nome da coluna via `getStageIdByName(client, pipelineId, name)`.
- [ ] **8. Testes.** Escrever unit test para `apply.ts` mockando `pipelineMove` — cobrir cada intent e o caso "sem movimento".
- [ ] **9. Config.** Registrar em `supabase/config.toml` com `verify_jwt = false` (padrão do projeto) e validar JWT/tenant dentro da função.
- [ ] **10. Cron.** Agendar via `supabase.insert` (não `migration`) chamando `action=tick` no intervalo desejado (`* * * * *` em produção). Ver [`docs/pipeline/runtime/CRON_JOBS.md`](./runtime/CRON_JOBS.md).
- [ ] **11. Docs-sync.** Rodar `node scripts/docs-sync.mjs` para regenerar `docs/INDEX.json`, `public/docs-index.json`, `public/docs-content.json` e `DRIFT.md`.
- [ ] **12. Auditoria antes de ligar.** Rodar `action=tick` manualmente via `curl_edge_functions` por 24–48h em modo "dry" (comentar `pipelineMove`) e revisar `pipeline_run_items` + `ai_usage` filtrados por `clinic_id`. Só depois ativar o cron em produção.

## 5. Anti-padrões (não faça)

- ❌ Aninhar o classifier de um tenant dentro do classifier de outro (`pipeline-classify/<slug>/`).
- ❌ Expor prompt, whitelist ou regras na UI (`AIPipelinesCard` só liga/desliga automação — nunca edita conteúdo).
- ❌ Passar histórico completo do lead para o LLM em cada tick (custo O(n)).
- ❌ Pular a whitelist de tags — sem ela a IA polui o array `leads.tags` com invenções.
- ❌ Chamar `UPDATE pipeline_stages` direto — sempre `pipelineMove()`.
- ❌ Gravar telemetria só em `ai_usage` **ou** só em `pipeline_run_items`. Precisa ser nos dois.
- ❌ Hardcodar `clinic_id` do tenant em `_shared/*` — a constante vive **dentro** de `pipeline-classify-<slug>/`.

## 6. Referências

- Arquitetura V6 (referência de complexidade máxima): [`docs/tenants/clinica-or/agentes-e-modelos.md`](../tenants/clinica-or/agentes-e-modelos.md)
- Arquitetura enxuta O(1) (referência de custo mínimo): [`docs/tenants/febracis/README.md`](../tenants/febracis/README.md) §4
- Gates 1–11: [`docs/pipeline/runtime/GATES.md`](./runtime/GATES.md)
- Classifier runtime: [`docs/pipeline/runtime/CLASSIFIER.md`](./runtime/CLASSIFIER.md)
- Cron jobs: [`docs/pipeline/runtime/CRON_JOBS.md`](./runtime/CRON_JOBS.md)
