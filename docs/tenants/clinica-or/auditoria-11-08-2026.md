---
title: "Auditoria completa do pipeline — Clínica ÓR (11/08/2026)"
topic: kanban
kind: audit
audience: both
updated: 2026-08-11
summary: "Auditoria de código + banco do pipeline da Clínica ÓR. Confirma que o classificador de IA move cards em produção apesar da arquitetura V7 tê-lo declarado desligado; 4 configurações de contenção não são lidas pelo código. Inclui 3 achados refutados por dados e o inventário de divergências entre repositório, banco e documentação."
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
code_refs:
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/functions/pipeline-classify/context.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/pipeline-deterministic/index.ts
  - src/components/lead/LeadTimelineTab.tsx
related_docs:
  - docs/tenants/clinica-or/README.md
  - docs/tenants/clinica-or/agentes-e-modelos.md
  - docs/tenants/clinica-or/gatilhos-e-automacoes.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/features/LEAD_TIMELINE.md
---

# Auditoria completa do pipeline — Clínica ÓR

**Data:** 11/08/2026 · **Pipeline:** `17c27f4d-8256-4ea7-b5b9-ed706494f686`

---

## Sumário executivo

A Clínica ÓR opera oficialmente na arquitetura **V7 determinística**, na qual a IA
não move cards. A auditoria confirmou, com dados de produção, que **isso não é
verdade**: o classificador moveu 64 cards nos últimos 30 dias, o mais recente em
**11/08/2026 às 14:42**.

A causa não é uma configuração esquecida. É que **quatro configurações de
contenção preenchidas no banco não são lidas por nenhuma linha do código ativo**:

| Configuração | Valor em produção | Lida pelo código? |
|---|---|---|
| `pipeline_tenant_classifiers.active_agents` | os 5 agentes | ❌ nunca |
| `pipeline_tenant_classifiers.locked_stages` | 4 colunas de agendamento | ❌ nunca |
| `app_settings.automation.classifier.stage_move.enabled` | `true` | ❌ só pelo `index.v1.ts` legado |
| `app_settings.automation.classifier.stage_move_min_confidence` | `0.75` | ❌ só pelo `index.v1.ts` legado |

O sistema **parece contido de todos os ângulos observáveis pelo painel**, e não está.

Três achados da primeira passagem foram **refutados** pelos dados — todos por
terem sido derivados de `docs/pipeline/runtime/`, que está desatualizado em
pontos que só o banco revela.

---

## 1. Método e limitações

- **Código:** repositório em `main`, commit `2924deba` (05/08/2026).
- **Banco:** exports de `SELECT` executados no SQL Editor do Lovable Cloud em 11/08/2026 ~13:30.
- **Não verificado:** qual build das Edge Functions está publicado. O repositório
  pode divergir do que roda. Onde isso importa, está sinalizado.

> ⚠️ **Lição de método.** Três conclusões erradas desta auditoria vieram de tratar
> `docs/pipeline/runtime/` como fonte de verdade. A camada `runtime/` congelou em
> 22/06/2026 enquanto o tenant mudou muito em julho. **Trate-a como histórico.**
> A ordem correta de confiança é: banco → código → documentação.

---

## 2. Estado real em produção (11/08/2026)

### 2.1 As 12 colunas — nomes reais

| # | Nome real | Canônicos mapeados | Terminal |
|---|---|---|---|
| 0 | Leads de entrada | `Novo` | não |
| 1 | Qualificação | `Qualificação` | não |
| 2 | Paciente antigo | `Paciente antigo` | não |
| 3 | Consulta agendada | `Consulta agendada` | não |
| 4 | Consulta finalizada | `Consulta finalizada` | não |
| 5 | Tratamento agendado | `Tratamento agendado` | não |
| 6 | **Tratamento Ativo** | `em_tratamento` · `primeira_sessao_finalizada` · `1ª Sessão Finalizada` | não |
| 7 | Sem resposta | `Sem resposta` | não |
| 8 | Nutrição Inativa (Geladeira de Leads) | `Nutrição inativa` · `nutricao_inativa` · `geladeira_de_leads` | não |
| 9 | Nutrição Antigos | `nutricao_antigos` · `Nutrição Antigos` | não |
| 10 | B2B / Stakeholders | `B2B / Stakeholders` | **sim** |
| 11 | Desqualificado / Fora de escopo | *(nenhum)* | **sim** |

