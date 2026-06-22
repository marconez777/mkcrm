---
title: "Plano de correções de qualidade dos agentes"
topic: kanban
kind: troubleshooting
audience: agent
updated: 2026-06-22
summary: "Plano consolidado (Parte 1 + Parte 2 + Parte 3) das correções identificadas após auditoria cruzada de ai_usage, lead_events.applied, code refs e documentação do pipeline V6. Ordenado por ROI."
code_refs:
  - supabase/functions/_shared/clinic-openai.ts
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-classify/agent-core.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/functions/pipeline-post-move-verifier/index.ts
  - supabase/functions/_shared/pipeline-move.ts
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/pipeline/runtime/TAGS_LIVE.md
  - docs/pipeline/runtime/TRIGGERS_AUDIT.md
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/AUDITORS.md
---

# Plano de correções dos agentes do pipeline V6

> Snapshot: 2026-06-22. Janela de evidência: `ai_usage` 48h + `lead_events` 24h + edge logs + read direto do código + docs `pipeline/runtime/*`.

## Sumário executivo

| # | Severidade | Item | Fase | Evidência |
|---|---|---|---|---|
| **P0** | 🔴 crit | AI SDK sem structured outputs (`@ai-sdk/openai-compatible`) | A | 12 erros `No object generated` em 48h, todos agentes |
| **P7** | 🔴 crit | Whitelist hardcoded descarta 99% das tags sugeridas | A | 278 tags descartadas / 6 aplicadas em 24h |
| **P8** | 🟠 alta | Fila travada + backoff de erro 10 min | B | 7 leads parados >10 min agora |
| **P9** | 🟠 alta | `tickQueueV2` SELECT sem filtro allowlist | B | Risco de regressão do KNOWN_ISSUES §0 |
| **P2** | 🟠 alta | Maestro sem regras de resolução de conflito | C | code review (`agent-core.ts`) |
| **P10** | 🟠 média | `apply_lead_automation_patch` aborta tags se enum inválido | C | trigger `trg_validate_lead_custom_fields_enums` |
| **P12** | 🟠 média | Tipificador roda mesmo quando G10 vai bloquear tudo | C | desperdício de tokens em leads "frios" |
| **P3** | 🟡 robust | `withSchemaRetry` mascara 429 como schema | D |  |
| **P4** | 🟡 robust | Resumidor sem cap de contexto | D | |
| **P5** | 🟡 oper | post-move-verifier roda em moves não-B2B | D | |
| **P6** | 🟡 oper | Telemetria de outcome do Maestro pobre | D | |
| **P13** | 🟡 oper | Dispatcher `pipeline-run-executor` ignora `parallel`/`agendador`/`movimentador` | D | `KNOWN_ISSUES.md §-3` (aberto) |
| **P11** | 🟢 doc | `USER_AUTOMATIONS.md` ausente | E | `TRIGGERS_AUDIT.md §G5` |
| **P14** | 🟢 doc | `TAGS_LIVE.md` desatualizado vs whitelist real | E | doc lista 21 tags, código tem 14 |

---

## P0 — AI SDK sem structured outputs (CRÍTICO de raiz)

**Local:** `supabase/functions/_shared/clinic-openai.ts` usa `createOpenAICompatible` do `@ai-sdk/openai-compatible`.

**Problema:** o provider compatível não suporta `response_format: json_schema` (structured outputs nativos da OpenAI). Quando o AI SDK recebe `Output.object({ schema })`, faz fallback para `response_format: json_object` ("retorne qualquer JSON") e valida client-side. Se o modelo gera JSON sintaticamente válido mas que não casa com o Zod → `AI_NoObjectGeneratedError: No object generated: response did not match schema`.

**Evidência (`ai_usage`, 24h):**

| Operation | Count |
|---|---|
| `classifier:typifier` | 8 |
| `classifier:agendador` | 1 |
| `classifier:maestro` | 1 |
| `classifier:movimentador` | 1 |

Todos com a mesma mensagem. Não é prompt — é o transport.

**Fix:** trocar import em `_shared/clinic-openai.ts`:

```ts
// antes
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@^1";

// depois
import { createOpenAI } from "npm:@ai-sdk/openai@^2";
```

A interface (`provider("model-name")`) é idêntica nos call-sites. Activa structured outputs e elimina o ramo de fallback.

