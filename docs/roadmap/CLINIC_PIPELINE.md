---
title: Roadmap — Pipeline Clínica + Agentes IA
topic: roadmap
kind: roadmap
audience: agent
updated: 2026-06-11
summary: "Roadmap v5 (aprovado) do pipeline da clínica: 2 agentes IA (texto + visão) + Whisper para áudio, BYOK OpenAI por clínica, regras SQL pré-IA para reduzir custo, e desqualificação automática para procedimentos não atendidos (EMDR e similares)."
code_refs:
  - supabase/functions/
  - src/pages/automations/
  - src/components/leads/
related_docs:
  - docs/maps/AI.md
  - docs/MAP.md
---

# Roadmap — Pipeline Clínica + Agentes IA (v5)

> Status: **F0 entregue (parcial)**. Próximo passo: F1 (trigger SQL + 4 automações rule-based).
> F0 entregou: migrations (colunas + `clinic_secrets` + `lead_ai_extraction_runs` + `get_openai_key`/`get_clinic_openai_status`), edge function `clinic-openai-key` (status/set/test/clear) e aba "IA do Pipeline" em `/settings` com card de chave OpenAI BYOK.
>
> **Nota de implementação**: pgsodium foi deprecado pelo Supabase. F0 usa o padrão atual recomendado para BYOK: tabela `clinic_secrets` sem GRANTs para `anon`/`authenticated` (apenas `service_role`), chave em coluna `text`, leitura via função SECURITY DEFINER `public.get_openai_key(clinic_id)` e edge function que valida com a OpenAI antes de persistir. Disco do Supabase é criptografado at-rest. Migração futura para Vault possível sem mudança de API.

## 1. Visão geral

O pipeline da clínica tem 6 colunas conceituais:
**Entrada → Qualificação → Consulta Agendada → Tratamento Agendado → Concluído → Desqualificado**.

A automação combina **3 camadas** em ordem de custo crescente:

1. **SQL/regex (custo zero)** — trigger em `messages` detecta palavras-chave PT-BR e marca `leads.needs_ai_review = true` com motivos. Nunca chama IA.
2. **Agente extrator de texto (OpenAI BYOK)** — cron lê leads marcados, preenche custom fields vazios, respeita edição humana, custo previsível.
3. **Agente de visão + Whisper de áudio (OpenAI BYOK)** — só quando há `media_url` (comprovante) ou áudio relevante.

A **fonte de verdade** é o conjunto de custom fields do lead (qualificação, procedimento, pagamento, data agendada, etc.). Movimentação de coluna deriva desses campos via `pipeline_field_rules` (crawl).

## 2. Decisões fechadas

| # | Tema | Decisão |
|---|---|---|
| 1 | Chave OpenAI | **BYOK por clínica** — cada clínica configura a sua na UI |
| 2 | Edição humana | IA **respeita** edição manual recente — janela `manual_lock_minutes` (default 30) |
| 3 | Áudio | **Whisper-1** (mais barato, ~$0.006/min) |
| 4 | Storage da chave | `clinic_secrets` com **pgsodium** (`crypto_aead_det_encrypt`), RLS service_role-only |
| 5 | Sobrescrita IA | Permitida quando `confidence ≥ threshold` (default 0.7) **e** fora da janela de manual_lock |
| 6 | Comprovante/áudio ilegível | Cria **tarefa pra humano** no board Financeiro/Atendimento |
| 7 | Limites de uso | **Configuráveis na UI** por clínica (max msgs/extração, extrações/dia, budget diário) |
| 8 | Regex schedule | **PT-BR somente** |
| 9 | Procedimentos atendidos | Infusão de Cetamina · EMT · Primeira Consulta · Consulta de seguimento · Retorno · Sessão de terapia |
| 10 | **EMDR e demais não-atendidos** | Se aparecer na conversa, o extrator marca `qualificacao = desqualificado` com `reason = "procedimento não oferecido: <nome>"`. Sem follow-up de IA, sem mover pra agendamento. |

## 3. Arquitetura