Nenhuma coluna tem `lock_auto_move = true` — o gate G2 não protege nada hoje.

> `STAGES_LIVE.md` diverge em dois nomes: registra `1ª Sessão Finalizada` (hoje
> `Tratamento Ativo`) e `Nutrição Antigos (>60d)` (hoje `Nutrição Antigos`).

### 2.2 Quem move cards — 30 dias

| Origem | Moves | Último |
|---|---|---|
| `system` | 1124 | 11/08 16:00 |
| `auto:followup-7d` | 157 | 11/08 16:00 |
| `manual` | 141 | 11/08 15:25 |
| `auto:novo-lead` | 82 | 11/08 01:07 |
| `auto:secretary-replied` | 81 | 07/08 |
| `auto:automation-rule` | 70 | 28/07 |
| **`auto:classifier-general`** | **64** | **11/08 14:42** |
| `auto:inactivity-tick` | 37 | 08/08 |
| `auto:reactivation-inbound` | 25 | 16/07 |
| `auto:field-changed-consulta` | 18 | 11/08 14:21 |
| `auto:field-changed-procedimento` | 11 | 06/08 |
| `auto:monthly-sweep` | 5 | 01/08 |
| `auto:classifier-nurture` | 2 | 23/07 |

`system` + `manual` = 1265 linhas do trigger; `auto:*` = 552 do `pipelineMove`.
A diferença é a assinatura da duplicação (§3.2).

`auto:wakeup-trigger` **não aparece nenhuma vez** — ver §3.5.

### 2.3 Automações ativas (tabela `automations`)

Apenas **6 regras**, todas de comunicação:

- 4 × `before_appointment` — lembretes de 1 dia e 1 hora, separados por presencial/online
- 2 × `stage_idle` — pesquisa de satisfação (uma desabilitada)

**Nenhuma regra de movimentação existe.** As três presentes em migrações do
repositório (`no_reply_after` 48h, `Geladeira - 7 Dias`, `Limpeza Mensal`) **não
estão em produção**. O último move por `auto:automation-rule` foi em 28/07 — a
data provável em que foram apagadas.

---

## 3. Achados confirmados

### 3.1 🔴 A IA move cards, sem toggle e sem guarda anti-conflito

**Evidência:** 64 moves por `auto:classifier-general`, o último em 11/08 14:42.

Origem em três commits de **19/06/2026**, nenhum revertido:

```
d29e54c5  fix pipeline classification                              → criou o General Move
7e324dc1  chore(pipeline): temporarily disable 24h anti-conflict
          lock for testing                                          → matou a guarda
6d5c461b  feat(pipeline-classify): force 100% automation - bypass
          G10 for dates, omit ruleKey for general move              → removeu o toggle
```

Em [`apply.ts:476`](../../../supabase/functions/pipeline-classify/apply.ts) o caminho
"General Move" move com `confidence ≥ 0.8` para qualquer coluna fora das 4 de
agendamento, e o `ruleKey` foi **deliberadamente omitido** (comentário no código:
*"para garantir que o move sempre ocorra, forçando 100% automação"*), o que pula o
gate G3. Não existe toggle capaz de desligá-lo.

Nas linhas **415** e **489**, a guarda anti-conflito é código morto:

```ts
const { data: recentHuman } = await client.from("lead_stage_history")…  // nunca usado
const noRecentHumanMove = true;                                          // hardcoded
```

**Dano medido:** 6 casos em que a IA moveu um card que a secretária havia movido
à mão nas 24h anteriores. Último em **07/08**.

#### Para onde a IA move (pós-transição de junho)