**Conforme `<ai-sdk-agent-patterns>`:** preferir `Output.object` com schema pequeno e enum estável (já temos). Como alternativa de médio prazo, avaliar Lovable AI Gateway (`google/gemini-2.5-flash`) — fora de escopo desta fase.

---

## P7 — Whitelist hardcoded descarta 99% das sugestões (CRÍTICO de impacto)

**Local:** `pipeline-classify/apply.ts` + `agent-core.ts` (constante `tags_suggested`).

**Evidência (24h, `lead_events.payload.applied.tags`):**

```text
runs do classifier: 94
runs com tag aplicada (added > 0): 6  (6.4%)
total de tags descartadas por whitelist: 278
```

**Amostra real (lead de hoje):**

```json
"tags": {
  "added": [],
  "dropped_by_whitelist": [
    "receita_disponivel",
    "aguardando_retirada",
    "retirada_nao_confirmada",
    "interesse_tratamento",
    "contato_audio"
  ]
}
```

O modelo está **gerando tags semanticamente úteis** (receita pronta, aguardando retirada, contato por áudio) e o `apply.ts` descarta tudo silenciosamente porque não está na whitelist hardcoded de 14 strings em `agent-core.ts`. A clínica nunca vê.

**Por que isso é pior que o P0:** P0 falha visível (linha em `ai_usage` com `status='error'`). P7 falha **invisível** — o run termina `ok`, paga `gpt-5-mini`, e joga 5 tags fora. Multiplicado por 94 runs/dia.

**Discrepância adicional doc-vs-código:** `TAGS_LIVE.md §Whitelist` lista 21 tags (incluindo `interesse_conjuge`, `segunda_opiniao`, `alta_urgencia`, `risco_cirurgico`, `exames_prontos`), mas `agent-core.ts:255` tem 14. Doc e código divergiram — provável corolário de migração incompleta.

**Fix em 3 partes:**

1. **Whitelist dinâmica por clínica.** Novo path: `app_settings.value.automation.classifier.tag_taxonomy` (jsonb), formato:
   ```json
   {"tags": [{"slug":"receita_disponivel","description":"Receita médica pronta para retirada"}, ...]}
   ```
   `agent-core.ts` lê via helper análogo ao `clinicFieldSchema`, monta o trecho do system prompt e o `apply.ts` valida contra a mesma lista.

2. **Seed inicial:** as 14 atuais + as 7 do `TAGS_LIVE.md` que faltam + as 5 que vimos sendo descartadas hoje (`receita_disponivel`, `aguardando_retirada`, `retirada_nao_confirmada`, `interesse_tratamento`, `contato_audio`).

3. **Tabela `tag_candidates`** (modo descoberta, opcional mas fecha o loop):
   ```sql
   create table public.tag_candidates (
     clinic_id uuid not null,
     tag text not null,
     count int not null default 1,
     last_seen timestamptz not null default now(),
     sample_lead_id uuid,
     primary key (clinic_id, tag)
   );
   ```
   `apply.ts` upserta cada `dropped_by_whitelist`. UI em `/admin` lista candidatos com botão "promover".

---

## P8 — Fila travada com backoff longo

**Evidência agora:**

```sql
SELECT count(*) FILTER (WHERE needs_ai_review),
       count(*) FILTER (WHERE needs_ai_review AND ai_review_queued_at < now()-'10 min')
FROM leads;
-- 7 / 7  (todos parados >10min)
```

**Causa-raiz combinada:**

1. `pipeline-classify/index.ts:166-169` adia `ai_review_queued_at` em **+10 min** em qualquer erro. Como o P0 produz erros sistemáticos, cada lead falha → 10min de pausa → falha de novo.
2. Sem `pg_try_advisory_xact_lock` no `classifyOneV2`. Dois `tick` paralelos (cron a cada 1min) podem pegar o mesmo lead se o anterior estourou 60s.

**Fix:**

- Advisory lock por lead:
  ```ts
  const { data: locked } = await client.rpc("try_classify_lock", { lead_id });
  if (!locked) return { skipped: "locked_by_other_worker" };
  ```
  (RPC nova: `select pg_try_advisory_xact_lock(hashtext('classify:'||_lead_id))`).