### 3.1 Source of truth
Os custom fields do lead. Nada de regra de negócio dependendo de "qual coluna o card está". A coluna é **derivada**.

### 3.2 4 camadas

```text
            ┌──────────────────────────────────────────────────┐
            │  messages (insert)                               │
            │   └─► trg_lead_needs_extraction (SQL, custo 0)   │
            │        ├─ keywords PT-BR por procedimento        │
            │        ├─ keywords interesse / pagamento / data  │
            │        └─ marca lead.needs_ai_review + reasons[] │
            └────────────────┬─────────────────────────────────┘
                             │
        ┌────────────────────┼──────────────────────┐
        ▼                    ▼                      ▼
 extractor-tick        vision-tick             audio-tick
  (cron 10 min)        (cron 10 min)           (cron 5 min)
   OpenAI texto         OpenAI visão            Whisper-1
   gpt-5-nano           gpt-5-mini              (PT-BR + glossário)
   preenche fields      lê comprovantes         transcreve áudio
   respeita lock        atualiza pagamento      grava em messages.transcript
        │                    │                      │
        └────────────────────┴──────────────────────┘
                             ▼
                  automations-tick (cron)
                  branch: field_rules_crawl
                   move card entre colunas
                   conforme pipeline_field_rules
```

### 3.3 Desqualificação (EMDR & cia)

```text
mensagem contém "emdr" | "dessensibilização e reprocessamento" | ...
   └─► trigger marca needs_ai_review + reason "proc_nao_atendido:emdr"
       └─► extractor preenche qualificacao=desqualificado
              + ai_review_reasons += "proc_nao_atendido:emdr"
              └─► field_rules_crawl move card pra coluna Desqualificado
```

Sem follow-up. Sem tentativa de agendar. Opcional: cria tarefa "Confirmar desqualificação por EMDR" no board Atendimento.

## 4. Modelos & custos (OpenAI BYOK)

| Camada | Modelo padrão | Custo estimado | Onde |
|---|---|---|---|
| Texto extrator | `gpt-5-nano` (fallback `gpt-4o-mini`) | ~$0.0005/lead/ciclo | `extractor-tick` |
| Visão (comprovante) | `gpt-5-mini` (fallback `gpt-4o`) | ~$0.002/imagem | `vision-tick` |
| Áudio | `whisper-1` | $0.006/min | `audio-tick` |

Estimativa por clínica média (200 leads/dia, 30% precisam IA, 10% têm comprovante, 5% áudio de 30s):
**~$0.40/dia** texto + **~$0.04/dia** visão + **~$0.03/dia** áudio = **< $0.50/dia/clínica**.

Limites duros configuráveis (defaults):
- `max_messages_per_extraction: 8`
- `max_extractions_per_lead_per_day: 3`
- `daily_budget_extractions: 200`
- `max_vision_per_lead: 3`
- `daily_budget_vision: 50`
- `daily_budget_audio_minutes: 60`

## 5. Database (F0)

### Colunas novas
- `messages`: `is_automated bool`, `vision_processed bool`, `needs_audio_transcription bool`, `transcript text`, `transcript_status text`, `transcript_cost_usd numeric`
- `leads`: `needs_ai_review bool`, `ai_review_reasons text[]`, `ai_review_queued_at timestamptz`, `manual_lock_until timestamptz`
- `clinics`: `classifier_config jsonb` (limites, threshold, manual_lock_minutes, openai_status)
- `lead_stage_history`: `reason text`

### Tabelas novas
- `clinic_secrets` (`clinic_id pk`, `openai_api_key_encrypted bytea`, `key_id uuid`, `updated_at`) — pgsodium, service_role only
- `lead_ai_extraction_runs` (`id`, `lead_id`, `kind` enum `text|vision|audio`, `model`, `tokens_in`, `tokens_out`, `cost_usd`, `fields_set jsonb`, `confidence numeric`, `message_id`, `created_at`)
- `pipeline_field_rules` (já planejada na v3, mantida)