| Movimento | n | Último |
|---|---|---|
| Leads de entrada → Qualificação | 72 | 11/08 |
| **Tratamento Ativo → Qualificação** | 5 | **11/08 14:42** |
| **Desqualificado → Qualificação** | 5 | 06/08 |
| Qualificação → Leads de entrada | 8 | 28/07 |
| **B2B → Paciente antigo** | 2 | 28/07 |
| Qualificação → Nutrição Inativa | 16 | 27/07 |
| **B2B → Qualificação** | 12 | 24/07 |
| Qualificação → Paciente antigo | 6 | 22/07 |
| **Qualificação → B2B** | 5 | 13/07 |

Dois padrões preocupantes:

- **Ressuscita colunas terminais.** 17 leads tirados de `B2B` e `Desqualificado`
  (ambas `is_terminal = true`) e devolvidos a Qualificação.
- **Contorna os guards do B2B.** O caminho dedicado ao B2B exige `confidence ≥ 0.95`
  + tag `b2b` + ausência de histórico de tratamento. O General Move chega na mesma
  coluna com 0.8 e nenhuma dessas checagens.

**Defesa que funciona:** nenhum move para colunas de agendamento desde 25/06 —
o `HUMAN_SCHEDULING_STAGES` está segurando.

### 3.2 🔴 Duplicação em `lead_stage_history`

**Evidência:** 1079 grupos duplicados, 1094 linhas extras, pior caso 6 —
sobre 6132 registros. **18% do histórico é duplicata.**

Dois caminhos gravam a mesma movimentação em transações distintas: o trigger
`record_lead_stage_history` (no `UPDATE`) e o `pipelineMove` logo depois. O índice
único `lead_stage_history_dedup_uidx (lead_id, to_stage_id, moved_at)` não pega
porque `now()` difere em microssegundos entre transações.

Efeito colateral: a linha do tempo do lead mostra o mesmo evento duas vezes, e
qualquer relatório de movimentação está inflado nessa proporção.

### 3.3 🔴 47% do histórico aponta para etapas inexistentes

**Evidência:** de 6132 linhas, **2895 (47%) com origem órfã** e 1495 (24%) com destino órfão.

`lead_stage_history.from_stage_id` / `to_stage_id` são `uuid` **sem foreign key**
([migração 20260509235151](../../../supabase/migrations/20260509235151_08599eef-10ae-4403-aaef-d293615dfb5f.sql)),
enquanto `pipeline_stages.pipeline_id` tem `ON DELETE CASCADE` para `pipelines`.
Quando a [migração 20260617224941](../../../supabase/migrations/20260617224941_29057720-1b59-4b54-b574-aa0d42fa011b.sql)
executou `DELETE FROM pipelines WHERE id='737242e7-…'`, o cascade apagou todas as
etapas daquele funil e deixou o histórico apontando para o vazio.

Sintoma na UI: cards `Etapa: — → —` na linha do tempo. O nome histórico é
**irrecuperável** — a linha foi deletada de verdade.

### 3.4 🟠 A coluna `Tratamento Ativo` cega o detector de "já tratado"

[`schema.ts:50`](../../../supabase/functions/pipeline-classify/schema.ts) compara por **nome**:

```ts
export const TREATED_STAGES = new Set(["1ª Sessão Finalizada", "Em tratamento",
                                       "Consulta finalizada", "Paciente antigo"]);
```

[`context.ts:236`](../../../supabase/functions/pipeline-classify/context.ts) resolve o
histórico para nomes reais. Como a coluna virou `Tratamento Ativo`, um paciente cujo
tratamento passou só por lá **não é detectado como já tratado**.

**Consequência observada:** 5 moves `Tratamento Ativo → Qualificação`, o último em
11/08 14:42. O mesmo campo cego alimenta o guard do B2B — e 47% do histórico órfão
já o cegava em metade dos casos.

### 3.5 🟠 Wake-up duplicado, divergente e sem rastro

Dois caminhos ativos fazem a mesma coisa com destinos diferentes:

| Caminho | Nutrição Inativa → | Nutrição Antigos → |
|---|---|---|
| `trg_clinica_or_wakeup_inbound` (SQL) | Qualificação | **Qualificação** |
| `auto:reactivation-inbound` (edge) | Qualificação | **Paciente antigo** |

