---
title: "Fluxo: Pipeline derivado por campos (extractor → field-rules → kanban)"
topic: ai
kind: flow
audience: agent
updated: 2026-06-17
summary: Como uma mensagem do WhatsApp vira movimentação automática de card no Kanban — passando por trigger SQL, extractor IA, custom_fields canônicos e field-rules. Documenta o loop end-to-end e os 5 modos de falha mais comuns.
code_refs:
  - supabase/functions/extractor-tick/
  - supabase/functions/vision-tick/
  - supabase/functions/audio-tick/
  - supabase/functions/field-rules-tick/
related_docs:
  - docs/maps/AI_RUNTIME.md
  - docs/maps/CUSTOM_FIELDS_CONTRACT.md
  - docs/maps/KANBAN_LEADS.md
  - docs/flows/LEAD_LIFECYCLE.md
  - docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md
---
# Fluxo: Pipeline derivado por campos

> **Quando ler:** antes de criar uma field-rule nova, debugar lead parado em coluna errada, ou ajustar o extractor.
> **Última atualização:** 2026-06-17

---

## 1. Conceito central

O Kanban **não é** uma escolha manual. É o resultado de:

```text
mensagem WhatsApp
    │
    ▼
trigger SQL (regex, custo zero)  ── marca lead.needs_ai_review=true
    │
    ▼
extractor-tick (cron 2 min)      ── preenche leads.custom_fields
    │
    ▼
field-rules-tick (cron 2 min)    ── lê custom_fields, move stage_id
    │
    ▼
kanban renderiza nova coluna
```

Quem decide a coluna do card é a **primeira `pipeline_field_rules` (ordenada por `priority DESC`) cujas condições casem** com `leads.custom_fields`. Atendente não move card no dia a dia — só configura regras e ajusta exceções.

## 2. Atores e gatilhos

| Componente | Quando dispara | Custo | Doc |
|---|---|---|---|
| `trg_lead_needs_extraction` (trigger SQL em `messages`) | A cada mensagem `direction='inbound'` inserida | $0 | `database/FUNCTIONS_TRIGGERS.md` |
| `extractor-tick` | cron `*/2 min` | ~$0.0005/lead/ciclo (gpt-5-nano) | `edge-functions/AI.md §pipeline-ia` |
| `vision-tick` | cron `*/3 min` (somente se há `messages.media_url` image/document) | ~$0.002/imagem (gpt-5-mini vision) | idem |
| `audio-tick` | cron `*/5 min` (somente se `messages.needs_audio_transcription`) | $0.006/min (whisper-1) | idem |
| `field-rules-tick` | cron `*/2 min` | $0 (SQL puro) | `maps/AI_RUNTIME.md §pipeline-ia` |

Todos os ticks são **idempotentes** e usam `SELECT … FOR UPDATE SKIP LOCKED` no batch para suportar execução concorrente.

## 3. Loop end-to-end (passo a passo)

```text
1) Lead manda "Quero saber sobre EMT, qual o valor?"
   └─► messages.INSERT
       └─► trg_lead_needs_extraction (BEFORE INSERT):
             - regex bate keywords PT-BR ("EMT", "valor", "quero")
             - UPDATE leads SET
                 needs_ai_review=true,
                 ai_review_reasons=['interest','procedure:emt'],
                 ai_review_queued_at=now()

2) Cron extractor-tick (até 2 min depois):
   - SELECT leads onde needs_ai_review=true AND manual_lock_until IS NULL
     ORDER BY ai_review_queued_at ASC LIMIT 30 (per clínica)
     FOR UPDATE SKIP LOCKED
   - Para cada lead:
     - SELECT messages.* últimas N (clinics.classifier_config.max_messages_per_extraction)
     - chama gpt-5-nano com tool_call extract_lead_fields(JSON Schema)
     - escreve leads.custom_fields = merge(atual, novos)
     - INSERT lead_ai_extraction_runs (cost_usd, confidence, fields_set)
     - UPDATE leads SET needs_ai_review=false

3) Cron field-rules-tick (até 2 min depois):
   - SELECT pipeline_field_rules onde enabled=true ORDER BY priority DESC
   - Para cada lead recente (updated_at >= now() - 24h):
       - se manual_lock_until > now() → skip
       - para cada regra (em ordem):
           - AND das condições passa?
           - sim → UPDATE leads SET stage_id = regra.target_stage_id
                   INSERT lead_stage_history (reason='field_rule:<nome>')
                   INSERT lead_events (type='stage_auto_moved')
                   break (primeira que casa vence)

4) Kanban frontend (realtime via supabase_realtime):
   - LeadCard escuta mudanças em leads
   - AIBadges re-renderiza com novos chips (qualificacao, procedimento, IA_na_fila…)
   - Card aparece na nova coluna
```

