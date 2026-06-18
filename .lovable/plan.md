
# Pipeline v4.2 — auditoria e contexto sob demanda

Incremento à v4.1. Mantém todas as 8 decisões (D1–D8) e 11 gates (G1–G11). Adiciona 3 responsabilidades novas para fechar buracos identificados na discussão:

- **A1** — auditor de posição (lead parado pode estar na coluna errada)
- **A2** — verificador pós-move (todo move automático recebe segunda opinião barata)
- **A3** — classifier ganha tool `get_lead_history` para puxar contexto sob demanda

Escopo desta rodada: **só documentação**. Atualiza `AUTOMATION_PLAN.md`, `SCENARIOS.md`, `CUSTOM_FIELDS_E_TAGS.md`, `README.md` do pipeline, `docs/README.md` e memória `pipeline-v4-1.md` (renomeia para `pipeline-v4-2.md`). Nenhuma migration, nenhuma edge function, nenhuma UI nova.

## Arquitetura — diff sobre v4.1

```text
inbound msg ─► Orchestrator
                ├─ Classifier (LLM)            ← A3: ganha tool get_lead_history
                ├─ Summarizer (LLM)
                └─ Rule Engine
                     └─ pipeline-move helper   ← A2: dispara post-move-verifier async
                                                       (se discordar → tag, NUNCA reverte)

cron diário 03:00 ─► position-auditor          ← A1 novo
                       scan leads parados ≥7d
                       classifier "revisor" decide
                       discordância → tag precisa_atencao_humana + task
```

Princípio comum aos três: **nunca movem card sozinhos**. Só sinalizam via tag `precisa_atencao_humana` + task. Mantém G1/G5/G11.

## A1 — Auditor de posição (Fase 2.5, novo)

Edge function `pipeline-position-auditor`, agendada por `pg_cron` 03:00 BRT.

**Critério de seleção** (query):
- `last_stage_change_at < now() - interval '7 days'`
- stage atual NÃO em `(Paciente antigo, Nutrição inativa, B2B, Desqualificado)`
- sem `appointments` futuro
- `qualificacao != 'desqualificado'`
- batch size 50/dia (toggle em `app_settings.automation.position_auditor.batch_size`)

**Para cada lead**:
1. Roda mesmo prompt do classifier Fase 2, mas com instrução "revisor" — compara `suggested_stage_id` com `current_stage_id`.
2. Se diferente E `confidence ≥ 0.75`:
   - Adiciona tag `precisa_atencao_humana` + `auditor_sugere_<stage>`.
   - Cria `lead_tasks` "Revisar posição: auditor sugere mover para X" `due_at=+2d`.
   - Grava `lead_events.type='position_audit_disagreement'` com payload `{from, to, confidence, reasoning}`.
3. Se igual ou `confidence<0.75`: grava `lead_events.type='position_audit_ok'` (silencioso, só pra métrica).

**Idempotência**: 1 auditoria por lead a cada 14 dias (`lead_events` lookup).

**Custo**: 50 leads/dia × ~$0.0001 (Flash-Lite) ≈ $0.15/mês. Toggle off-by-default.

**Métrica**: % de discordâncias que viram move humano em 7d (proxy de utilidade do auditor).

## A2 — Verificador pós-move (Fase 2.5, novo)

Não é regra `auto:*` independente. É **hook dentro do `pipeline-move.ts` helper**, executado async após move bem-sucedido quando `source LIKE 'auto:%'` (não roda em moves humanos — o reator D7 já cobre).

**Fluxo**:
1. `pipeline-move` move + grava history.
2. Enfileira chamada não-bloqueante para `pipeline-post-move-verifier` com `{lead_id, from_stage_id, to_stage_id, source, last_5_events}`.
3. Verifier roda prompt curto Flash-Lite: "esse move faz sentido dado esses 5 últimos eventos? sim/não/incerto + razão ≤100 chars".
4. Se "não" com `confidence ≥ 0.8`:
   - Tag `precisa_atencao_humana` + `post_move_warning`.
   - `lead_events.type='post_move_disagreement'`.
   - **NÃO reverte**. Só sinaliza.
5. Se "sim" ou "incerto": só métrica.

**Toggle**: `app_settings.automation.post_move_verifier.enabled` (off por default). Pode ser ligado seletivamente por regra (`...verifier.rules_enabled=['auto:b2b-move','auto:reactivation']`) para começar barato.

**Custo estimado** (todas regras ligadas, ~200 moves/dia): ~$0.60/mês.

**Métrica**: taxa de "post_move_warning seguido de undo humano em 24h" — se ≥30%, o verifier está ajudando. Se ≤5%, o classifier original já está bom; pode desligar.

## A3 — Tool `get_lead_history` no classifier (Fase 2, ajuste)

Hoje o classifier recebe payload fixo: `ai_summary` + últimas 10 msgs + `custom_fields` + `tags`. Quando a conversa é longa ou específica, o summary perde nuance.