O trigger SQL é síncrono e vence. Um paciente antigo que responde volta a ser
tratado como lead frio.

**E o log perde a origem:** o trigger faz `UPDATE` + `INSERT` na mesma transação,
então `now()` é idêntico nos dois registros, o `ON CONFLICT` descarta o explícito e
sobra apenas a linha do trigger com `source='system'`. Por isso `auto:wakeup-trigger`
tem **zero ocorrências** em 30 dias apesar de a regra rodar.

### 3.6 🟠 A coluna "Sem resposta" está órfã do fluxo automático

Nada move lead para lá automaticamente, exceto um appointment marcado como `faltou`.
A regra `no_reply_after` de 48h **não existe em produção** (§2.3).

O que acontece de fato: **157 leads em 30 dias** saem de Qualificação direto para
`Nutrição Inativa` aos 7 dias sem inbound, via `auto:followup-7d` — pulando "Sem
resposta" inteira. O fluxo documentado (48h → Sem resposta → 7d → Nutrição) não
ocorre desde ~28/07.

### 3.7 🟡 Telemetria do tick sempre zerada

[`pipeline-deterministic/index.ts:1035`](../../../supabase/functions/pipeline-deterministic/index.ts)
lê `r?.inactivity?.pa40`, mas a função retorna **`pa60`**. Toda linha de
`pipeline_tick_stats` grava `candidates=0, moved=0, failure_reasons={}`.

### 3.8 🟡 Chips nunca são limpos

**Evidência:** 1962 leads · média 0,5 chips · máx 8 · **209 com `nova_mensagem`** ·
70 com 5+ · **16 com procedimento divergente**.

`trg_lead_needs_extraction` faz união acumulativa:

```sql
ai_review_reasons = (SELECT array_agg(DISTINCT r)
                     FROM unnest(COALESCE(ai_review_reasons,'{}') || v_reasons) r)
```

e `updateWatermark()` remove apenas `pipeline-classifier`. Todo o resto persiste.
Além disso, `procedimento_interesse` só é gravado quando está `NULL`, então o card
pode exibir `Cetamina` (campo) e `procedimento:retorno` (chip) ao mesmo tempo.

### 3.9 🟡 `ruleConsultaPassou` é código morto

Retorna `disabled_by_human_transition` na primeira linha; ~90 linhas seguintes são
inalcançáveis. O toggle `automation.consulta_passou_finaliza.enabled` está `false`,
coerente. A decisão de desligar (o cron finalizava cards de pacientes com consulta
**e** tratamento em paralelo) foi correta, mas **não está registrada em nenhum documento**.

### 3.10 🟡 `modalidade_preferida` deletado mas ainda no schema da IA

O campo foi removido de `lead_custom_fields` no PR4 e continua em
`app_settings.automation.v42.custom_fields_schema`. A IA tenta preenchê-lo e a
escrita é rejeitada, gerando ruído no log.

---

## 4. Achados refutados

> Registrados para que não sejam levantados de novo.

### ❌ "O guard D3 quebrou a geladeira de 60 dias"

**Refutado.** 438 movimentações `Paciente antigo → Nutrição Antigos`, a última em
08/08, e **zero leads elegíveis parados**.

A conclusão errada veio de `STAGES_LIVE.md`, que registra o nome como
`Nutrição Antigos (>60d)`. O nome real é `Nutrição Antigos`, e a comparação em
[`pipeline-move.ts:186`](../../../supabase/functions/_shared/pipeline-move.ts) bate.

**Resíduo real:** `Nutrição Inativa (Geladeira de Leads)` **não** casa com
`"Nutrição inativa"` do código, então essa exceção do D3 segue morta. Inofensivo
hoje (nenhuma regra move Paciente antigo → Nutrição Inativa), mas é armadilha para
quem criar essa regra no futuro.

### ❌ "Dois sistemas concorrentes de inatividade"

**Refutado.** Existe **um só** — o `pipeline-deterministic`. A tabela `automations`
não tem nenhuma regra de inatividade. O achado real é o oposto e está em §3.6.

### ❌ "A IA está desligada para a ÓR"