- Backoff escalonado: 2 / 5 / 30 min em vez de 10/10/10. Após Fase A cair, fila drena sozinha.

---

## P9 — `tickQueueV2` sem filtro allowlist

`pipeline-classify/index.ts:141-148`: o SELECT pega qualquer lead `needs_ai_review=true` independente da clínica. O filtro `pipeline_automation_allowlist` só acontece dentro do `classifyOneV2` (depois de carregar o lead) → desperdício de slots de concorrência.

Hoje só uma clínica está allowlistada, então não morde — mas é o mesmo padrão que causou `KNOWN_ISSUES §-4` em `automations-tick`.

**Fix:** join inline no SELECT, mesmo padrão do trigger `trg_automation_runs_clinic_coherence`.

---

## P2 — Maestro sem regras de resolução de conflito

`buildMaestroSystem` recebe 3 JSONs (agendador + tipificador + movimentador) sem dizer como resolver conflito quando, p.ex., agendador diz "marcar consulta" mas tipificador diz `status=desistiu`.

**Fix (4 linhas no system prompt):**
1. Conflito agendamento × desqualificação → desqualificação vence.
2. `manual_lock_until` futuro → não mover (mas pode aplicar tags/fields).
3. `precisa_atencao_humana` no input → não mover.
4. Se confiança média < 0.6 → reportar `mode=stage_suggestion_only`.

---

## P10 — RPC `apply_lead_automation_patch` é atômica demais

`apply.ts` empacota tags + custom_fields + suggestion numa única RPC. Se o trigger `trg_validate_lead_custom_fields_enums` (`TRIGGERS_AUDIT §2.2`) rejeitar 1 enum (ex.: tipificador inventa `qualificacao='talvez'`), **a RPC inteira aborta** — tags válidas e iteração `field-changed` se perdem.

**Fix:** sanitizar enums em `apply.ts` antes do RPC (já temos `clinicFieldSchema`). Descartar chave inválida + logar em `rejected[]`.

---

## P12 — Tipificador roda mesmo quando G10 vai bloquear tudo

G10 (`GATES.md`) descarta sugestão de `custom_fields` se a chave foi editada por humano há <7d. Hoje, mesmo se TODAS as chaves estão protegidas, o Tipificador roda (paga tokens) e o `apply.ts` descarta tudo via `blocked_by_g10`.

**Fix:** ler `custom_fields_last_human_edit` antes da fase paralela; se 100% das chaves do schema da clínica estão protegidas dentro de 7d, pular Tipificador (manter Agendador e Movimentador, que não tocam custom_fields). Economia direta sem perda de qualidade.

---

## P3, P4, P5, P6 (robustez/operacional)

- **P3:** `withSchemaRetry` deve detectar 429 (`status===429` ou `error.message.match(/rate.?limit/i)`) e aplicar backoff exponencial (200ms→1600ms) com `Retry-After` quando presente.
- **P4:** `buildContextBlock` do Resumidor sem cap de mensagens; truncar nas últimas 30 + sumário simbólico ("…+N mensagens anteriores").
- **P5:** `pipeline-post-move-verifier` aceita a maioria dos moves `auto:*`. Restringir whitelist a `['auto:b2b-move']` (único caso onde A2 traz valor) — alinha com `AUDITORS.md`.
- **P6:** `payload.agents.maestro.outcome` hoje só registra `ok|skipped|error`. Adicionar `applied`, `strict_blocked`, `no_signal`, `low_confidence`.

---

## P13 — Dispatcher do executor ignora `parallel`

Já registrado em `KNOWN_ISSUES.md §-3` como **aberto**. Botão "Só Paralelos" da UI `/pipeline-runs` é no-op. Fix de 6 linhas no `pipeline-run-executor/index.ts` (estender union + whitelist). Incluir aqui só por completude — Fase D.

---

## P11, P14 — Documentação

- **P11:** criar `docs/pipeline/runtime/USER_AUTOMATIONS.md` (regras de `public.automations` consumidas por `automations-tick`). Gap registrado em `TRIGGERS_AUDIT §G5`.
- **P14:** sincronizar `TAGS_LIVE.md` com a whitelist real após Fase A (P7).

---

## Plano de execução