**Mudança**:
- Adicionar tool calling ao classifier (já é nativo da AI SDK Gemini).
- Expor 1 tool somente: `get_lead_history({ query: string, max_messages?: number })`.
  - Implementação server-side: full-text search em `messages` daquele `lead_id` + retorno das N msgs (default 5) mais relevantes com timestamp.
  - Limite hard: máximo 3 chamadas por execução do classifier (anti-loop). `stopWhen: stepCountIs(4)` (3 tool calls + 1 final).
- Prompt do classifier ganha instrução: "se ai_summary não cobre uma intent específica do usuário (ex: lembra histórico de outra consulta, refere-se a evento antigo), use get_lead_history antes de classificar".

**Custo extra**: +1 round-trip quando acionado. Estimado <10% das execuções → +$0.40/mês na Fase 2.

**Reuso**: a primitiva `get_lead_history` já está na whitelist de `src/lib/agent-tools.ts` e `supabase/functions/_shared/agent-flags.ts`. Só precisa registrar no `pipeline-classify` edge function (Fase 2). Esta rodada só documenta a decisão.

## Mudanças nas decisões e gates

Não cria D9/D10. A1/A2/A3 são **mecanismos de execução**, não decisões de produto.

Adiciona uma nota explícita em **G11**:
> G11 cobre também os agentes auditores (A1, A2). Nenhum deles cria/edita `appointments` nem move stage. Apenas tag + task.

## Roadmap atualizado (apenas seções que mudam)

```text
Fase 0    — Infra (sem mudança)
Fase 0.5  — Campos e tags (sem mudança)
Fase 1    — Regras determinísticas (sem mudança)
Fase 2    — Classifier LLM
              + A3: tool get_lead_history registrada no classifier
Fase 2.5  — NOVO: Agentes auditores
              + A1: pipeline-position-auditor (cron diário)
              + A2: pipeline-post-move-verifier (hook async no pipeline-move)
              Critério de entrada: Fase 2 com ≥14d estável e <10% undo humano
Fase 3    — Summarizer + Tasks (sem mudança)
Fase 4    — Retenção (sem mudança)
```

## Tags novas (adicionar em `CUSTOM_FIELDS_E_TAGS.md`)

- `auditor_sugere_<stage>` — colocada por A1 quando discorda da posição atual.
- `post_move_warning` — colocada por A2 quando segunda opinião discorda.

Ambas convivem com `precisa_atencao_humana` (D8). Não são exclusivas.

## Toggles novos (`app_settings`)

- `automation.position_auditor.enabled` (bool, default false)
- `automation.position_auditor.batch_size` (int, default 50)
- `automation.post_move_verifier.enabled` (bool, default false)
- `automation.post_move_verifier.rules_enabled` (string[], default [])
- `automation.classifier.history_tool_enabled` (bool, default true quando Fase 2 ligar)

## Métricas adicionadas em `/admin/pipeline-automations`

Para cada agente novo, últimos 7d:
- A1: leads auditados, % discordância, % discordância que virou move humano.
- A2: moves verificados, % com warning, % warning seguido de undo humano em 24h.
- A3: % execuções do classifier que chamaram `get_lead_history`, média de chamadas por execução, delta de confidence vs execuções sem tool.

## Critério de sucesso da v4.2

Em 30 dias após Fase 2.5 ligada:
- A1 produz ≥1 discordância útil/semana (vira move humano).
- A2 detecta ≥1 move ruim/semana antes do humano perceber.
- A3 reduz "% confidence<0.6" do classifier em ≥15%.

Se qualquer um falhar: desligar via toggle, manter doc, reavaliar.

## Arquivos a editar quando virar build

1. `docs/pipeline/AUTOMATION_PLAN.md` — nova seção "Fase 2.5", nota em G11, toggles, métricas.
2. `docs/pipeline/SCENARIOS.md` — 2 cenários novos (C21 auditor, C22 post-move warn).
3. `docs/pipeline/CUSTOM_FIELDS_E_TAGS.md` — tags `auditor_sugere_*`, `post_move_warning`.
4. `docs/pipeline/README.md` — bump versão para v4.2 + changelog.
5. `docs/README.md` — atualizar referência.
6. `.lovable/memories/docs/pipeline-v4-1.md` → renomear para `pipeline-v4-2.md` + atualizar índice.

Tudo na mesma rodada de build, com `updated:` = data de hoje. Sem migration, sem código.

## Fora deste plano

- Implementação das edge functions `pipeline-position-auditor` e `pipeline-post-move-verifier` (vira plano separado quando Fase 2 estabilizar).
- Plug do `get_lead_history` no `pipeline-classify` (faz parte do plano da Fase 2).
- Painel `/admin/pipeline-automations` (já estava previsto na Fase 0; A1/A2/A3 só adicionam linhas).