**Refutado** pelos dados de §2.2 e §3.1. Todas as travas estão abertas:
`registry.enabled=true`, `allowlist.enabled=true`,
`ai_target_pipeline_ids` inclui o pipeline da ÓR, `classifier.enabled=true`,
e `trg_messages_enqueue_classifier` está ativo.

---

## 5. Divergências repositório × produção × documentação

| Item | Repositório | Produção |
|---|---|---|
| Automações de geladeira | 3 migrações inserem | **não existem** |
| `no_reply_after` 48h | migração ajusta | **não existe** |
| Nome da coluna 6 | `1ª Sessão Finalizada` | `Tratamento Ativo` |
| Nome da coluna 9 | `Nutrição Antigos (>60d)` | `Nutrição Antigos` |
| `active_agents` da ÓR | 5 (seed) | 5 — e **ninguém lê** |

### Documentos que precisam de correção

| Doc | Problema |
|---|---|
| `agentes-e-modelos.md` | Afirma 2 agentes e zero movimentação por IA. Falso — §3.1 |
| `gatilhos-e-automacoes.md` | Descreve SLA 48h → Sem resposta, que não existe — §3.6 |
| `README.md` (tenant) | Lista 10 colunas (são 12); diz V6 na intro e V7 no corpo |
| `glossario-e-bugs.md` | "11 Gates" (são 5 + guard D3); `code_refs` para diretório inexistente |
| `EVENTS_TELEMETRY.md` | "Toda movimentação passa por pipeline-move" é falso; atribui `pipeline_changed` ao trigger errado (`log_lead_changes`, não `sync_lead_pipeline_id`) |
| `STAGES_LIVE.md` | Dois nomes de coluna desatualizados |
| `KNOWN_ISSUES.md` | Congelado em 23/06; §7 tem diagnóstico invertido (ver §6.2) |
| `LEAD_TIMELINE.md` | Lista 3 tipos bloqueados; o código bloqueia 7 |
| **Todos** | **Nenhum documenta `trg_lead_needs_extraction`** — o motor de regex que gera todos os chips e preenche 13 campos |

---

## 6. Notas técnicas de apoio

### 6.1 `trg_lead_needs_extraction` — o motor não documentado

Roda em toda mensagem inbound não-automatizada. **É regex em SQL, não IA.**
Gera todos os chips do card e escreve 13 campos diretamente no JSONB.

| Chip gerado | Campo que grava junto |
|---|---|
| `procedimento:{cetamina,emt,primeira_consulta,retorno,seguimento,terapia}` | `procedimento_interesse` (só se `NULL`) |
| `interesse` | `demonstrou_interesse=true` |
| `pagamento` | `tentou_pagamento=true` |
| `agendamento` | `tentou_agendar=true` (só com regex de confirmação) |
| `risco_clinico` | `risco_clinico=true` + timestamp |
| `proc_nao_atendido:emdr` | `qualificacao='desqualificado'` + motivo + data |
| `b2b_pitch` | `is_b2b=true`, `tipo_contato='b2b'` |
| `media:image` / `media:audio` | `needs_audio_transcription` |
| `nova_mensagem` | *(fallback — nenhuma regra bateu)* |

Nenhum desses campos tem definição em `lead_custom_fields` — por isso não aparecem
no painel de campos personalizados.

### 6.2 Campos virtuais de agendamento

`consulta_agendada_em` e `procedimento_agendado_em` **não existem** em
`lead_custom_fields` por design. São derivados em runtime de
`clinic_appointment_types` em [`ContextRail.tsx:97`](../../../src/components/inbox/ContextRail.tsx),
pela convenção `${kind_name}_agendado_em` com um caso especial hardcoded para
`consulta` (concordância de gênero: *agenda**da*** vs *agenda**do***).

Consequências:

- `KNOWN_ISSUES.md §7` sugere cadastrar o campo. **É a ação errada** — a linha seria
  descartada pelo filtro de colisão da própria UI.
- A linha do tempo não conhece campos virtuais e exibe a chave crua
  (`consulta_agendada_em`) em vez do rótulo.