## 4. Exemplo real — Clínica ÓR

### 4.1 Cenário "feliz"

Lead Laura manda 4 mensagens contendo "quero fazer infusão de cetamina", "posso essa quinta?", manda áudio confirmando, manda comprovante PIX.

| Passo | Tabela | Campo | Valor antes | Valor depois |
|---|---|---|---|---|
| trigger SQL | `leads` | `needs_ai_review` | false | true |
| extractor | `leads.custom_fields` | `qualificacao` | — | `em_negociacao` |
| extractor | `leads.custom_fields` | `tipo_atendimento` | — | `sessao_cetamina` |
| extractor | `leads.custom_fields` | `procedimento_agendado_em` | — | `2026-06-19T14:00:00-03:00` |
| audio-tick | `messages.transcript` | — | NULL | "confirmo quinta às 14h" |
| vision-tick | `leads.custom_fields` | `pagamento_confirmado` | — | `true` |
| vision-tick | `leads.custom_fields` | `ultimo_comprovante` | — | `{method:"pix", amount_brl:2400, …}` |
| field-rules | `leads.stage_id` | — | "Qualificação" | "Procedimento Pago" |

Regra que casou (priority 170): `pagamento_confirmado=true AND tipo_atendimento IN [sessao_cetamina, sessao_emt]`.

### 4.2 Modos de falha observados na auditoria

| Sintoma | Causa | Onde corrigir |
|---|---|---|
| Lead Laís preso em Qualificação com `consulta_agendada_em=2024-07-10` | Extractor alucinou ano antigo. Regra `is_future` (priority 90) rejeita data passada. | System prompt do extractor: injetar `Hoje é {now()}` e proibir datas no passado. |
| Lead Milene com `status_consulta=agendada` mas sem `consulta_agendada_em` (só `data_horario`) | Extractor escreveu em campo legado. | Migrar para nome canônico (ver `CUSTOM_FIELDS_CONTRACT.md §3 normalização`). |
| Lead Marcelo (representante farmacêutico) entrou em "Qualificação" | Sem regra para `is_b2b=true`. Extractor tentou qualificar como paciente. | Adicionar regra prio 200: `is_b2b=true → Stakeholders`. Adicionar regex B2B no trigger SQL. |
| Lead com card sumido (em coluna arquivada) | Coluna `Administrativo`/`Paciente antigo` recebem leads via origem mas não há regra para tirar. | Tag `is_archive` (TODO) ou regra explícita por origem. |
| Lead atualizado há > 24h não move mesmo com regra casando | `field-rules-tick` ignora leads "frios" para reduzir custo SQL. | Configurável em `classifier_config.field_rules_max_age_hours` (TODO). |

## 5. Manual lock — o "freio de mão"

Quando humano edita campo via UI ou responde no chat:
- Frontend seta `leads.manual_lock_until = now() + clinics.classifier_config.manual_lock_minutes` (default 30 min).
- `extractor-tick` filtra `WHERE manual_lock_until IS NULL OR manual_lock_until <= now()` → não preenche.
- `field-rules-tick` filtra igual → não move.
- Chip 🔒 **Lock manual** aparece no `LeadCard`.

Volta automaticamente quando passa a janela.

## 6. Observabilidade

