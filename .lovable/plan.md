
# Reconstrução do `pipeline-classify` — Multi-Step / Strict-No-Move (V2 refinado)

Baseado no `implementation_plan2.md` + decisões de refinamento (trigger PG para G10, B2B com threshold alto, `tags_remove` determinístico, batch 50/tick).

> **Invariantes preservadas**: nenhuma alteração em `appointments`, `evolution-webhook`, SumUp, `pipeline-deterministic`, `pipeline-position-auditor`, `pipeline-post-move-verifier`, `pipeline-human-reactor`, `_shared/pipeline-move.ts`. O classifier deixa de mover cards (exceto B2B).

---

## Fase 0 — Pré-flight (zero código)

1. **Desligar cron** via `app_settings`: `automation.classifier.enabled='false'` e `automation.classifier.version='v1'`.
2. Confirmar backup recente da clínica ÓR (já feito em conversa anterior).
3. Smoke-snapshot: capturar `count(*) where needs_ai_review=true` antes do rollout (para dimensionar backlog).

---

## Fase 1 — Migration G10 + telemetria

### `supabase/migrations/<ts>_g10_human_edits.sql`

```sql
-- 1. Coluna jsonb para timestamps de últimas edições humanas por chave
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS custom_fields_last_human_edit jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Trigger BEFORE UPDATE que detecta diff em custom_fields e,
--    se o actor não for 'system', registra timestamp por chave alterada.
--    Convenção: edge functions setam `SET LOCAL app.actor = 'system'` antes
--    de updates automáticos; frontend (PostgREST) não seta nada → tratado como humano.
CREATE OR REPLACE FUNCTION public.track_custom_fields_human_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor text;
  k text;
  old_val jsonb;
  new_val jsonb;
  now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
BEGIN
  IF NEW.custom_fields IS NOT DISTINCT FROM OLD.custom_fields THEN
    RETURN NEW;
  END IF;

  BEGIN
    actor := current_setting('app.actor', true);
  EXCEPTION WHEN OTHERS THEN
    actor := NULL;
  END;

  IF actor = 'system' THEN
    RETURN NEW;
  END IF;

  FOR k IN
    SELECT key FROM jsonb_object_keys(
      COALESCE(NEW.custom_fields, '{}'::jsonb) || COALESCE(OLD.custom_fields, '{}'::jsonb)
    ) AS t(key)
  LOOP
    old_val := COALESCE(OLD.custom_fields, '{}'::jsonb) -> k;
    new_val := COALESCE(NEW.custom_fields, '{}'::jsonb) -> k;
    IF old_val IS DISTINCT FROM new_val THEN
      NEW.custom_fields_last_human_edit :=
        COALESCE(NEW.custom_fields_last_human_edit, '{}'::jsonb)
        || jsonb_build_object(k, now_iso);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_custom_fields_human_edits ON public.leads;
CREATE TRIGGER trg_track_custom_fields_human_edits
BEFORE UPDATE OF custom_fields ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_custom_fields_human_edits();
```

E **patch em todas as edge functions automáticas** que escrevem em `leads.custom_fields` (lista exata abaixo) para abrir transação com `SET LOCAL app.actor = 'system'`:

- `pipeline-classify` (v1 antigo, durante coexistência, e v2 novo)
- `pipeline-deterministic`
- `pipeline-position-auditor`
- `pipeline-post-move-verifier`
- `appointment-extractor` (se existir)
- `_shared/pipeline-move.ts` (quando toca custom_fields)
- `_shared/pipeline-fase4.ts` (side-effects de intent)

Implementação: helper `withSystemActor(supabase, async () => {...})` em `_shared/db-actor.ts` que faz `rpc('set_actor_system')` em uma função `set_config('app.actor','system',true)` SECURITY DEFINER, executada na mesma conexão. (Como PostgREST não compartilha conexão entre requests, o helper roda `select set_config(...)` no início de cada batch de updates.)

---

## Fase 2 — Demolir e remontar `pipeline-classify/`

### Renomear o atual (não deletar)
- `supabase/functions/pipeline-classify/index.ts` → `supabase/functions/pipeline-classify/index.v1.ts` (mantém todas as 696 linhas como fallback).

### Nova estrutura

```text
supabase/functions/pipeline-classify/
├── index.ts                  # entry HTTP + cron tick + dispatch v1/v2 por flag
├── index.v1.ts               # arquivo antigo intocado, exporta handleV1(req)
├── context.ts                # loadLeadContext (usa ai_summary + watermark + early-return)
├── schema.ts                 # Zod único do agente
├── agent-core.ts             # 1 chamada gpt-5-mini com tool A3 opcional
├── date-parser.ts            # wrapper determinístico sobre parseFutureDateInTZ
├── apply.ts                  # aplica gates, tags, custom_fields, side-effects, telemetria v2
└── rules/
    ├── first-consult.ts      # regra "1ª consulta" com fallback no ai_summary
    └── intent-effects.ts     # wrapper de pipeline-fase4
```

