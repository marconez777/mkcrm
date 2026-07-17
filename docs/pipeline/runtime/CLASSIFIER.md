---
title: "Classifier LLM (pipeline-classify) — runtime V6 (5 Agentes)"
topic: kanban
kind: reference
audience: agent
updated: 2026-07-16
summary: "Edge function pipeline-classify V6: Linha de montagem de 5 agentes (Resumidor → [Agendador ∥ Tipificador ∥ Movimentador] → Maestro). Provedor padrão Lovable AI Gateway; OpenAI fallback. Inclui parser de datas, travas humanas (G10 + lock permanente de 'origem'), Nurture/General/B2B Move, regras de 1ª mensagem de anúncio e telemetria fina."

code_refs:
  - supabase/functions/pipeline-classify/index.ts
  - supabase/functions/pipeline-classify/schema.ts
  - supabase/functions/pipeline-classify/context.ts
  - supabase/functions/pipeline-classify/agent-core.ts
  - supabase/functions/pipeline-classify/date-parser.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-classify/rules/first-consult.ts
  - supabase/functions/pipeline-classify/rules/intent-effects.ts
  - supabase/functions/_shared/classifier-ai.ts
related_docs:
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
  - docs/pipeline/runtime/DATABASE_LIVE.md
  - .lovable/plan.md (Roadmap Tenant)
---

# Classifier `pipeline-classify` — V6 (5 Agentes)

> Reconstrução multi-step (junho/2026). Substitui o monolito V2 e a linha de 3 agentes (V5) por uma **Linha de Montagem de 5 Agentes** com fase paralela no meio.
>
> **Provider default (junho/2026):** `lovable` → Lovable AI Gateway com Gemini 2.5. OpenAI BYOK permanece como fallback de rollback (`CLASSIFIER_PROVIDER=openai`). Mapeamento (`agent-core.ts:142-150`):
>
> | Agente | Lovable (default) | OpenAI (legado/BYOK) |
> |---|---|---|
> | Resumidor | `google/gemini-2.5-flash` | `gpt-4o` |
> | Resumidor (fallback) | `google/gemini-2.5-flash-lite` | `gpt-5-mini` |
> | Agendador | `google/gemini-2.5-flash-lite` | `gpt-5-nano` |
> | Tipificador | `google/gemini-2.5-flash` | `gpt-5-mini` |
> | Movimentador | `google/gemini-2.5-flash-lite` | `gpt-5-nano` |
> | Maestro | `google/gemini-2.5-flash` | `gpt-5` |
>
> ```text
>          Resumidor
>              │
>              ▼
>   ┌──────────────────────────────────────────┐
>   │ Agendador ∥ Tipificador ∥ Movimentador   │
>   │ Promise.all — 3 chamadas concorrentes    │
>   └──────────────────────────────────────────┘
>              │
>              ▼
>          Maestro (veredicto final)
> ```
>
> **Tolerância a falhas e Fallbacks**: 
> 1. Se `schema validation` falhar (modelo gerou lixo ao invés de tool_call), o core dispara um `json_fallback` compacto (texto) em uma segunda tentativa.
> 2. Rate limits (429) disparam *backoff* exponencial intra-requisição (200, 400, 800, 1600ms com jitter).
> 3. Falhas de `quota` inserem um bloqueio de 30 minutos no `pipeline_provider_health` e forçam o failover para a API secundária (Lovable ↔ OpenAI).

## Resumo

| | |
|---|---|
| Entry | `supabase/functions/pipeline-classify/index.ts` |
| Provider | `lovable` (default) → Lovable AI Gateway / Gemini; `openai` (rollback). Controlado via `_shared/classifier-ai.ts`. |
| Chamadas LLM por execução | até **5** (3 fases: serial → paralela → serial) |
| Cron | `pipeline-classify-tick` — `* * * * *` |
| Toggle global | `automation.classifier.enabled` |
| Telemetria | `lead_events.type='auto:classifier'` com `payload.version=3` (envelope V6) — ver `EVENTS_TELEMETRY.md` |
| Operations em `ai_usage` | `classifier:summarizer`, `classifier:agendador`, `classifier:typifier`, `classifier:movimentador`, `classifier:maestro` (1 row por agente por execução) |

---

## Schemas e Comportamento dos Agentes (`schema.ts` e `agent-core.ts`)

A saída é dividida refletindo os 5 Agentes:

### Agente 1 — Resumidor
Gera o `summary` (max 1600 chars) e extrai textos literais de `mentioned_dates` sem converter nada.
**Regra Crítica (Primeira Mensagem)**: Se a flag `PRIMEIRA_MENSAGEM_TEMPLATE: true` estiver no contexto (mensagem vinda de anúncios ou botões pré-fabricados), o resumidor ignora intenções e foca em reportar que o lead entrou, extraindo apenas a "origem".

### Agente 2a — Agendador (Paralelo)
Avalia sinais de agenda: `is_scheduling_action` e `scheduling_intent` (novo_agendamento, reagendamento, cancelamento). Foca em intenção, deixando o parsing de data para a edge determinística.

### Agente 2b — Tipificador (Paralelo)
Sereve para marcar *Tags* (obedecendo a whitelist dinâmica) e preencher *Custom Fields*.
**Lock Humano (Origem)**: É instruído a nunca sobrescrever o campo `origem` se já preenchido, pois isso bagunça atribuição de marketing. 
Retorna `tags_suggested` e `custom_fields_patch`.

### Agente 2c — Movimentador (Paralelo)
Avalia `stage_suggestion` baseando-se em `signals` (stage atual, idade da conversa, tratamentos prévios).
É bloqueado pela IA deugerir estágios de agendamento (Transição Junho/2026). Retorna `stage_suggestion`, `intent`, `is_b2b`.

### Agente 3 — Maestro
Recebe os resumos e os 3 JSONs gerados no passo paralelo e unifica tudo num veredicto final. Resolve disputas (ex: Movimentador mandou avançar mas o Agendador notou desistência → O Maestro sobrepõe).
Se a confiança combinada for muito baixa, ele devolve com `confidence < 0.6`, o que previne qualquer movimento real de funil.

---

## Datas — extração + parser determinístico
O LLM **NUNCA converte data**. O `date-parser.ts` chama `parseFutureDateInTZ` e gera datas padronizadas em ISO UTC.

---

## Proteções de Banco de Dados: Gate 10 e Sticky Human Fields

1. **Gate G10 (Custom Fields recentes)**: Se um humano alterou um *custom_field* nos últimos 7 dias (marcado via trigger `track_custom_fields_human_edits`), a IA não sobrescreve a chave. Registra em `blocked_by_g10`. Única exceção: datas (se o lead enviou a data explicitamente com alta confiança).
2. **Sticky Human Fields**: Alguns campos, como `origem`, têm **Lock Permanente**. Independente da janela de 7 dias, se o humano digitou, a IA é proibida de tocar para o resto da vida do lead. Rejeições geram o motivo `sticky_human_field_locked`.
3. **RPC `apply_lead_automation_patch`**: Usada pelo V6 para bypassar triggers quando a IA escreve, usando `app.actor='system'`.

---

## Leitura e Frequência do Classifier (`index.ts` e `context.ts`)
A orquestração exata do ciclo de vida define quando e o que o Classifier lê:
1. **Os Triggers do Postgres:** Sempre que a Clínica recebe uma mensagem de um lead (`from_me = false`), um trigger no banco de dados (`tg_auto_secretary_replied`, `tg_auto_novo_lead` etc.) imediatamente seta a coluna `leads.needs_ai_review = true` e marca o timestamp `ai_review_queued_at = now() + interval '5 minutos'`.
2. **O Cron Job (Frequência):** A Edge Function `pipeline-classify-tick` roda religiosamente **a cada 1 minuto** via `pg_cron`.
3. **Dispatcher (`index.ts`):** O dispatcher coleta até 50 leads que tenham `needs_ai_review = true` e cujo `ai_review_queued_at` já tenha passado. Ele usa chamadas **concorrentes** para não atrasar a fila.
4. **Advisory Lock & Watermark (`context.ts`):**
   - Um *Advisory Lock* (`try_classify_lock`) impede que a mesma conversa seja lida por dois ticks paralelos.
   - O sistema de *Watermark* checa `last_processed_message_id_classifier`. Se não houver mensagens mais recentes que a marca d'água, o agente **aborta imediatamente** (economizando tokens).
