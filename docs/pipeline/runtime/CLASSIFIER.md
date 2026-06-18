---
title: "Classifier LLM (pipeline-classify) — runtime"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Edge function pipeline-classify: prompt completo PT-BR com LeadContext, schema Zod, validação de datas (sanitizeDateField), regras especiais de tag '1ª consulta', tool A3 get_lead_history, e dois caminhos de move (B2B + genérico)."
code_refs:
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/pipeline-summarize-core.ts
  - supabase/functions/_shared/pipeline-tasks.ts
  - supabase/functions/_shared/pipeline-fase4.ts
related_docs:
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/TAGS_LIVE.md
  - docs/pipeline/runtime/FIELDS_LIVE.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
---

# Classifier `pipeline-classify`

| | |
|---|---|
| Arquivo | `supabase/functions/pipeline-classify/index.ts` (696 linhas) |
| Modelo | `gpt-5-mini` |
| Provedor | OpenAI (via chave da clínica em `clinic_secrets`, resolvida por `getClinicOpenAI`) |
| Cron | `pipeline-classify-tick` — `* * * * *` (1/min) — chama `action:'tick'` |
| Toggle global | `automation.classifier.enabled` (atualmente `true`) |
| Allowlist | `pipeline_automation_allowlist.enabled=true` para a clínica |
| Fila | `leads.needs_ai_review=true` AND `'pipeline-classifier' = ANY(ai_review_reasons)` AND `ai_review_queued_at <= now()` |
| Batch | 50 leads/tick |
| Histórico lido | últimas 30 mensagens, ordem cronológica |
| Watermark | `leads.last_processed_message_id_classifier` |

## Quando dispara

1. `evolution-webhook` ou outros caminhos setam `needs_ai_review=true` + `ai_review_reasons += 'pipeline-classifier'`.
2. Cron `pipeline-classify-tick` faz POST `{action:"tick"}` a cada minuto.
3. `tickQueue` pega até 50 leads e chama `classifyOne(leadId)` em sequência (try/catch — erro empurra o lead 10 min adiante).
4. Smoke test: `supabase.functions.invoke('pipeline-classify', { body: { action:'lead', lead_id } })`.

## Inputs por lead

`classifyOne` carrega:

- `leads.{clinic_id, pipeline_id, stage_id, custom_fields, tags, last_processed_message_id_classifier, created_at}`
- Últimas 30 `messages` (cronológicas)
- `pipeline_stages.name` do stage atual
- `count(*) messages`, primeira mensagem, últimas 8 movimentações em `lead_stage_history` (com nomes de stage)
- Detecta `hasBeenTreatedBefore` = move passou em `{Em tratamento, Consulta finalizada, Paciente antigo}` OU tag `paciente_antigo`

Constrói `LeadContext`:

```
- Stage atual
- Tags atuais
- custom_fields atuais (JSON)
- Lead criado: <BRT> (há <idade humana>)
- Total de mensagens (e primeira em <BRT>)
- Já passou por tratamento/alta antes? SIM/não detectado
- Últimos stage moves (até 8)
```

Datas formatadas em **America/Sao_Paulo** via `Intl.DateTimeFormat('pt-BR')` — função `fmtBR()`.

## Prompt do sistema (literal)

Arquivo `pipeline-classify/index.ts:230-281`:

