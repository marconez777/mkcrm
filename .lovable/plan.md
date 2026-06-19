# Mover lead com interesse-sem-fechamento para "Nutrição inativa" + upgrade do Maestro

## Diagnóstico

No caso do Sérgio:
- Resumo (Agente 1) está correto: "informou estar sem cartão; último atendente respondeu que não consegue chegar a esse valor — agendamento não foi confirmado".
- Maestro sugeriu `stage="Qualificação"` (igual ao atual), `would_move=false`, `reason="strict_no_move"`.

Dois problemas:

1. **Prompt do Maestro** não tem regra para "interesse sem fechamento" → fica em Qualificação por inércia.
2. **apply.ts** está em **strict_no_move** — só B2B tem auto-move. Mesmo que o Maestro sugerisse "Nutrição inativa", o sistema não moveria.
3. **Maestro roda em `gpt-5-mini`** — é o agente mais "intelectual" do trio (decide stage/intent) e precisa de modelo superior.

> O stage real na ÓR é "Nutrição inativa" (posição 8) — é o que você chama de "nutrição de leads".

## O que ajustar

### 1. `agent-core.ts` — trocar modelo do Maestro

```ts
const MAESTRO_MODEL = "gpt-5";   // antes: "gpt-5-mini"
```

Resumidor e Tipificador continuam em `gpt-4o`/`gpt-5-mini` (são extratores; custo/latência importam mais lá).

### 2. `agent-core.ts` — refinar prompt do Maestro

- Reescrever descrição de **"Nutrição inativa"** cobrindo 2 casos:
  - (a) Lead sem retorno há muito tempo, **ou**
  - (b) Lead com interesse mas SEM fechamento de agendamento.
- Nova REGRA ESTRITA (texto literal do usuário):
  > Se o resumo indicar que o lead tem interesse no tratamento/consulta MAS o agendamento NÃO foi confirmado (objeção de preço, pediu desconto recusado, "vou pensar", sem cartão/dinheiro no momento, **parou de responder depois que a secretaria ou atendente IA informou o preço por mais de 4 horas**, etc.), use `stage="Nutrição inativa"` e `intent="objecao"` (ou `"desistencia"` se ele desistiu explicitamente). **NÃO deixe em "Qualificação" só por inércia.**

Para suportar a regra de "4h após o preço", incluir no bloco de sinais determinísticos enviado ao Maestro:
- `hours_since_last_message` (já temos `messages[-1].created_at` e `nowMs`).
- `last_message_from_attendant` (boolean: a última mensagem foi do atendente?).

Assim o Maestro tem o sinal numérico para aplicar o ">4h" com confiança.

### 3. `apply.ts` — auto-move guardado para "Nutrição inativa"

Espelhar o padrão do B2B:

- Toggle: `app_settings.automation.nurture_move.enabled`.
- Guards (todos obrigatórios):
  - `stage_suggestion === "Nutrição inativa"`
  - `intent ∈ {"objecao", "desistencia"}`
  - `confidence ≥ 0.8`
  - `ctx.hasBeenTreatedBefore === false`
  - `ctx.stageName ∈ {"Novo", "Qualificação"}` (não tira de agendamento/tratamento)
  - Sem stage move humano nas últimas 24h.
- Idempotência: `nurture:${leadId}:${lastMessageId}`.
- Reusa `pipelineMove(...)` com source `auto:classifier-nurture`.
- Telemetria: `stageOutcome.path = "nurture"`, `reason ∈ {nurture_move_applied, nurture_guard_failed:<lista>}`.

### 4. Banco — ligar a regra (global, igual ao B2B)

```sql
INSERT INTO app_settings (key, value) VALUES ('automation.nurture_move.enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
```

### 5. Validação

- Re-rodar `classifyOneV2` no lead do Sérgio (`dded43d5-…`), modo `full`.
- Conferir: Maestro retornou `stage_suggestion="Nutrição inativa"`, `intent="objecao"`, `confidence ≥ 0.8`; `apply` aplicou move (`path="nurture"`); lead saiu de "Qualificação" → "Nutrição inativa" no kanban.
- Conferir custo do Maestro com `gpt-5` (token usage no `lead_events.payload.agents`).

## Fora de escopo

- Sem mudanças em UI (PipelineRuns já mostra `path/reason`).
- Sem mexer em outros caminhos de move — strict_no_move segue para todos os demais stages.
- Sem UI de toggle — habilito direto via SQL.
