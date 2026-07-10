---
title: "Roadmap: Agentes de Pipeline por Tenant"
topic: kanban
kind: roadmap
audience: agent
updated: 2026-07-10
summary: "Backlog priorizado (P0→P3) para individualizar Agentes de Pipeline por tenant: registry no banco, cron centralizado com fan-out, esqueleto clonável com fila+backoff+lock, dry-run isolado, BYOK seguro e UI por tenant."
code_refs:
  - supabase/functions/pipeline-classify/
  - supabase/functions/_shared/
  - src/components/settings/AIPipelinesCard.tsx
  - src/components/settings/OpenAIKeyCard.tsx
related_docs:
  - docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md
  - docs/pipeline/runtime/CRON_JOBS.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/tenants/README.md
---

# Roadmap: Agentes de Pipeline por Tenant

Backlog vivo derivado do diagnóstico em `.lovable/plan.md`. Objetivo: **onboardar um tenant novo em 1 dia útil** com infra equivalente à Clínica ÓR (fila, backoff, lock, dry-run, rollback por flag).

Cada item vira um plano próprio quando executado. Este arquivo é o mapa de dependências e ordem — **não é o plano de execução**.

## Convenções

- **P0** — bloqueadores. Sem eles não dá para ligar o 2º tenant sem quebrar o 1º.
- **P1** — bloqueadores de UX/segurança para o cliente final.
- **P2** — endurecimento operacional (custo, testes, higiene).
- **P3** — cosmético / documentação.

Um gap é considerado **feito** quando: (a) código merged, (b) doc atualizada com `updated:` de hoje, (c) `node scripts/docs-sync.mjs` rodado, (d) DRIFT.md revisado.

---

## Fase P0 — Fundação (bloqueia 2º tenant)

### G3 — Tabela `pipeline_tenant_classifiers` ✅ 2026-07-10

Registry no banco, não em TypeScript, para que UI e dispatcher leiam a mesma verdade.

Colunas: `slug pk`, `clinic_id unique`, `edge_function_name`, `cron_enabled`, `byok_required`, `notes`, `created_at`, `updated_at`.

RLS: `authenticated` lê apenas a linha da própria clínica (via `clinic_members`); `service_role` escreve.

Seed inicial: `clinica-or` já cadastrada com `cron_enabled=false` (adoção retroativa — só ativa quando G5 substituir o cron legado).

**Esforço:** ½ dia. **Depende:** nada.

---

### G17 — Auditar `try_classify_lock` como RPC genérico ✅ 2026-07-10

Auditado: função é 100% genérica (`pg_try_advisory_xact_lock(hashtext('classify:'||_lead_id))`), sem nada tenant-específico. Pode ser reusado por qualquer edge de tenant sem alteração.

**Esforço:** ¼ dia. **Depende:** nada. **Bloqueia:** G5, G1.

---

### G5 — Cron centralizado + fan-out via `pg_net` ✅ 2026-07-10

Substitui a ideia ruim de "1 cron por tenant" (quebra `cron.max_running_jobs`).

- Cron único `pipeline-dispatcher-tick` (`* * * * *`, jobid **53**, `active=true`).
- Função PL/pgSQL `public.dispatch_pipeline_classifiers()` (SECURITY DEFINER, EXECUTE só para `service_role`) lê `pipeline_tenant_classifiers WHERE cron_enabled = true`.
- Para cada tenant, `net.http_post` para `<edge_function_name>` com body `{ "action":"tick", "source":"pipeline-dispatcher", "slug":"<slug>" }` e header `x-dispatch-slug`.
- Estado atual: **no-op** — ÓR está `cron_enabled=false` (adoção retroativa). Cron legado `pipeline-classify-tick` (jobid 38) continua ativo. A virada é: `UPDATE ptc SET cron_enabled=true WHERE slug='clinica-or'` + desligar jobid 38 — feito quando o primeiro tenant novo estiver validado.
- Pré-requisitos confirmados: `pg_net` e `pg_cron` habilitados.

**Pendências** (não bloqueiam encerrar o gap, viram P2/P3):
- Runbook em `docs/pipeline/runtime/CRON_JOBS.md` documentando o novo dispatcher + procedimento de virada.
- Monitor `net._http_response` (cron horário que alerta edges travadas).

**Esforço:** 1 dia. **Depende:** G3, G17. **Bloqueia:** produção do 2º tenant.

---

