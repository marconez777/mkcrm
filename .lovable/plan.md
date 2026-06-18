## Problema

A varredura rodou em 66 leads de "Qualificação" mas nada mudou. Investigando `pipeline-classify/index.ts`:

1. **Stage nunca é movido automaticamente** — o código só move para `B2B / Stakeholders` (quando `automation.b2b_move.enabled` está ligado e `confidence ≥ 0.9`). Para qualquer outra `stage_suggestion` (ex.: "Em tratamento", "Sem resposta", "Nutrição inativa", "Paciente antigo"), o classifier apenas grava o evento e segue.
2. **Tags só são adicionadas (união)** — nunca removidas. Então tags antigas/incorretas como "Interesse", "1ª consulta" persistem mesmo quando a IA discorda.
3. O resultado é exatamente o sintoma: leads continuam na coluna errada e com tags desatualizadas.

## O que vou mudar

### 1. Mover automaticamente para a `stage_suggestion` da IA

No `pipeline-classify/index.ts`, depois da classificação:

- Resolver o `stage_id` de `cls.stage_suggestion` via `stage_canonical_aliases` (mesma função já usada para B2B).
- Se `stage_id` resolvido ≠ `lead.stage_id` **e** `cls.confidence ≥ STAGE_MOVE_MIN_CONFIDENCE` (proponho **0.75**, configurável via `app_settings.automation.classifier.stage_move_min_confidence`), chamar `pipelineMove` com:
  - `source: "auto:classifier-stage"`
  - `reason: "Classifier: <stage> (conf=X.XX)"`
  - `ruleKey: "automation.classifier.stage_move.enabled"`
  - `idempotencyKey: stage:<leadId>:<lastMsgId>` (evita repetir o mesmo move se reprocessar)
- Gate por toggle novo: `automation.classifier.stage_move.enabled` (default **true** — já que o usuário pediu explicitamente). Se `false`, mantém comportamento atual (só evento).
- Confiança baixa (`< 0.6`) já recebe tag `precisa_atencao_humana` e **não** é movida.
- Se `is_b2b=true`, mantém o caminho B2B existente (não duplica).

### 2. Corrigir tags (não só adicionar)

Hoje o código faz union. Vou mudar para **substituir** as tags sugeridas pela IA dentro de um "namespace gerenciado":

- Definir whitelist de tags gerenciadas pelo classifier (as do v4.2: `interessado`, `agendando`, `comprovante`, `negociacao`, `1a_consulta`, `seguimento`, `cetamina`, `desistente`, `sem_resposta`, etc. — vou ler `docs/pipeline/CUSTOM_FIELDS_E_TAGS.md` para confirmar a lista exata).
- Lógica: `final = (current \ managed_whitelist) ∪ tags_suggested ∪ (precisa_atencao_humana se conf<0.6)`.
- Isso preserva tags manuais fora da whitelist (ex.: "Lock manual") e corrige as gerenciadas.
- Gate por toggle: `automation.classifier.tag_replace.enabled` (default **true**).

### 3. Custom fields

Já faz merge com remoção quando IA envia `null`. Mantenho como está — comportamento já correto.

### 4. Telemetria

Adicionar ao `lead_events` `auto:classifier` payload campos:
- `stage_moved`: `{ from, to, applied: bool, skipped_reason? }`
- `tags_diff`: `{ added: [], removed: [], kept_manual: [] }`

Assim você consegue auditar pela UI de PipelineRuns por que um lead não foi movido (ex.: `skipped_reason: "low_confidence"` ou `"same_stage"`).

## Arquivos afetados

- `supabase/functions/pipeline-classify/index.ts` — lógica de move + reconciliação de tags + payload do evento.
- (Opcional) `supabase/migrations/...sql` — inserir defaults dos novos toggles em `app_settings` (`stage_move.enabled=true`, `tag_replace.enabled=true`, `stage_move_min_confidence=0.75`).

## Não vou mexer

- UI de PipelineRuns (escopo já funciona).
- Executor/heartbeat/timeouts (já corrigidos).
- Summarizer / tasks de intent.

## Pergunta antes de implementar

Confirma os defaults? 
- Stage move automático **ligado**, mínimo de confiança **0.75**.
- Tag replace **ligado**, preservando tags manuais fora da whitelist v4.2.

Se preferir mais conservador (ex.: 0.85 de confiança, ou stage move desligado por default e você liga manualmente), me diz.