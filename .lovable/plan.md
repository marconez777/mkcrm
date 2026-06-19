# Plano — `/pipeline-runs` adaptado ao classificador V3 (3 agentes)

Hoje a página `PipelineRuns.tsx` mostra cada lead como **uma única linha** com `status: ok/skip/error` e um `result` cru em JSON. Com o V3 o `result` já vem com `telemetry.agents` (summarizer / typifier / maestro + latências, modelos, summary, decisões), mas a UI ignora isso. Também não dá pra rodar **só um agente** manualmente, e os motivos de skip aparecem como string técnica (`no_new_messages`, `agent_error:typifier_failed`).

Vamos atacar 3 frentes: **detalhe por agente**, **execução manual seletiva**, **erros/skips legíveis**.

---

## 1) UI — Detalhe por agente em cada lead

Em `ItemRow` (quando o usuário expande), trocar o `<pre>` cru por um bloco visual com 3 cards lado a lado:

```text
┌──────────────────┬──────────────────┬──────────────────┐
│ 📝 Resumidor      │ 🏷️ Tipificador   │ 🎯 Maestro        │
│ gpt-4o · 820 ms  │ gpt-5-mini·410ms │ gpt-5-mini·1.1s   │
│ ✅ ok            │ ✅ ok            │ ✅ ok             │
│ "resumo curto…"  │ +2 tags, 1 field │ Stage: Qualific.  │
│                  │ tags: pago, nf   │ Intent: pagamento │
│                  │                  │ Conf: 0.82        │
└──────────────────┴──────────────────┴──────────────────┘
```

Fonte de dados: `item.result.telemetry.agents` (já existe — `summarizer_model`, `typifier_model`, `maestro_model`, `latency_ms.{summarizer|typifier|maestro}`, `summary`) + `item.result.classification` (stage, intent, confidence, tags_suggested, custom_fields_patch).

Abaixo dos cards, manter: `reasons[]` em bullets + accordion "JSON bruto" (fechado) para quem quiser inspecionar.

Para erros vindos do agent-core (`agent_error:summarizer_failed:<msg>` etc.), destacar **qual agente falhou** com badge vermelho no card correspondente e a mensagem original embaixo.

## 2) UI — Execução manual seletiva (3 agentes)

Adicionar no **ScopeDialog** uma seção "Quais agentes rodar":

```
( ) Pipeline completo (3 agentes)   ← default
( ) Só Resumidor      (refaz ai_summary; não mexe em tags/stage)
( ) Só Tipificador    (refaz tags + custom_fields; usa summary atual)
( ) Só Maestro        (refaz stage + intent; usa summary + tags atuais)
```

Mesma opção disponível por lead em `ItemRow` via menu "Rodar de novo só…" (botões pequenos no detalhe expandido).

## 3) UI — Skip/erro humanizado

Criar `src/lib/pipeline-skip-reasons.ts` com mapa:

```ts
{
  no_messages: { label: "Sem mensagens", desc: "Lead ainda não conversou." },
  no_new_messages: { label: "Sem novidade", desc: "Nada novo desde a última classificação (watermark)." },
  no_pipeline: { label: "Sem pipeline", desc: "Lead não está em nenhum pipeline." },
  lead_not_found: { label: "Lead não existe", desc: "Lead foi removido." },
  clinic_not_allowlisted: { label: "Clínica não autorizada", desc: "Feature não liberada para esta clínica." },
  toggle_off: { label: "IA pausada", desc: "Toggle automation.classifier.enabled está off." },
  "agent_error:summarizer_failed": { label: "Resumidor falhou", desc: "GPT-4o devolveu erro/JSON inválido." },
  "agent_error:typifier_failed":   { label: "Tipificador falhou", desc: "GPT-5-mini devolveu erro." },
  "agent_error:maestro_failed":    { label: "Maestro falhou", desc: "GPT-5-mini devolveu erro." },
}
```

`StatusBadge` quando skip mostra o `label` no chip (ex.: "Skip · Sem novidade") e o `desc` no tooltip. No accordion expandido, bloco "Por que pulou?" com a descrição completa.

Aplicar também na coluna esquerda (lista de execuções recentes) usando o agregado: hoje mostra `skip 7` cru — adicionar barra empilhada miniatura por motivo (cores diferentes para `no_new_messages` vs `agent_error:*`), e top‑3 motivos em `text-[10px]` abaixo.

## 4) Backend — Suportar `only_agent` no classify

Atualmente `classifyOneV2` em `supabase/functions/pipeline-classify/index.ts` sempre roda os 3 agentes. Adicionar parâmetro:

- `action: "lead", lead_id, only_agent: "summarizer" | "typifier" | "maestro" | undefined`

Em `agent-core.ts`:
- Se `only_agent === "summarizer"`: roda só `summarizerModel`, persiste `ai_summary`, **pula** typifier/maestro (não altera tags/stage). Marca `telemetry.partial = "summarizer_only"`.
- Se `only_agent === "typifier"`: reutiliza `ctx.lead.ai_summary` como input do Tipificador. Pula Maestro.
- Se `only_agent === "maestro"`: reutiliza `ai_summary` + tags/custom_fields **atuais** do lead como input. Não chama Resumidor/Tipificador.

`apply.ts` precisa respeitar `partial` e só aplicar os campos do(s) agente(s) executado(s).

## 5) Backend — Propagar `only_agent` no executor

`supabase/functions/pipeline-run-executor/index.ts`:
- Aceitar `only_agent` no `action: "start"` e armazenar em `pipeline_runs.scope.only_agent`.
- Repassar para `callClassify(leadId, only_agent)` → `pipeline-classify` body.
- Em `pipeline_run_items.step`, gravar `"classify:summarizer"`, `"classify:typifier"`, `"classify:maestro"` ou `"classify"` (full) para a UI agrupar.

---

## Arquivos afetados

- `src/pages/PipelineRuns.tsx` — refator de `ItemRow`, `StatusBadge`, `StageGroup`; `ScopeDialog` ganha seletor de agente; menu por-lead.
- `src/lib/pipeline-skip-reasons.ts` — novo mapa.
- `supabase/functions/pipeline-classify/index.ts` — aceita `only_agent`.
- `supabase/functions/pipeline-classify/agent-core.ts` — execução parcial; reaproveita `ai_summary`/tags atuais.
- `supabase/functions/pipeline-classify/apply.ts` — aplica patch parcial conforme `partial`.
- `supabase/functions/pipeline-run-executor/index.ts` — propaga `only_agent`; grava `step` granular.

## Fora do escopo

- Mudanças no `/ai/usage` (já feito na rodada anterior).
- Nova tabela / migration — tudo encaixa em `pipeline_runs.scope` + `pipeline_run_items.step`/`result` existentes.
- Reprocessar lotes históricos com novo agente — só novas execuções terão `partial`.

## Ponto de atenção

Rodar **só o Maestro** com tags desatualizadas pode levar a um stage inconsistente (ex.: tag "pago" antiga ainda presente). Vou deixar um aviso no diálogo: *"Rodar só Maestro usa as tags/campos atuais — se o lead estiver desatualizado, rode o pipeline completo."*