### `index.ts` (dispatcher)

```ts
const version = await getSetting('automation.classifier.version') ?? 'v1';
if (version === 'v1') return handleV1(req);          // import dinâmico de ./index.v1.ts
return handleV2(req);                                 // novo
```

Mesma rota HTTP, mesmo cron (`pipeline-classify-tick`), mesmo batch 50/tick.

---

## Fase 3 — Agente único (`agent-core.ts`)

- **Modelo**: `gpt-5-mini` via `getClinicOpenAI()`.
- **Tool A3** (`get_lead_history`): mantida, controlada por `automation.classifier.history_tool_enabled`. `stopWhen: stepCountIs(50)`.
- **Schema Zod (`schema.ts`)** — versão enxuta para evitar "too many states":

```ts
z.object({
  mentioned_dates: z.array(z.object({
    raw: z.string().max(120),
    anchor_iso: z.string(),                // timestamp da mensagem que cita a data
    kind: z.enum(['consulta','procedimento'])
  })).max(4),
  mentioned_intents: z.array(z.enum(INTENT_VALUES)).max(3),
  stage_suggestion: z.enum(CANON_NAMES),
  confidence: z.number().min(0).max(1),
  is_b2b: z.boolean(),
  tags_suggested: z.array(z.string().max(40)).max(8),
  custom_fields_patch: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  reasons: z.array(z.string()).min(1).max(5)
})
```

> **`tags_remove` foi REMOVIDO do LLM** (decisão V2). Computado em `apply.ts` como `currentTags − tags_suggested − PROTECTED_TAGS`, com toggle `automation.classifier.tag_replace.enabled` controlando se de fato remove.

### Prompt
Reescrito enxuto (~150 linhas) com:
- Tabela dos 10 canon stages
- Regras de data: "devolva a string crua + `anchor_iso` da mensagem que cita; **não** converta"
- Regras de "1ª consulta": "se houver evidência no histórico ou no resumo de atendimento anterior, NÃO sugira esta tag"
- Whitelist de tags (`automation.v42.allowed_tags`)
- `confidence` semântico (escala explícita)

---

## Fase 4 — Parser determinístico (`date-parser.ts`)

```ts
import { parseFutureDateInTZ } from "../_shared/dates.ts";

export function resolveMentionedDates(mentioned, now = new Date()) {
  return mentioned.map(m => {
    const anchor = new Date(m.anchor_iso);
    const resolved = parseFutureDateInTZ(m.raw, "America/Sao_Paulo", anchor);
    if (!resolved) return { ...m, resolved: null, rejected_reason: 'ambiguous_or_past' };
    if (resolved.getTime() > now.getTime() + 90*24*3600*1000)
      return { ...m, resolved: null, rejected_reason: 'too_far_future' };
    return { ...m, resolved: resolved.toISOString(), rejected_reason: null };
  });
}
```

---

## Fase 5 — `apply.ts` — ordem de aplicação

1. **Early-return** se `context.new_message_count === 0` → grava `auto:classifier` `{version:2, skipped:'no_new_messages'}` e atualiza watermark.
2. **first-consult**: lê `ai_summary` + histórico de stages; se paciente já tratado, força `tags_remove += ['1ª consulta']` e bloqueia adição.
3. **Datas resolvidas** → para cada `kind`:
   - Mapeia para `consulta_agendada_em` / `procedimento_agendado_em`.
   - **Gate G10**: lê `lead.custom_fields_last_human_edit[key]`; se `< 7d`, descarta sugestão da IA → `blocked_by_g10[key]`.
   - Se passou, entra em `patch`.
4. **Custom fields patch** restantes (não-data) → mesmo G10 por chave.
5. **Tags**:
   - `removeComputed = currentTags − tags_suggested − PROTECTED_TAGS`
   - `nextTags = (currentTags − removeComputed) ∪ tags_suggested ∪ (lowConf ? ['precisa_atencao_humana'] : [])`
   - Whitelist v4.2 aplicada como filtro pós-LLM (tags fora viram `tags_dropped`).
6. **Stage move — STRICT NO-MOVE**:
   - **Caminho genérico**: nunca move. Apenas registra em telemetria como `stage_suggestion_only`.
   - **Caminho B2B**: move **somente se** `is_b2b===true` AND `confidence ≥ 0.95` AND `tags_suggested.includes('b2b')` AND lead **nunca passou por** `Em tratamento|Consulta finalizada|Paciente antigo` AND `automation.b2b_move.enabled`. Idempotência inalterada.