5. **O que ele lê:** O `context.ts` resgata:
   - As últimas **30 mensagens** trocadas.
   - O histórico recente de estágios (`recentStageHistory`).
   - O resumo atual (`ai_summary`).
   - Campos e Tags.
   - **Template Detection:** Se a conversa possui apenas uma única mensagem recebida e contém frases clichês ("Gostaria de agendar", "Vim pelo anúncio"), o sistema marca `PRIMEIRA_MENSAGEM_TEMPLATE = true`. Isso avisa ao LLM para não disparar intenções erradas e apenas extrair a origem da mensagem.
6. **Backoff Escalonado:** Se o agente falhar (timeout na OpenAI/Lovable, por exemplo), um *Backoff* atrasa a próxima tentativa: 1ª falha = 2 min; 2ª falha = 5 min; ≥3 falhas = 30 min. O lead nunca some, apenas espera sua vez.

---

## Movimentações e Auto-Move (`apply.ts` e os Triggers)

O foco central da dor de cabeça em movimentos automatizados mora na comunicação entre a Inteligência e as Travas (`Gates`) do `apply.ts`. Toda sugestão de movimento passa por regras *Strict No-Move*:

### O Caminho do General Move (Maestro)
Se o Maestro sugerir um novo estágio, a decisão será barrada se:
- **Conflito Humano 24h:** O sistema checa se a secretária/atendente moveu o lead manualmente nas últimas 24 horas. Se sim, **bloqueio imediato**. A IA não deve brigar com o humano.
- **Estágios Restritos:** A IA jamais pode mover leads para "Consulta agendada" ou estágios de fechamento. Esses estão na lista de `HUMAN_SCHEDULING_STAGES`. Se o Maestro tentar, o move falha com o erro `ai_scheduling_disabled_by_human_transition`.
- **Baixa Confiança:** Apenas veredictos com `confidence >= 0.8` autorizam o general move.
- **Lock D3 ("Paciente Antigo"):** Se o lead estiver no estágio "Paciente antigo", o Classifier **nem tenta** sugerir movimentações. Ele continua lendo a conversa para extrair tags, mas não altera o estágio.

### O Caminho do Nurture Move (Nutrição Inativa)
Muitos leads desistem antes mesmo de serem agendados. O Agente tem um *bypass* caso a clínica permita:
- Se a intenção detectada for *objeção* ou *desistência* com `confidence >= 0.8`.
- Se o estágio de onde ele está partindo for inicial ("Novo" ou "Qualificação").
- E **jamais** se ele já tiver histórico de tratamento (ele não pode ir pra Nutrição Inativa se já for Paciente Antigo).

> **Atenção aos Triggers vs. Apply.ts:** Se a movimentação do `apply.ts` falha silenciosamente (o lead não avança no kanban, mas as tags são aplicadas), quase sempre é o **Conflito Humano de 24h** atuando, ou o Estágio que foi sugerido mudou de nome no banco (`pipeline_stages.name`) e a IA não conseguiu achar o ID pelo nome correto. Observe sempre os Logs em `ai_usage` e `pipeline_run_items` sob o código `general_guard_failed`.

---

## Regra "1ª consulta"
`rules/first-consult.ts::evaluateFirstConsult` bloqueia a tag quando:
- Idade do lead > 90 dias
- Já passou por estágio tratado
- Possui tag `paciente_antigo`
- O `ai_summary` cita tratamento anterior.
Se o Maestro sugeri-la erroneamente, o `apply.ts` limpa-a deterministicamente.

---

## Arquitetura Multi-Tenant (Implementada em Julho/2026)
A arquitetura monolítica V6 (focada na Clínica ÓR) evoluiu para um sistema dinâmico gerido pela tabela `pipeline_tenant_classifiers`. Isso permite que diferentes instâncias (clínicas) tenham seus próprios prompts e gatilhos de agentes injetados dinamicamente no runtime via banco de dados:
- **`context.ts`**: Consulta o banco e insere os dados da tabela em `LeadContext.tenant`.
- **`agent-core.ts`**: Faz injeção dos dados do tenant usando substituições como `{{TAG_LIST}}`, `{{KEYS_BLOCK}}`, `{{CANON_NAMES}}` e `{{INTENT_VALUES}}`, com fallback para os prompts V6 originais.
- **`schema.ts`**: As regras de normalização de intenções recebem dinamicamente os `allowedIntents` do tenant atual.
A Clínica ÓR agora usa as configurações de backup salvas no banco (via Seed) como garantia de que o comportamento padrão de estabilidade (V6 original) seja respeitado.