- A convenção está duplicada e divergente: o frontend gera
  `${kind_name}_agendado_em` para qualquer tipo; o backend
  ([`date-parser.ts:44`](../../../supabase/functions/pipeline-classify/date-parser.ts))
  só conhece dois casos. Um terceiro tipo de compromisso ficaria editável na tela e
  invisível para toda a automação.

### 6.3 Riscos de dados (LGPD)

Itens versionados em repositório **público**:

- `.env` e `.env.development` commitados
- Pasta `csv/` com **nomes e telefones de pacientes**, **conteúdo de conversas de
  WhatsApp** e uma **chave de API da Evolution em texto puro**
- Chave `anon` do Supabase hardcoded em
  [`notify_pipeline_deterministic()`](../../../supabase/migrations/20260618022933_e4ca1829-7d6c-4cd1-8f70-e5bcb788f35a.sql)

São dados de saúde de clínica psiquiátrica. Remover no último commit não basta —
estão no histórico do git. A chave da Evolution deve ser rotacionada.

---

## 7. Recomendações priorizadas

### P0 — Parar o sangramento

**Opção A (imediata, sem deploy):** `enabled = false` na linha da ÓR em
`pipeline_tenant_classifiers`. Corta o enfileiramento na raiz e para os três
caminhos de move da IA. **Custo:** perde os resumos de conversa junto — o
interruptor é binário. Reversível.

**Opção B (patch em `apply.ts`):**

1. Reativar a guarda anti-conflito nas linhas 415 e 489 — `recentHuman` já é consultado e descartado
2. Devolver `ruleKey` ao General Move para que exista um toggle
3. Bloquear colunas com `is_terminal = true` no General Move
4. Trocar `TREATED_STAGES` por resolução via `stage_canonical_aliases` (imune a rename)

Os itens 1 e 2 são reversões diretas dos commits de 19/06 rotulados *"temporarily"*.

### P1 — Integridade do histórico

5. Deduplicar `lead_stage_history` — fazer o `pipelineMove` ceder ao trigger via
   `set_config('app.skip_stage_history')`, ou o inverso
6. Gravar **nomes** de etapa e funil no payload dos eventos, para que o log
   sobreviva a deleções (§3.3)
7. Parar de deletar `pipelines`; arquivar com `archived_at`

### P2 — Coerência de fluxo

8. Decidir o destino do wake-up de `Nutrição Antigos` e remover o caminho perdedor
9. Decidir se "Sem resposta" volta ao fluxo (recriar a regra de 48h) ou sai do funil
10. Corrigir `pa40` → `pa60` na telemetria
11. Limpar `ai_review_reasons` no `updateWatermark`, ou dar TTL aos chips

### P3 — Documentação e higiene

12. Corrigir os documentos listados em §5 e documentar `trg_lead_needs_extraction`
13. Reescrever `scripts/docs-sync.mjs` **ou** remover os scripts `docs:sync`/`docs:check`
    do `package.json` e as instruções da skill `docs-maintainer` — o arquivo foi
    deletado em 18/06 e a governança de docs está quebrada desde então
14. Rotacionar a chave da Evolution e limpar `csv/` e `.env` do histórico
15. Remover `modalidade_preferida` do schema da IA

---

## 8. Queries de verificação

Reutilizáveis. Nenhuma retorna nome, telefone ou conteúdo de mensagem.

```sql
-- Estado das travas da IA
SELECT 'registry.enabled' AS item,
       COALESCE((SELECT enabled::text FROM pipeline_tenant_classifiers
                 WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'),'(sem linha)') AS valor
UNION ALL SELECT 'allowlist.enabled',
       COALESCE((SELECT enabled::text FROM pipeline_automation_allowlist
                 WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'),'(sem linha)')
UNION ALL SELECT 'clinics.ai_target_pipeline_ids',
       COALESCE((SELECT settings->>'ai_target_pipeline_ids' FROM clinics
                 WHERE id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'),'(nulo = todos)')
UNION ALL SELECT key, value::text FROM app_settings WHERE key LIKE 'automation.%'
ORDER BY 1;
```

