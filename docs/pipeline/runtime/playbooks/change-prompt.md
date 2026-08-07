---
title: "Playbook — Alterar o prompt de um agente"
topic: kanban
kind: howto
audience: agent
updated: 2026-08-07
summary: "Onde cada agente decide o quê, o que muda junto com o prompt, e por que o Maestro pode desfazer o trabalho dos especialistas."
related_docs:
  - docs/pipeline/runtime/CLASSIFIER.md
---

# Playbook — Alterar prompt de agente

## Quem decide o quê

```
Resumidor (gpt-4o → fallback gpt-5-mini)
   ↓ summary + mentioned_dates
   ├── Agendador     (gpt-5-mini) → intenção de agenda
   ├── Preenchedor   (gpt-5-mini) → tags + campos
   └── Movimentador  (gpt-5-mini) → stage + intent
                     ↓  (Promise.all)
              Maestro (gpt-5) → veredicto final
```

⚠️ **Só a saída do Maestro é aplicada.** `mergeV6Outputs` pega `stage_suggestion`, `intent`,
`tags_suggested`, `custom_fields_patch`, `is_b2b` e `confidence` **do Maestro** — as opiniões
dos três especialistas são só entrada do prompt dele. Se o Maestro omitir uma tag que o
Preenchedor sugeriu, a tag não é aplicada (e com `tag_replace` ligado, é **removida**).

Única exceção: `mentioned_dates` vem do **Resumidor**, direto, sem passar pelo Maestro.

## Antes de editar

| Se você vai mudar… | Mude junto |
|---|---|
| Um valor de enum no prompt | O schema Zod correspondente em `schema.ts` |
| A lista de stages sugeríveis | `CANON_NAMES` **e** `type Canon` — `normalizeClassification` coage o que não estiver lá para `"Qualificação"`, **em silêncio** |
| A lista de intents | `INTENT_VALUES` — desconhecido vira `"outro"`, em silêncio |
| Chaves que o Preenchedor pode escrever | ⚠️ **Não edite o prompt.** A lista é gerada em runtime de `lead_custom_fields` (`describeFieldType`). Cadastre o campo — ver [`add-custom-field.md`](./add-custom-field.md). `FALLBACK_TYPIFIER_KEYS` só vale se a clínica não tiver definição nenhuma |
| Regra de tags | A whitelist `automation.v42.allowed_tags` e/ou `PROTECTED_TAGS` |
| Comportamento do Maestro | Verifique se não contradiz `HUMAN_SCHEDULING_STAGES` — ele pode sugerir o que quiser, mas o `apply.ts` rejeita |

## A armadilha do G9

Os schemas usam `z.string()` relaxado de propósito (`gpt-5-mini` recusa enums profundos). Não
existe rejeição: `normalizeClassification` **coage silenciosamente**. Um stage alucinado vira
`"Qualificação"` e fica indistinguível de um acerto na telemetria.

Consequência prática: **não confie no schema para validar o prompt.** Depois de mudar, rode em
leads reais e compare `payload.classification.stage_suggestion` com o que o prompt pedia.

## Invariantes que não podem cair

| Invariante | Onde vive |
|---|---|
| **Autoridade da Secretária** — paciente alegando pagamento nunca vira `status_financeiro='pago'`, vira tag `pagamento_alegado` | Prompt do Resumidor + do Preenchedor + correção do Maestro |
| **Datas não são convertidas pelo LLM** — devolve string crua + `anchor_iso`; conversão é do `date-parser.ts` | Prompt do Resumidor |
| **`mentioned_dates` obrigatório se o summary cita data** | Prompt do Resumidor |
| **IA nunca toca em `appointments`** (G11) | Ausência de imports |
| **Primeira mensagem-template não infere nada** | Prompt do Preenchedor + do Maestro |

## Testar

```bash
curl -X POST "$SUPABASE_URL/functions/v1/pipeline-classify" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"action":"lead","lead_id":"<uuid>","force":true}'
```

`force:true` ignora o watermark e permite reprocessar o mesmo lead.

```bash
deno test supabase/functions/pipeline-classify/
```

Depois, em produção:

```sql
SELECT payload->'classification'->>'stage_suggestion' AS sugerido, count(*)
FROM lead_events
WHERE type='auto:classifier' AND created_at > now() - interval '2 hours'
GROUP BY 1 ORDER BY 2 DESC;
```

Pico súbito em `Qualificação` costuma ser a coerção do G9 mascarando alucinação, não consenso.

## Modelos

| Agente | Modelo |
|---|---|
| Resumidor | `gpt-4o` → fallback `gpt-5-mini` |
| Agendador · Preenchedor · Movimentador | `gpt-5-mini` |
| Maestro | `gpt-5` |

Constantes no topo de `agent-core.ts`. Trocar modelo muda custo e latência — confira
`payload.cost` e `payload.agents.latency_ms` depois.