### Segurança da chave OpenAI
- `pgsodium.crypto_aead_det_encrypt` com `key_id` por clínica
- RLS revoga `anon`/`authenticated`; só `service_role`
- Função `public.get_openai_key(clinic_id)` SECURITY DEFINER, retorna texto em runtime apenas pra edge functions
- UI nunca exibe a chave — só `configured | empty | invalid` + últimos 4 chars
- Health-check diário; se inválida → `classifier_config.openai_status='invalid'` + banner na UI

## 6. Edge functions

| Função | Tipo | Frequência | Responsabilidade |
|---|---|---|---|
| `trg_lead_needs_extraction` | trigger SQL | on insert `messages` | regex PT-BR, marca lead |
| `extractor-tick` | cron | 10 min | batch de até 30 leads/clínica, preenche custom fields |
| `vision-tick` | cron | 10 min | lê `media_url` de comprovantes, atualiza pagamento |
| `audio-tick` | cron | 5 min | Whisper transcript, grava em `messages.transcript` |
| `automations-tick` (já existe) | cron | 1 min | + nova branch `field_rules_crawl` |

## 7. Keywords PT-BR (por procedimento)

```ts
// supabase/functions/_shared/clinic-keywords.ts (a criar)
PROCEDURE_REGEX = {
  cetamina:    /\b(cetamina|ketamina|infus[ãa]o)\b/i,
  emt:         /\b(emt|estimul[aã]?[cç][aã]o magn[ée]tica transcraniana)\b/i,
  primeira:    /\b(primeira consulta|avalia[çc][ãa]o inicial)\b/i,
  retorno:     /\b(retorno|reavalia[çc][ãa]o)\b/i,
  seguimento:  /\b(seguimento|acompanhamento)\b/i,
  terapia:     /\b(terapia|psicoterapia|sess[ãa]o)\b/i,
};

// LISTA DE BLOQUEIO — gera desqualificação
PROC_NAO_ATENDIDO_REGEX = /\b(emdr|dessensibiliza[çc][ãa]o e reprocessamento|reprocessamento dos movimentos? oculares?)\b/i;

INTEREST_REGEX = /\b(quero|tenho interesse|gostaria|posso fazer|me interesso)\b/i;
PAYMENT_REGEX  = /\b(pix|comprovante|pagamento|transferi|pagar|boleto)\b/i;
SCHEDULE_REGEX = /\b(agendar|marcar|hor[aá]rio|dispon[ií]vel|amanh[ãa]|semana que vem|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|\d{1,2}[\/\-]\d{1,2})\b/i;
```

Glossário Whisper (passado no prompt do transcribe):
`"EMT, cetamina, ketamina, infusão, transcraniana, psiquiatria, retorno"`.

## 8. UI — `/settings/ai-pipeline` (6 abas)

1. **Chave OpenAI** — input write-only, botão "Testar conexão", status visível (`configured | invalid | empty`), últimos 4 chars
2. **Extrator de texto** — threshold de confiança, max msgs/extração, max extrações/dia, budget diário, toggle "permitir sobrescrever campo preenchido"
3. **Visão** — toggles por tipo (comprovante), max/lead, budget diário
4. **Áudio** — toggle Whisper on/off, max minutos/dia, glossário customizável
5. **Palavras-chave** — read-only (inclui lista de bloqueio EMDR), com link "sugerir nova"
6. **Histórico & custos** — tabela de `lead_ai_extraction_runs` últimos 7 dias, custo/dia, custo/lead

Banner global se `openai_status='invalid'`.

## 9. Movimentação por campo (crawl)

`pipeline_field_rules`:
```text
(clinic_id, field_name, field_value, target_stage_id, min_field_age_minutes default 15)
```

Exemplos:
- `qualificacao = desqualificado` → coluna Desqualificado
- `consulta_agendada_em IS NOT NULL` → coluna Consulta Agendada
- `pagamento = confirmado` AND `procedimento != null` → Tratamento Agendado

UI em `/automations` aba "Coluna".

## 10. Erros & tarefas humanas

