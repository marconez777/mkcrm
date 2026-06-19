## V3 — Pipeline de 3 agentes em `pipeline-classify`

Plano aprovado em linhas gerais, mas com **2 ajustes técnicos obrigatórios** antes de codar — senão a refatoração quebra extração de datas e custa caro à toa.

---

### ⚠️ Ponto de atenção 1 — Datas precisam ficar no Agente 1, não no 2

No V2, `mentioned_dates` carrega `{ raw, anchor_iso, kind }`, onde `anchor_iso` é o **timestamp ISO da mensagem que cita a data**. Esse anchor é o que o `date-parser.ts` (`parseFutureDateInTZ`) usa para resolver "amanhã às 15h", "quinta", etc. de forma determinística.

Se movermos `mentioned_dates` para o Agente 2 (Tipificador) — que só recebe o **resumo em prosa** do Agente 1 —, perdemos os timestamps por mensagem e o parser de datas para de funcionar (ou passa a chutar anchor = "agora", causando datas erradas).

**Correção:** O Agente 1 deixa de retornar `string` pura e passa a retornar um objeto:
```ts
{ summary: string; mentioned_dates: Array<{raw, anchor_iso, kind}> }
```
O resumo (texto) alimenta Agentes 2 e 3. As `mentioned_dates` saem direto do Agente 1 para o output final (passam batido pelo Agente 2). É o único agente que enxerga `formatMessages(ctx.messages)` com timestamps por linha — então é o único que pode produzir `anchor_iso` válido.

### ⚠️ Ponto de atenção 2 — Modelo do Agente 1

A chave OpenAI é **BYOK por clínica** (`clinic_secrets.openai_api_key`, via `getClinicOpenAI`). `gpt-4o` é acessível pelo endpoint OpenAI padrão, então funciona. Mas:
- Custo: 3 chamadas LLM por lead em vez de 1 (~3-4× mais caro). Aceito explicitamente?
- Fallback: se `gpt-4o` der 404/model-not-allowed (chave da clínica sem acesso), cair para `gpt-5-mini` no Agente 1 e logar `agent1_fallback_to_mini` em telemetria. Sem fallback silencioso para o V2 monolítico.

---

## FASE 1 — `schema.ts`

1. Adicionar `"agendamento_retorno"` em `INTENT_VALUES` (entre `"reagendamento"` e `"duvida_geral"`).
2. Criar três sub-schemas Zod:
   - `SummarizerOutputSchema` → `{ summary: z.string().max(1200), mentioned_dates: z.array(...).max(4) }`
   - `TypifierOutputSchema` → `{ tags_suggested, custom_fields_patch }` (sem stage/intent)
   - `MaestroOutputSchema` → `{ stage_suggestion, intent, is_b2b, confidence, reasons, mentioned_intents }`
3. Manter `ClassificationSchemaV2` + `normalizeClassification` (são o **contrato de saída** consumido por `apply.ts` — não mexer).
4. Adicionar helper `mergeV3Outputs(s1, s2, s3): ClassificationV2` para a Fase 3.

## FASE 2 — `agent-core.ts`

Substituir `runAgent` por orquestração sequencial. Cada passo usa `generateText` + `Output.object` com seu sub-schema:

| Passo | Modelo | Input | Output |
|---|---|---|---|
| 1. Resumidor | `gpt-4o` (fallback `gpt-5-mini`) | `buildContextBlock(ctx)` + `formatMessages(ctx.messages)` | `{summary, mentioned_dates}` |
| 2. Tipificador | `gpt-5-mini` | `buildContextBlock(ctx)` (tags/cf atuais) + `summary` do passo 1 | `{tags_suggested, custom_fields_patch}` |
| 3. Maestro | `gpt-5-mini` | `summary` + saída do passo 2 + `stageName`/`hasBeenTreatedBefore` do ctx | `{stage_suggestion, intent, is_b2b, confidence, reasons, mentioned_intents}` |

Detalhes:
- Tratamento de erro por passo: se qualquer um falhar, `return { error: "agent_step{N}_failed:<msg>" }`. O caller (`index.ts`) já trata `agent_error:*` limpando a flag (fix recente).
- Remover a tool `get_lead_history` (`historyToolEnabled`) — Agente 1 já tem o histórico cru; Agentes 2 e 3 não devem voltar a ler mensagens. Manter a flag no parâmetro por compat, mas ignorar.
- Prompts do Agente 3 com as regras estritas do usuário:
  - `agendamento_retorno` quando paciente já tratado/com histórico está marcando próxima consulta → stage `Consulta agendada`.
  - `Paciente antigo` só se: alta clínica explícita, ciclo encerrado, OU inativo > 6 meses retomando contato. (Esses sinais vêm de `hasBeenTreatedBefore`, `recentStageHistory`, `firstMessageAt`/`nowMs` no ctx — passar pro prompt como flags booleanas, não pedir pro LLM inferir.)
- `confidence` continua vindo só do Maestro.

## FASE 3 — Merge e contrato

```ts
return {
  classification: mergeV3Outputs(s1, s2, s3), // ClassificationV2 normalizado
  usage: { agent1: u1, agent2: u2, agent3: u3 },
};
```

- `mentioned_dates` ← Agente 1 (com anchor real).
- `tags_suggested`, `custom_fields_patch` ← Agente 2.
- `stage_suggestion`, `intent`, `is_b2b`, `confidence`, `reasons`, `mentioned_intents` ← Agente 3.
- Passar pelo `normalizeClassification` existente (coerção Canon/intent + defaults) antes de devolver.

## FASE 4 — Telemetria + docs (não pedido, mas necessário)

- Em `apply.ts`, no payload `auto:classifier`, bumpar `payload.version = 3` e adicionar `payload.agents = { summarizer_model, typifier_model, maestro_model, summary_chars }`.
- Atualizar `docs/pipeline/runtime/CLASSIFIER.md` com a arquitetura nova (substituir seção "Schema do agente" e "Datas").
- Nota em `docs/pipeline/runtime/KNOWN_ISSUES.md`: V3 multiplica custo OpenAI por ~3 e exige chave da clínica com acesso a `gpt-4o`.

## Deploy & validação

1. `supabase--deploy_edge_functions` em `pipeline-classify`.
2. Smoke V3 forçado em 3-5 leads com casos conhecidos de alucinação (o do paciente que recusou tratamento, ex.). Verificar `lead_events.payload.version=3` e `reasons` coerentes.
3. Monitorar `pipeline_classifier_skips` por `agent_step{1,2,3}_failed:*` na primeira hora.
4. Comparar tags/stage gerados antes vs depois nos mesmos leads.

## Fora de escopo

- Não alterar `apply.ts` (orquestração, gates G10, strict no-move, B2B) — só telemetria.
- Não mexer em `date-parser.ts`, `rules/*`, `index.ts` (dispatcher v1/v2).
- Não tocar UI.

---

**Confirma os 2 pontos de atenção?**
- (1) Agente 1 retorna `{summary, mentioned_dates}` em vez de só string — ok?
- (2) Aceita o custo ~3× e o fallback `gpt-4o → gpt-5-mini` quando a clínica não tem acesso?

Se sim em ambos, sigo direto para implementar quando passarmos para build mode.