### Fase A — Causa raiz + maior ROI (P0 + P7)
1. `_shared/clinic-openai.ts`: `createOpenAICompatible` → `createOpenAI`.
2. Reverter `z.any()` do Tipificador para schema tipado (structured outputs agora garantem conformidade).
3. Migration: `app_settings.value.automation.classifier.tag_taxonomy` com seed de ~26 tags.
4. `agent-core.ts`: helper `loadClinicTagTaxonomy()` + injeção no system do Tipificador.
5. `apply.ts`: validar contra taxonomia da clínica em vez da constante.
6. (Opcional) Tabela `tag_candidates` + UI admin.
7. Smoke test: 5 leads → esperar `applied.tags.added.length > 0` em ≥80%.

### Fase B — Saúde operacional (P8 + P9)
8. RPC `try_classify_lock` + uso em `classifyOneV2`.
9. Backoff escalonado (2/5/30 min).
10. Join `pipeline_automation_allowlist` no SELECT do `tickQueueV2`.

### Fase C — Precisão (P2 + P10 + P12)
11. Regras de conflito no system do Maestro.
12. Sanitização de enums em `apply.ts` pré-RPC.
13. Skip do Tipificador quando 100% protegido por G10.

### Fase D — Robustez (P3 + P4 + P5 + P6 + P13)
14. Backoff 429 separado do schema retry.
15. Cap de 30 msgs no `buildContextBlock`.
16. `post_move_verifier.rules_enabled = ['auto:b2b-move']`.
17. Outcome expandido em telemetria.
18. Aceitar `only_agent: 'parallel'|'agendador'|'movimentador'` no executor.

### Fase E — Documentação
19. `USER_AUTOMATIONS.md` novo.
20. Sincronizar `TAGS_LIVE.md`, `CLASSIFIER.md` (Fase 2 detalhada), `KNOWN_ISSUES.md` (novas seções §-6 a §-9).
21. `node scripts/docs-sync.mjs`.

---

## Fora de escopo (backlog)

- Migração para Lovable AI Gateway (BYOK → credits).
- Testes de regressão automatizados de prompts.
- Reescrita do dispatcher para multi-agente (related a P13, escopo maior).

---

## Recomendação

**Aprovar Fase A primeiro (P0 + P7).** Sozinha:
- Elimina os 12 erros/dia silenciosos.
- Recupera 99% das sugestões de tags hoje desperdiçadas.
- Não toca código de movimentação (zero risco para gates).

Após 24h estável em Fase A, encadear Fase B (fila) e Fase C (precisão).

---

# Rodada 2 — varredura cruzada doc × código (2026-06-22, batch 1)

## P15 — A1 (`position-auditor`) e A2 (`post-move-verifier`) silenciosamente mortos 🔴 crit

**Evidência:**
```sql
SELECT count(*) FROM lead_events
 WHERE type IN ('position_audit_ok','position_audit_disagreement')
   AND created_at > now() - interval '7 days';
-- 0

SELECT count(*) FROM ai_usage
 WHERE operation LIKE 'position%' OR operation LIKE 'post_move%';
-- 0 (nunca)
```

Toggles ativos (`automation.position_auditor.enabled=true`, `automation.post_move_verifier.enabled=true`), mas **nenhuma invocação registrada**. `AUDITORS.md` documenta A1 como diário 03:00 BRT e A2 como hook async pós-move — ambos invisíveis no banco.

**Hipóteses (a investigar):**
1. Cron `pipeline-position-auditor-daily` ausente/desativado em `cron.job` (sem permissão de leitura aqui — verificar via dashboard ou função interna).
2. Hook do A2 em `_shared/pipeline-move.ts` faz `fire-and-forget` que está silenciando erros (sem `await`, sem catch logado).
3. Ambas funções deployadas mas falhando no boot (sem entradas em `ai_usage`).

**Impacto:** marco 2.5 da arquitetura inteiramente inativo. Discordâncias do A1 nunca viram tag `auditor_sugere_*` (confirma o que `TAGS_LIVE.md` já mostra: zero leads com essa tag). A2 nunca valida moves de B2B/IA.

**Fix:** investigação dirigida (logs do cron + curl direto na função A1 com `{action:'lead', lead_id:<x>}` para isolar bug). Sem isso, qualquer P5 (whitelist do A2) é cosmético.

## P16 — A1 canon hardcoded inclui stage fantasma "Em tratamento" 🟠 alta