| Cenário | Ação |
|---|---|
| Comprovante ilegível (visão `confidence < 0.5`) | Tarefa "Conferir comprovante" no board Financeiro |
| Áudio falha 2× | Tarefa "Transcrever áudio manualmente" no Atendimento |
| Chave OpenAI inválida | Banner + agentes pausam, registra em `error_events` |
| Procedimento não oferecido detectado | (opcional) tarefa "Confirmar desqualificação por <proc>" |
| Lead bate `daily_budget` | Ignora silenciosamente, registra em `lead_ai_extraction_runs` (kind=skipped) |

## 11. Observabilidade

- `/metrics` (admin): custo/dia, custo/lead, % preenchimento por IA, taxa de sobrescrita, % desqualificados por procedimento não oferecido
- Chips no card do Kanban:
  - 🤖 mensagem da IA enviada
  - 👁️ visão processou comprovante
  - 🎧 áudio transcrito
  - 🚫 desqualificado por procedimento não atendido

## 12. Fragilidades & mitigações

| # | Cenário | Mitigação |
|---|---|---|
| F1 | Cliente esgota chave OpenAI | Health-check diário, banner, pausa agentes |
| F2 | Cliente edita campo e IA sobrescreve | `manual_lock_until = now() + manual_lock_minutes`; IA ignora |
| F3 | Mesma mensagem dispara várias extrações | `lead_ai_extraction_runs` dedup por `(lead_id, message_id, kind)` |
| F4 | Comprovante adulterado / borrado | confidence + tarefa humana |
| F5 | Áudio muito longo (>5 min) | Recusa, cria tarefa |
| F6 | EMDR mencionado em "não fazemos EMDR" pelo atendente | Trigger só dispara em `messages.direction='inbound'` |
| F7 | Lead manda "quero fazer EMT" mas paciente confundiu com EMDR | Humano confirma na tarefa opcional |
| F8 | Regex PT-BR falha em gírias | Logs em `ai_review_queued_at IS NULL AND inbound > 3` para tuning |
| F9 | pgsodium key perdida | Backup da `key_id` em secret runtime; rotação documentada |
| F10 | OpenAI muda preço | `classifier_config.price_overrides jsonb` |
| F11 | Spam que dispara keywords | Rate-limit por `phone` antes de marcar |
| F12 | Agente preenche campo errado e fecha conversa | Toda escrita IA é reversível; histórico em `lead_ai_extraction_runs` |
| F13 | Duas mensagens chegam ao mesmo tempo, dois ticks rodam | `SELECT ... FOR UPDATE SKIP LOCKED` no batch |
| F14 | Tradução errada PT-BR (acento) | Regex sempre com `[ãa]`, `[çc]`, `[ée]` |
| F15 | Custo explode em massa | `daily_budget_*` corta antes de chamar OpenAI |

## 13. Fases

| Fase | Entregas |
|---|---|
| **F0** | Migrations (colunas + 2 tabelas + pgsodium + RLS) · UI "Chave OpenAI" funcional · este roadmap doc |
| **F1** | Trigger SQL `trg_lead_needs_extraction` + 4 automações rule-based + lógica EMDR/desqualifica |
| **F2** | Edge function `extractor-tick` + UI completa (6 abas) + histórico/custos |
| **F3** | Edge function `vision-tick` + fallback tarefa humana |
| **F4** | Edge function `audio-tick` (Whisper) + transcript renderizado no chat |
| **F5** | `pipeline_field_rules` crawl + UI em `/automations` aba Coluna |
| **F6** | Observabilidade (`/metrics`) + chips no Kanban + `docs-sync` |

## 14. Changelog

- **2026-06-11 (v5)** — Consolidado: BYOK OpenAI, Whisper, EMDR → desqualificado, manual_lock, limites configuráveis na UI.
- v4 — Separação em 2 agentes (texto + visão) com keywords SQL antes.
- v3 — `pipeline_field_rules` introduzido.
- v2 — Source of truth migrado pra custom fields.
- v1 — Proposta inicial com IA em todas as colunas (rejeitada por complexidade/custo).