### G14 — Namespace `pipeline-classifier:<slug>` em `ai_review_reasons` ✅ 2026-07-10

Hoje `ai_review_reasons` usa a string global `'pipeline-classifier'`. Com 2+ tenants, dispatchers pisam um no outro drenando a mesma fila.

- **Estratégia dual-tag** (não breaking): trigger `tg_enqueue_classifier` agora enfileira com `'pipeline-classifier'` **+** `'pipeline-classifier:<slug>'` quando a clínica está no registry (G3). Legacy segue funcionando; template do G1 drena pelo namespace novo.
- Backfill dos leads em fila: 0 aplicados (nenhum lead em fila é da ÓR — ver bug operacional abaixo).
- **Remoção do legacy** vira uma tarefa da virada do G5, junto com o cutover do cron.

**Bug operacional descoberto** (registrar em `KNOWN_ISSUES.md`): a trigger enfileira **todo** lead inbound, mesmo de clínicas sem agente de pipeline. Snapshot atual: 516 leads em fila (Sanapta 306, FEBRACIS-PRI órfã 189, MK Espanha 11, MKart 9, MCD 1) — todos descartados a cada tick como `clinic_not_allowlisted`. Correção proposta (fora deste roadmap): filtrar no `tg_enqueue_classifier` por `EXISTS (SELECT 1 FROM pipeline_tenant_classifiers WHERE clinic_id = l.clinic_id AND cron_enabled=true)` ou similar. Custo hoje: 1 SELECT + descarte por lead × ticks/min — mensurável mas não crítico.

**Esforço:** ½ dia. **Depende:** G3. **Bloqueia:** 2º tenant em produção.

---

### G1 — Esqueleto `_template_pipeline_classify/` ✅ 2026-07-10

Deliverable central. Diretório clonável em `supabase/functions/_template_pipeline_classify/` (prefixo `_` faz o Supabase pular deploy):

```text
_template_pipeline_classify/
├── index.ts   # dispatcher: fila por slug, backoff 2/5/30, lock, dry_run
├── agent.ts   # esteira mínima (Tipificador com BYOK → fallback Lovable AI)
├── apply.ts   # INTENT_TO_STAGE + whitelist tags + pipelineMove
├── schema.ts  # Zod: intent, confidence, tags_suggested, reason_summary
└── README.md  # instruções de clonagem (constantes, seeds, deploy)
```

O template já entrega de graça:
- Drena `ai_review_reasons @> ['pipeline-classifier:<slug>']` (G14).
- Lock por lead via `try_classify_lock` (G17).
- Backoff escalonado 2/5/30 min por `ai_review_fail_count`.
- `isTransientAgentError` para distinguir retry vs drop.
- Suporte a `dry_run` (G9) com watermark isolado.
- Concorrência 5, ações `tick` e `lead` (smoke).

**Pendências que não bloqueiam encerrar o gap** (viram G2/G9/G16):
- `getTenantToggle`/`getTenantSettingJSON` referenciados mas ainda não existem — G2.
- Coluna `leads.last_processed_message_id_classifier_dry` referenciada mas ainda não existe — G9.
- Dispatcher v1/v2 por flag — G16 (adição, não bloqueia clonagem inicial).

**Ordem para ligar o primeiro tenant novo**: G2 → G9 → clonar template → validar em dry_run → flip `cron_enabled=true`.

**Esforço:** 1–1½ dia. **Depende:** G17, G14, G15. **Bloqueia:** todo tenant novo.

---

### G2 — Namespace `automation.<slug>.*` + helper ✅

- Chaves padronizadas em `app_settings`: `automation.<slug>.enabled`, `.allowed_tags`, `.model_override`, `.dry_run`, `.classifier_version`.
- Helpers publicados em `_shared/app-settings.ts`:
  - `getTenantSetting(client, slug, key)` → string bruta.
  - `getTenantToggle(client, slug, key, default?)` → boolean (mesma normalização do `getToggle` legacy).
  - `getTenantSettingJSON<T>(client, slug, key)` → objeto/array (para `allowed_tags`).
  - `getTenantSettingNumber(client, slug, key, default, max?)` → número com teto opcional.
- Todos delegam para os leitores existentes (`getSettingString`, `getSettingJSON`, `getToggle`, `getSettingNumber`), então mantêm o parser único e não conflitam com a namespace `automation.classifier.*` do V1.
- Snippet SQL para semear as chaves quando `INSERT` em `pipeline_tenant_classifiers` (idealmente via trigger — reuso no G10) fica como follow-up (bloqueio de onboarding, não do template).