```text
Você é um classificador determinístico de um pipeline de CRM médico.
Sua tarefa: ler o histórico de mensagens de um lead e devolver UMA classificação JSON.

Pipeline canônico v4.2 (use exatamente estes nomes em stage_suggestion):
- Novo
- Qualificação
- Consulta agendada
- Tratamento agendado
- Consulta finalizada
- Em tratamento
- Sem resposta
- Nutrição inativa
- Paciente antigo
- B2B / Stakeholders

Diretrizes:
- "Novo": primeira interação, sem qualificação humana.
- "Qualificação": secretária/atendente humano já interagiu, descobrindo demanda.
- "Consulta agendada"/"Tratamento agendado": agendamento confirmado.
- "Consulta finalizada"/"Em tratamento": atendimento já realizado.
- "Sem resposta": lead parou de responder.
- "Nutrição inativa": sem retorno há muito tempo.
- "Paciente antigo": ciclo de tratamento já encerrado.
- "B2B / Stakeholders": contato comercial/parceria, NÃO paciente.

Regras:
- confidence reflete sua certeza. Use ≤ 0.5 quando o histórico for ambíguo ou muito curto.
- is_b2b=true SOMENTE se o lead claramente representa empresa/parceiro/fornecedor.
- tags_suggested: tags que DEVEM estar no lead (whitelist v4.2 + descritivas curtas, snake_case ou Title curto).
- tags_remove: tags ATUALMENTE no lead que NÃO refletem mais a realidade e devem ser removidas
  (ex.: "Interessado" num lead que já desistiu; "Comprovante" num pagamento já confirmado).
  NUNCA remova: risco_clinico, b2b, vip, paciente_antigo, precisa_atencao_humana, Lock manual.
- custom_fields_patch: só inclua chaves se há evidência clara no texto. Use null para apagar campo desatualizado.
- reasons: 1-5 frases curtas em PT-BR justificando a classificação + mudanças aplicadas.

REGRAS ESPECÍFICAS DE TAG "1ª consulta":
- Esta tag identifica PRIMEIRA consulta de um paciente NOVO.
- NUNCA sugira "1ª consulta" se: o lead tem mais de 90 dias de idade, OU já passou por
  "Em tratamento"/"Consulta finalizada"/"Paciente antigo" em algum momento, OU tem tag "paciente_antigo".
- Se essa tag já está no lead E qualquer condição acima é verdadeira, OBRIGATORIAMENTE inclua
  "1ª consulta" em tags_remove. Para retorno de paciente antigo, prefira "retorno".

REGRAS PARA DATAS (consulta_agendada_em, procedimento_agendado_em):
- Só preencha quando o lead CONFIRMOU dia E hora explicitamente.
- Para datas relativas ("amanhã", "5a"/"quinta", "semana que vem"), resolva A PARTIR do
  timestamp da mensagem que cita a data — NÃO a partir de "agora".
  Os timestamps no histórico já estão em America/Sao_Paulo.
- Sempre devolva no formato ISO completo com offset: "YYYY-MM-DDTHH:mm:00-03:00".
- Em remarcação, sobrescreva o valor antigo (o patch substitui).
- Se houver QUALQUER ambiguidade sobre dia ou horário, NÃO preencha o campo (deixe a humana resolver).

Campo intent (escolha UM):
- "agendamento", "reagendamento", "duvida_geral", "nf_reembolso",
  "pagamento_alegado", "desistencia", "interesse_tratamento",
  "judicializacao", "renovacao_receita", "objecao", "outro"

<LeadContext block injetado aqui>
```

`user` prompt: `Histórico recente do lead (id=<uuid>):\n\n<formatMessages>\n\nClassifique agora.`

Cada mensagem formatada como: `[DD/MM/YYYY HH:mm] ATENDENTE|LEAD: <conteúdo até 600 chars>`.

## Schema de saída (`ClassificationSchema`, Zod)

```ts
{
  stage_suggestion: enum(CANON_NAMES),         // 10 valores fixos
  intent: enum(INTENT_VALUES).default("outro"),
  confidence: number().min(0).max(1),
  is_b2b: boolean(),
  tags_suggested: string[].max(8),
  tags_remove:    string[].max(8).default([]),
  custom_fields_patch: Record<string, string|number|boolean|null>,
  reasons: string[].min(1).max(5),
}
```

## Tool A3 — `get_lead_history`

Habilitada por `automation.classifier.history_tool_enabled` (atualmente `true`). Quando ligada, o modelo pode chamar `get_lead_history(lead_id)` e receber até 30 eventos passados (`lead_events`, qualquer tipo, descending). `stopWhen: stepCountIs(50)` — o modelo pode iterar várias vezes mas raramente passa de 1.

```ts
inputSchema: z.object({ lead_id: z.string().uuid() })
// safeguard: lead_id deve bater com o lead em classificação
```

## Validações server-side

### 1. Datas — `sanitizeDateField` (linhas 290–306)

```ts
const DATE_FIELD_KEYS = new Set(["consulta_agendada_em", "procedimento_agendado_em"]);
function sanitizeDateField(value, anchorMs):
  - se !string ou inválida              → reject 'not_string' | 'unparseable'
  - se t < anchorMs - 2h                → reject 'in_past'
  - se t > anchorMs + 90 dias           → reject 'too_far_future'
  - else                                → ok
```

`anchorMs` = timestamp da **última mensagem** lida (`orderedMsgs[length-1].created_at`), não `now()`. Rejeições gravadas em `lead_events.payload.applied.custom_fields_rejected[]` com `{key, raw_value, reason}`.

### 2. Tags protegidas

`PROTECTED_TAGS` (linha 115) — nunca removidas mesmo se aparecerem em `tags_remove`:

```
risco_clinico · b2b · vip · paciente_antigo · precisa_atencao_humana · Lock manual · lock_manual
```

### 3. `tags_remove` só se toggle ligado

Controlado por `automation.classifier.tag_replace.enabled` (atualmente `true`). Se `false`, sugestões de remoção são ignoradas.

### 4. Confidence baixa