**Local:** `pipeline-position-auditor/index.ts:57-78` — type `Canon` e enum Zod incluem `"Em tratamento"`.

**Real:**
```sql
SELECT canonical_name FROM stage_canonical_aliases;
-- ...
-- em_tratamento  (snake_case, mapeia para "1ª Sessão Finalizada")
```

Não existe alias `Em tratamento` (PascalCase) — só `em_tratamento`. Quando o A1 retornar `stage_suggestion="Em tratamento"`, ninguém resolve para um stage real e a tag vira `auditor_sugere_em_tratamento` apontando para o vácuo.

`AUDITORS.md §A1` documenta o canon como espelho da realidade, mas a realidade não confere.

**Fix:**
- Trocar enum para usar canonical slugs (`em_tratamento`, `nutricao_inativa`, `geladeira_de_leads`, etc.) ou para resolver via consulta de aliases por clínica em runtime.
- Atualizar `AUDITORS.md`.

## P17 — A1 `EXCLUDED_STAGES` não cobre "Nutrição Inativa (Geladeira de Leads)" 🟠 alta

**Local:** `pipeline-position-auditor/index.ts:35-42` — set hardcoded com `"Nutrição inativa"` (i minúsculo) e `"Paciente antigo"`.

**Real ÓR:** stage chama-se `Nutrição Inativa (Geladeira de Leads)`. Não bate.

**Consequência:** A1 vai auditar leads parados ≥7d em geladeira (que é o normal — a geladeira existe pra ficar parado!) e gerar `auditor_sugere_*` ruído sistemático.

**Fix:** usar resolução por alias canônico (`geladeira_de_leads`, `nutricao_inativa`, `nutricao_antigos`) em vez de comparar `stage.name` literal.

## P18 — Triggers existentes não documentados em `TRIGGERS_AUDIT.md` 🟡 doc

**Achados na varredura `pg_trigger`** (não listados em `TRIGGERS_AUDIT §2.1/§2.2`):
- `leads.leads_updated`
- `leads.log_lead_changes_trg`
- `messages.trg_messages_update_lead_last_inbound`

`TRIGGERS_AUDIT §G2` já alerta sobre gap; estes 3 confirmam que o gap cresceu.

**Fix:** adicionar à §2.2 do `TRIGGERS_AUDIT.md` na Fase E.

## P19 — Toggles `automation.*` referenciados pela doc não existem em `app_settings` 🟠 média

**Verificado:**
```sql
SELECT key FROM app_settings WHERE key LIKE 'automation.%';
-- só existem: classifier.*, inactivity_paciente_antigo, position_auditor.*, post_move_verifier.*
```

**Faltando** (citados em `DETERMINISTIC_RULES.md`):
- `automation.novo_lead.enabled`
- `automation.secretary_replied.enabled`
- `automation.modality_guard.enabled`
- `automation.ciclo_concluido.enabled`
- `automation.monthly_sweep_paciente_antigo.enabled`
- `automation.reactivation.enabled`
- `automation.human_reactor.enabled`
- `automation.followup_24h.enabled` / `followup_3d.enabled` / `followup_7d.enabled`

**Lógica do G3** (`pipeline-move.ts:96-108`): se `setting` não existe → bloqueia. Mas há 267 eventos `auto:followup-3d` nos últimos 7d com `reason=null` (passou). Então essas regras **não estão passando `ruleKey`** para `pipelineMove()`, contradizendo a tabela do `DETERMINISTIC_RULES.md` que lista toggle por regra.

**Consequência:** painel de toggles na UI (se existir) é fictício; tudo roda sem freio. Ou seja, **`automation.novo_lead.enabled=false` não desliga `auto:novo-lead`**.

**Fix:**
- Auditar cada `pipelineMove()` em `pipeline-deterministic/index.ts` e confirmar passagem de `ruleKey`.
- Seed dos toggles ausentes em `app_settings` com valor `true` (preserva comportamento atual).
- Documentar invariante "todo `auto:*` DEVE passar `ruleKey` e o toggle DEVE existir em `app_settings`".

---

> **Status da varredura:** batch 1 concluído. Pendente: batch 2 (intents extraction, message dedup, evolution-webhook, stage_sequence_bindings), batch 3 (RPCs do clinic-openai, custom_fields_last_human_edit, RLS do allowlist).