**Esforço:** ½ dia. **Depende:** G3. **Bloqueia:** G1 (o template lê essas chaves).

---

### G9 — Dry-run com watermark isolado

Coluna nova `leads.last_processed_message_id_classifier_dry` (nullable). Payload `{ action: "tick", dry_run: true }` ou setting `automation.<slug>.dry_run = true`:

- Roda LLM + telemetria normalmente.
- Pula `pipelineMove` (grava skip com razão `dry_run`).
- Avança **apenas** o watermark dry — nunca o oficial.
- Marca `dry_run: true` no `pipeline_run_items.result` para não contaminar SLAs.

Quando o dry-run é desligado, o watermark oficial continua exatamente de onde estava.

**Esforço:** ½ dia. **Depende:** G1 (integrado no template). **Bloqueia:** onboarding seguro.

---

## Fase P1 — Endurecimento cliente-final

### G16 — Flag `classifier_version` por tenant

Padrão da ÓR (`automation.classifier.version = v1|v2`). Permite dark-launch de um prompt novo com rollback em segundos.

- Setting `automation.<slug>.classifier_version` lido pelo dispatcher do template.
- `agent.ts` exporta `handleV1`/`handleV2`; no dia 1 só há v1.

**Esforço:** ½ dia. **Depende:** G1, G2.

---

### G4 — Segurança da chave BYOK

Auditoria + migração:

1. RLS de `clinic_secrets`: confirmar que hoje só `service_role` lê/escreve; se não, criar policy explícita.
2. Criptografia em repouso: migrar `openai_api_key` para Supabase Vault ou `pgsodium.crypto_aead_det_encrypt`. Decisão na execução (Vault é mais alto nível; pgsodium dá mais controle).
3. Endpoint que o frontend consulta devolve **apenas** `{ has_key: boolean, last_verified_at, status }`. Valor nunca sai do servidor.
4. Botão "testar chave" (ping `/v1/models`) e "revogar" (DELETE da linha).

**Esforço:** 1–2 dias. **Depende:** nada. **Bloqueia:** G6 (a UI depende do endpoint `has_key`).

---

### G6 — `AIPipelinesCard` por tenant

- Ao abrir, consulta `pipeline_tenant_classifiers WHERE clinic_id = <atual>`.
- Sem linha → card não renderiza (clínica não tem agente próprio).
- Com linha, o card mostra: toggle liga/desliga, `OpenAIKeyCard` (respeitando G4), painel de status (última execução via `ai_usage`, taxa de skip 24h via `pipeline_run_items`, custo 30d, link para `/admin/pipeline-health?clinic=<id>`).
- **Nunca** mostra prompt, whitelist ou mapeamento intent→estágio.

**Esforço:** 1–2 dias. **Depende:** G3, G4.

---

## Fase P2 — Operação

### G10 — Auto-seed em `ai_spend_limits`

Trigger no `INSERT` em `pipeline_tenant_classifiers` que cria linha em `ai_spend_limits` com teto default (ex.: US$ 30/mês). Classifier faz skip suave (`spend_limit_exceeded`) ao estourar. Alerta em `email_operational_alerts`.

**Esforço:** ½ dia. **Depende:** G3.

---

### G8 — Template de teste unitário

Arquivo `apply.test.ts` dentro do template (G1) mockando `pipelineMove` e cobrindo cada `case` do switch de intents. Roda no vitest.

**Esforço:** ½ dia. **Depende:** G1.

---

### G15 — Extrair `_shared/http.ts`

Helper com `corsHeaders`, `withCors(handler)`, `jsonResponse(body, status)`. Template do G1 já usa. Evita drift de headers em cada edge nova.

**Esforço:** ¼ dia. **Depende:** nada.

---

## Fase P3 — Cosmético / documentação

### G7 — Badge "tenant slug" no admin

Colunas em `/admin/pipeline-health` e `/metrics/ai-usage` mostrando o slug do tenant (JOIN com `pipeline_tenant_classifiers`) em vez de só o UUID.

**Esforço:** ½ dia. **Depende:** G3.

---

### G11 — Documento de risco de escala

Nova seção em `docs/pipeline/runtime/ARCHITECTURE.md`:

- Bundle size das edges cresce linearmente com nº de tenants (compartilham `_shared/`). Não é bloqueador até ~15 tenants.
- Cold-start: mitigado pelo cron minuto-a-minuto do G5 mantendo edges quentes.
- Ponto de reavaliação: ~10 tenants ativos → considerar consolidar em uma edge única com carregamento dinâmico de módulo do tenant. Decisão futura, não agora.

**Esforço:** ¼ dia. **Depende:** nada.

---

## Perguntas em aberto

- **Vault vs pgsodium** (G4): decidir na execução, depois de auditar o que já está habilitado.
- **`pg_net` habilitado?** (G5): confirmar antes; se não, a 1ª migration da fase ativa a extensão.
- **BYOK vs Lovable Gateway** (billing): decisão de produto. Se o cliente não fornece chave, o custo cai no `LOVABLE_API_KEY` — repassar? absorver? Não bloqueia código.
- **Monitor de fan-out** (G5): `pg_net` dispara e esquece. Precisa de um cron horário que leia `net._http_response` para alertar edges travadas.

---

## Fora do escopo

- Recriar o classificador da Febracis (quando ela voltar, entra pelo template do G1).
- Alterar a ÓR imediatamente. Ela adota `pipeline_tenant_classifiers`, `pipeline-classifier:clinica-or` e `automation.clinica-or.*` de forma **retroativa** depois do template estar rodando em produção com pelo menos 1 tenant novo.
- Definir modelo LLM padrão do template (decisão no G1).
- Definir política de billing BYOK (produto).

---

## Bugs de documentação encontrados na revisão de hoje (2026-07-10)

Ao mapear este roadmap contra as docs vigentes, apareceram divergências que precisam ser corrigidas assim que o backlog rodar. Listadas aqui para não perder.

| Doc | Linha/Seção | Problema | Correção quando |
|---|---|---|---|
| `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md` | §3.2 item 1 | Manda hardcodar `TENANT_CLINIC_ID` como constante no topo do arquivo. Conflita com G3 (registry no banco). | Ao entregar G3 + G1 |
| `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md` | §3.2 | Não cita fila `needs_ai_review`, backoff `ai_review_fail_count`, `isTransientAgentError`, namespace `pipeline-classifier:<slug>`. | Ao entregar G1 |
| `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md` | §4 passo 10 | Manda "agendar cron por tenant via `supabase.insert`". Conflita com G5 (cron centralizado). | Ao entregar G5 |
| `docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md` | §4 passo 12 | Manda "rodar em dry comentando `pipelineMove`" — abordagem que corrompe watermark. Conflita com G9. | Ao entregar G9 |
| `docs/pipeline/runtime/CRON_JOBS.md` | Todo o doc | Documenta 7 crons legacy da ÓR mas não menciona o novo `pipeline-dispatcher-tick`. | Ao entregar G5 (adicionar seção) |
| `docs/tenants/README.md` | Linha 27 | Aponta para `.lovable/plan.md` (efêmero) como fonte do registry. Deveria apontar para este roadmap. | Agora — trocar por link para `docs/roadmap/PIPELINE_TENANT_ROADMAP.md` |
| `docs/pipeline/MANUAL_CRIACAO_AGENTE.md` | Todo | Stub de 20 linhas só apontando para o HOWTO. Se `docs-sync` confirma que nenhum link externo aponta pra cá, pode arquivar. | P3 — verificar em `DRIFT.md` |
| `docs/pipeline/runtime/KNOWN_ISSUES.md` | Item -10 (`stage_sequence_bindings`) | Reavaliação marcada para 2026-07-22 (12 dias). Fica no radar mas fora deste roadmap. | Independente |
| `docs/pipeline/runtime/KNOWN_ISSUES.md` | Item #6 (`notify_pipeline_deterministic` sem trigger) | "Wiring do trigger fica como pendência separada" — órfão desde 2026-06-23. Precisa dono ou arquivar como decisão. | Independente |
| `docs/pipeline/runtime/HELPERS.md` | 22 linhas | Doc raquítica. `_shared/` tem ~35 arquivos e vai crescer com G15. | P3 — expandir junto com G15 |

---

## Como aprovar

Aprovar este roadmap significa autorizar a execução em ordem: **P0 (G3 → G17 → G5 → G14 → G1 → G2 → G9) → P1 (G16 → G4 → G6) → P2 → P3**. Cada gap vira um plano próprio quando chegar sua vez.