7. **Side-effects por intent** (`pipeline-fase4`) preservados.
8. **Summarizer** preservado (`runSummarize` com `force: intent !== 'outro'`).
9. **UPDATE leads** em uma transação com `set_config('app.actor','system',true)` para não disparar trigger G10.

### Telemetria `auto:classifier` v2

```jsonc
{
  type: "auto:classifier",
  payload: {
    version: 2,
    classification: { stage_suggestion, intent, confidence, is_b2b, reasons },
    extractor: { mentioned_dates, mentioned_intents },
    date_parser: [{ raw, kind, resolved, rejected_reason }],
    applied: {
      tags: { added, removed_computed, dropped_by_whitelist },
      custom_fields: { set: {...}, blocked_by_g10: { key: last_human_iso } },
      stage_suggestion_only: { suggested, current, would_move: false, reason: 'strict_no_move' | 'b2b_move_applied' | 'b2b_guard_failed:<...>' }
    },
    cost: { model, prompt_tokens, completion_tokens }
  }
}
```

---

## Fase 6 — Testes Deno

`supabase/functions/pipeline-classify/*_test.ts`:

1. `date-parser_test.ts` — "quinta às 15h" com anchor numa terça → ISO correto SP/BRT. Cobre DST, passado, >90d, ambíguo.
2. `first-consult_test.ts` — mock `ai_summary` com "paciente já realizou sessão" → bloqueia tag.
3. `apply-g10_test.ts` — `custom_fields_last_human_edit['consulta_agendada_em']` há 3d → patch bloqueado; há 8d → patch aplicado.
4. `apply-tags_test.ts` — `tags_remove` computado corretamente; protected tags nunca removidas; whitelist filtra.
5. `apply-strict-no-move_test.ts` — `stage_suggestion='Consulta agendada'` com confidence 0.95 → não move, registra `stage_suggestion_only`.
6. `apply-b2b_test.ts` — todos os 4 guards exigidos; falha em qualquer um → `b2b_guard_failed:<...>`.

Rodar via `supabase--test_edge_functions` antes do deploy.

---

## Fase 7 — Rollout

1. Aplicar migration (Fase 1) → trigger G10 ativo, mas v1 ainda usa `app.actor='system'` (precisa do patch nele também — incluído).
2. Deploy do v2 com `version='v1'` ainda. Smoke `action:'lead'` em 5 leads reais via `supabase--curl_edge_functions` passando override `{ force_version: 'v2' }` (parâmetro de teste, ignora flag).
3. Validar payload `version:2` em `lead_events`.
4. Flipar `automation.classifier.version='v2'` durante janela de baixa atividade.
5. Manter cron rodando — batch 50/tick como hoje (decisão V2). Backlog drena em N/50 minutos.
6. Após 24h estáveis, deletar `index.v1.ts` em PR separado.

**Rollback**: `UPDATE app_settings SET value='v1' WHERE key='automation.classifier.version'` → próximo tick volta a v1.

---

## Fase 8 — Documentação

Reescrever:
- `docs/pipeline/runtime/CLASSIFIER.md` — nova arquitetura, schema, strict no-move, B2B guards.
- `docs/pipeline/runtime/GATES.md` — G10 marcado como **implementado via trigger PG + apply.ts**.
- `docs/pipeline/runtime/EVENTS_TELEMETRY.md` — payload `version:2`, novos campos `extractor`/`date_parser`/`blocked_by_g10`/`stage_suggestion_only`.
- `docs/pipeline/runtime/KNOWN_ISSUES.md` — fechar "G10 ausente"; abrir "Strict no-move: cards Qualificação acumulam até Fase 2 (SumUp/appointment-extractor)".
- `docs/pipeline/runtime/DATABASE_LIVE.md` — coluna `custom_fields_last_human_edit` + trigger.

---

## Riscos residuais (assumidos)

- **Cards param em Qualificação** até Fase 2 (SumUp + appointment-extractor). Decisão consciente do plano original.
- **`app.actor`** depende de cada edge function chamar o helper. Trigger é **permissivo** por padrão (qualquer escrita sem actor=system marca como humano). Esquecer o helper numa função automática → ela mesma passa a bloquear suas próprias edições no próximo classifier. Mitigação: lista exata acima + checklist no PR.
- **`set_config` por request**: PostgREST/UI não setam `app.actor` → tratado como humano (correto). Edge functions que esquecerem → falso positivo de G10, não falso negativo (mais seguro).