```sql
-- Quem move cards (30 dias) — a query que revelou §3.1
SELECT source, count(*) AS moves, max(moved_at) AS ultimo
FROM lead_stage_history
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND moved_at > now() - interval '30 days'
GROUP BY source ORDER BY moves DESC;
```

```sql
-- IA sobrescrevendo trabalho manual em menos de 24h
SELECT count(*) AS ia_sobrescreveu_humano, max(ia.moved_at) AS ultimo
FROM lead_stage_history ia
JOIN lead_stage_history hum
  ON hum.lead_id = ia.lead_id AND hum.moved_by_user_id IS NOT NULL
 AND hum.moved_at < ia.moved_at AND hum.moved_at > ia.moved_at - interval '24 hours'
WHERE ia.clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND ia.source IN ('auto:classifier-general','auto:classifier-nurture');
```

```sql
-- Duplicação no histórico
SELECT count(*) AS grupos_duplicados, COALESCE(sum(n-1),0) AS linhas_extras, max(n) AS pior_caso
FROM (SELECT lead_id, to_stage_id, date_trunc('second', moved_at) AS seg, count(*) AS n
      FROM lead_stage_history WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
      GROUP BY 1,2,3 HAVING count(*) > 1) t;
```

```sql
-- Referências órfãs
SELECT count(*) AS total,
       count(*) FILTER (WHERE to_stage_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM pipeline_stages p WHERE p.id=h.to_stage_id)) AS destino_orfao,
       count(*) FILTER (WHERE from_stage_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM pipeline_stages p WHERE p.id=h.from_stage_id)) AS origem_orfa
FROM lead_stage_history h WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1';
```

```sql
-- Triggers ativos / desabilitados
SELECT c.relname AS tabela, t.tgname AS gatilho,
       CASE t.tgenabled WHEN 'D' THEN 'DESABILITADO' ELSE 'ativo' END AS estado
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
  AND c.relname IN ('leads','messages','appointments') ORDER BY 1,2;
```

---

## 9. Alterações aplicadas nesta sessão

| Arquivo | Mudança |
|---|---|
| [`src/pages/Kanban.tsx`](../../../src/pages/Kanban.tsx) | `shortReason()` remove o prefixo `procedimento:` dos chips e resolve o rótulo via `REASON_LABEL` (`procedimento:retorno` → `Retorno`). Correção **cosmética** — a causa raiz é §3.8 |
| [`apply.ts`](../../../supabase/functions/pipeline-classify/apply.ts) | **P0.1** — guarda anti-conflito reativada nos caminhos *nurture* e *general*: `noRecentHumanMove` deixa de ser `true` hardcoded e passa a usar o `recentHuman` que já era consultado e descartado |
| [`apply.ts`](../../../supabase/functions/pipeline-classify/apply.ts) | **P0.2** — `ruleKey: "automation.classifier.stage_move.enabled"` devolvido ao General Move, restaurando o gate G3 |
| [`apply.ts`](../../../supabase/functions/pipeline-classify/apply.ts) | **P0.3** — General Move bloqueia origem **ou** destino com `is_terminal=true` (novo helper `isTerminalStage`); telemetria `general_blocked_terminal_stage:{from\|to}` |
| [`apply.ts`](../../../supabase/functions/pipeline-classify/apply.ts) + [`context.ts`](../../../supabase/functions/pipeline-classify/context.ts) | **P0.4** — `hasBeenTreatedBefore` passa a resolver o histórico por **alias canônico** (`stage_canonical_aliases`), com fallback para o nome real. O guard do B2B consome esse valor em vez de comparar nomes. Corrige §3.4 |

> ⚠️ **P0.2 não interrompe nada sozinho.** O toggle
> `automation.classifier.stage_move.enabled` está `true` em produção. O patch cria
> o interruptor; **desligá-lo é uma ação separada.** P0.1, P0.3 e P0.4 mudam
> comportamento imediatamente após o deploy.

Typecheck **não executado** — `node_modules` ausente no clone e Deno não instalado
no ambiente. Alterações revisadas por diff apenas.