`confidence < 0.6` → injeta tag `precisa_atencao_humana` em `nextTags` automaticamente. Não move card mesmo se `stage_suggestion` mudou.

## Aplicação dos resultados

### Tags

```
nextTags = unique(
  currentTags.filter(t ∉ removeSet) ∪
  suggested ∪
  (lowConf ? ["precisa_atencao_humana"] : [])
)
```

UPDATE só ocorre se `tagsChanged`.

### custom_fields

Shallow merge. `null` → deleta a chave. Datas passam por `sanitizeDateField`. Patch parcial registrado em `applied.custom_fields`.

### Move de stage — dois caminhos

| Caminho | Condições | Source | idempotencyKey |
|---|---|---|---|
| **B2B** | `is_b2b=true` AND `automation.b2b_move.enabled` AND `confidence ≥ 0.9` | `auto:classifier-b2b` | `b2b:<leadId>:<lastMsgId>` |
| **Genérico** | `automation.classifier.stage_move.enabled` AND `confidence ≥ automation.classifier.stage_move_min_confidence` (default `0.75`) AND `!lowConf` AND `stage_suggestion ≠ current` | `auto:classifier-stage` | `classify-stage:<leadId>:<lastMsgId>` |

Ambos chamam `pipelineMove()` que aplica os gates G1–G5/G8/D3 e dispara A2 + stage bindings.

Caso o move seja barrado, o motivo entra em `applied.stage_move.reason` (`toggle_off`, `low_confidence`, `below_threshold(0.75)`, `same_stage`, `stage_alias_not_found:<canon>`, `gate_g1_manual_lock_until:<iso>`, `gate_g3_disabled:<key>`, `idempotent:<key>`, etc.).

## Side-effects por `intent`

| intent | Ação | Função |
|---|---|---|
| `nf_reembolso` | Cria `lead_task` "Emitir NF" + seta `data_solicitacao_nf` (se stage='Consulta finalizada') | `runNfTask` |
| `pagamento_alegado` | Tag `pagamento_alegado` + `pagamento_alegado_em` + task "Confirmar pagamento alegado" | `runPaymentAlleged` |
| `judicializacao` | Tags `judicializacao` + `precisa_atencao_humana` + task urgente +2h + `judicializacao_em` | `runJudicializacao` |
| `renovacao_receita` | Tag `renovacao_receita` + task "Renovar receita" (só em Em tratamento / Consulta finalizada / Paciente antigo) | `runRenovacaoReceita` |
| `objecao` | Internal note `[auto:objection-suggest]` + tag `objecao_detectada` | `runObjectionSuggest` |
| outros | nenhum | — |

Cada uma tem dedupe próprio (lead_task open prefix, internal_note recente etc.).

## Summarizer ao final

Sempre invoca `runSummarize(leadId, { force: intent !== 'outro' })`. Em intents triviais, summarizer respeita threshold `MIN_NEW_MSGS=3` e watermark `last_processed_message_id_summarizer`.

## Telemetria gravada

Insert único em `lead_events`:

```jsonc
{
  type: "auto:classifier",
  payload: {
    ...(classification: stage_suggestion, intent, confidence, is_b2b, ...),
    applied: {
      stage_move: { applied, from, to, path, reason, suggestion?, confidence? },
      tags_diff:  { added: [...], removed: [...], requested_remove: [...] },
      custom_fields: { key: value, ... },          // o que foi escrito
      custom_fields_rejected: [                    // rejeições do sanitizer
        { key, raw_value, reason }
      ]
    }
  }
}
```

E também: `last_processed_message_id_classifier`, `last_classified_at`, `needs_ai_review=false`, e remove `'pipeline-classifier'` de `ai_review_reasons`.

## Limitações conhecidas

Ver `KNOWN_ISSUES.md` para o histórico de bugs corrigidos (data 19/06 vs 18/06; tag "1ª consulta" em paciente de 5 anos; lock manual sem botão).

Limitações atuais (sem fix):

- O cron `pipeline-classify-tick` roda **a cada minuto**: leads podem esperar até 60s. Para uso interativo, prefere-se o smoke test direto.
- O modelo `gpt-5-mini` ocasionalmente devolve `tags_suggested` fora da whitelist v4.2 (`automation.v42.allowed_tags`). Não há validação de whitelist server-side hoje — tags arbitrárias entram em `leads.tags`. O drift é visível em `TAGS_LIVE.md`.
- `intent` não tem validação cross-field (ex.: `intent='judicializacao'` mas `stage_suggestion='Novo'` não gera warning).
- A2 verifier roda em **todo** move automático (`rules_enabled=[]`), o que adiciona uma chamada gpt-5-nano por move — custo pequeno mas não-zero.