| Sintoma | Onde olhar |
|---|---|
| Lead não está sendo movido | `lead_stage_history` última row do lead. Se vazia há > 1h e há mensagem nova, ver §7. |
| Custo subindo sem motivo | `lead_ai_extraction_runs` agrupado por `kind` últimos 7 dias. |
| Extractor errando muito | `lead_ai_extraction_runs` onde `confidence < 0.5` últimos 7 dias. |
| Regra nunca dispara | `lead_events` onde `type='stage_auto_moved' AND payload->>'rule_name' = '<nome>'`. Se zero, regra nunca casou. |
| Manual lock travado | `leads` onde `manual_lock_until > now() + interval '1 hour'` (anomalia). |

UI de monitoramento: **Configurações → IA do Pipeline → Histórico & custos** (`src/components/settings/ExtractorHistoryCard.tsx`).

## 7. Checklist "lead não moveu"

Na ordem (primeira causa que casar resolve):

1. **`needs_ai_review=true`?** Se não, trigger SQL não detectou nada útil na mensagem. Ver regex em `database/FUNCTIONS_TRIGGERS.md`.
2. **`manual_lock_until > now()`?** Espere o lock expirar ou peça humano para "Retomar IA" no Lead Drawer.
3. **Há run recente em `lead_ai_extraction_runs`?** Se sim, custom_fields foi atualizado — pular para passo 5. Se não, ver §8.
4. **`updated_at < now() - 24h`?** Field-rules ignora leads frios. Atualize qualquer coisa no lead (mensagem, nota).
5. **As condições da regra batem com `custom_fields`?** Use a query da §8 para conferir.
6. **Há regra de maior prioridade movendo para outra coluna?** `SELECT * FROM pipeline_field_rules WHERE enabled ORDER BY priority DESC` — primeira que casa vence.
7. **`stage_id` já é o `target_stage_id`?** field-rules é no-op se já está lá.

## 8. Receitas de debug

### Ver últimas extrações de um lead
```bash
psql -c "SELECT created_at, kind, model, cost_usd, confidence, fields_set, error
         FROM lead_ai_extraction_runs WHERE lead_id='<uuid>'
         ORDER BY created_at DESC LIMIT 10;"
```

### Disparar tick manualmente
- UI: **Configurações → IA do Pipeline → Histórico & custos → Rodar texto/visão/áudio/regras agora**.
- Curl: `POST /functions/v1/extractor-tick` com header `apikey`.

### Resetar lock manual
```bash
psql -c "UPDATE leads SET manual_lock_until=NULL WHERE id='<uuid>';"
```

### Listar regras ativas e sua última execução
```bash
psql -c "SELECT name, priority, enabled,
         (SELECT count(*) FROM lead_events WHERE payload->>'rule_name' = pfr.name AND created_at > now()-interval '7 days') AS runs_7d
         FROM pipeline_field_rules pfr ORDER BY priority DESC;"
```

## 9. Melhorias sugeridas

- Detector de "lead preso há >48h em Qualificação com data preenchida" → task automática para revisar extração.
- Replay semanal: 20 leads movidos automaticamente são re-avaliados por um LLM-juiz para medir precisão das regras.
- Configurar `field_rules_max_age_hours` por clínica (hoje hard-coded em 24h).
- Normalização periódica de aliases legados (`data_horario → consulta_agendada_em`).

## 10. Arquivos-chave

- `supabase/functions/extractor-tick/index.ts` — extractor de texto (gpt-5-nano).
- `supabase/functions/vision-tick/index.ts` — análise de comprovantes (gpt-5-mini vision).
- `supabase/functions/audio-tick/index.ts` — transcrição (whisper-1).
- `supabase/functions/field-rules-tick/index.ts` — motor de movimentação (12 operadores).
- `src/components/settings/FieldRulesCard.tsx` — UI de CRUD de regras.
- `src/components/settings/ExtractorHistoryCard.tsx` — observabilidade.
- `src/components/kanban/AIBadges.tsx` — chips no LeadCard.
- `docs/maps/CUSTOM_FIELDS_CONTRACT.md` — contrato dos campos.
