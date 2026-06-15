
# Onda 7 — Higiene de stage e classificador "Qualificação"

Baseado em `qualificacao-conversas-2026-06-15.md` (36 leads). A análise revelou que **a maior parte dos leads em "Qualificação" não deveria estar lá**, e o motivo é estrutural — não é erro do operador.

## Diagnóstico (o que o .md mostrou)

Padrões identificados nos 36 casos:

| # | Sintoma | Quantos leads | Causa provável |
|---|---|---|---|
| F1 | Mudanças em **lotes idênticos** (`2026-06-13 16:30`, `2026-06-14 23:03`, `2026-06-12 16:24/17:06/17:08`) movendo dezenas de leads de "Consulta Agendada" → "Qualificação" | ~25 | Reclassificador/extrator rodando em batch sem checar estado terminal |
| F2 | **Linha duplicada** no `lead_stage_history` (mesmo `lead_id` + mesmo `moved_at` ao segundo) | ~22 | Trigger `record_lead_stage_history` + escrita explícita do extrator gravam 2x |
| F3 | `source IS NULL` e `moved_by_*` vazios em **700/985 (71%)** das transições dos últimos 5 dias — confirmado via query | quase todos | `extractor-tick` (e outros workers) não preenchem `source`/`moved_by_agent_id` |
| F4 | Pacientes **recorrentes** ("Paciente antigo", "Consulta Agendada", "Procedimento pago") sendo rebaixados para "Qualificação" | ~20 | Classificador trata qualquer mensagem entrante como "lead novo a qualificar" |
| F5 | Leads com **só resposta automática** ("fora do horário de atendimento") já em Qualificação | ~5 (ex: #6 Ateliê, #20 Priscila, #23 Rubia) | Reclassificador não distingue auto-reply de atendimento humano |
| F6 | **Contatos internos** ("Ateliê Patrícia Machado", "Nutricionista Daniel Agostinho") em Qualificação | 2 (#6, #22) | `is_internal_contact` da Onda 5 ainda não está bloqueando estágios de funil |
| F7 | Stage move sem actor (`via ?` no histórico) impede auditoria | todos | Falta gravar `source='extractor'|'field-rules'|'manual'` consistentemente |

## Princípios

1. **"Qualificação" só recebe lead que ainda não foi qualificado.** Quem já passou por `Consulta Agendada`, `Procedimento Agendado`, `Procedimento pago` ou `Paciente antigo` está fora do escopo de qualificação — re-mensagem dele é continuidade, não novo lead.
2. **Toda transição de stage precisa de actor + source rastreáveis.** Sem isso, qualquer bug futuro vira caça às bruxas.
3. **Auto-reply ≠ atendimento.** Se a única mensagem `from_me=true` no thread é template "fora do horário", o lead ainda está em "aguardando atendimento humano", não em qualificação.

## Fases

### Fase 1 — Observabilidade (1-2 dias) — destravar tudo o resto

**Por que primeiro:** sem `source`/`moved_by_*` preenchidos, qualquer regra nova fica invisível em produção.

- Migration: `lead_stage_history.source` vira NOT NULL com default `'unknown'`. Backfill das linhas antigas com `'legacy'`.
- Auditar todas as edge functions que escrevem em `leads.stage_id`:
  - `extractor-tick`, `field-rules-tick`, `stage-aging-tick`, `dedup-leads-tick`, `automations-tick`, `evolution-webhook`, hooks do Kanban (`useCrm`).
  - Cada uma passa a setar `source` (`'extractor'|'field_rule'|'aging'|'dedup'|'automation'|'webhook'|'manual'`) e `moved_by_agent_id` quando aplicável.
- Trigger `record_lead_stage_history` deixa de gravar quando a chamada já veio com `source` explícito via RPC `move_lead_stage(p_source, p_agent_id)` — elimina F2 (duplicação).
- Painel rápido em `/admin` (ou query salva) mostrando contagem `source × stage_to × dia`.

**Saída:** F2 e F3 zerados. `via ?` no Lead Drawer some.

### Fase 2 — Guarda "não rebaixa quem já avançou" (2-3 dias)

- Adicionar coluna `stages.kind` (`'incoming'|'qualifying'|'scheduled'|'in_treatment'|'recurring'|'won'|'lost'`) e popular nas clínicas existentes (Agendamentos Novo + ÓR) via migration interativa — mapeamento revisado com o cliente.
- Função SQL `can_move_to_qualifying(lead_id, target_stage_id) → boolean`:
  - Retorna `false` se o lead já passou por qualquer stage com `kind IN ('scheduled','in_treatment','recurring','won')` nos últimos 90 dias.
  - Retorna `false` se `is_internal_contact = true` (corrige F6).
- `extractor-tick` e `field-rules-tick` chamam a função antes de propor `qualificacao` como destino. Quando bloqueado: gravar `lead_events.type='stage_move_blocked'` com motivo + reabrir com `source='extractor_blocked'` para auditoria.

**Saída:** F1, F4, F6 resolvidos. Pacientes antigos param de aparecer em Qualificação.

### Fase 3 — Detector "atendimento humano ocorreu?" (2 dias)

- View materializada (ou função) `lead_human_engagement(lead_id)` que retorna:
  - `has_human_outbound` (mensagem `from_me=true` com `sent_by_user_id IS NOT NULL` OU fora do conjunto de templates de auto-reply).
  - `auto_reply_only` (true quando todas as mensagens `from_me` são template de "fora do horário").
  - Lista de templates de auto-reply por clínica em `clinics.settings.auto_reply_templates` (heurística inicial: contém "fora do nosso horário de atendimento" / "Por estarmos fora").
- Classificador de qualificação só promove para "Qualificação" se `has_human_outbound = true` OU se já existe extração de IA confirmando interesse explícito (`custom_fields.demonstrou_interesse = true` E `tentou_agendar = true`).
- Casos como #6 Ateliê, #20 Priscila, #23 Rubia ficam em "Leads de entrada" aguardando humano.

**Saída:** F5 resolvido.

### Fase 4 — Reclassificação retroativa (1 dia)

- Edge function one-shot `requalify-backfill-tick` que aplica as regras de F1+F3 a leads atualmente em "Qualificação":
  - Devolve à última stage não-qualificadora dos últimos 90 dias.
  - Grava `source='backfill_onda7'` para rastrear.
- Roda em dry-run primeiro, gera relatório `.md` em `/mnt/documents/requalify-dryrun-*.md` para aprovação humana, depois roda real.

### Fase 5 — Roadmap (paralelo)

Atualizar `docs/roadmap/IMPROVEMENTS.md` adicionando:
- **R-23. Higiene de stage e auditoria de actor** (Tier 1) — Fases 1+2 acima.
- **R-24. Distinção auto-reply vs atendimento humano** (Tier 1) — Fase 3.
- **R-25. Stage `kind` taxonomy** (Tier 2) — habilita SLAs (R-13), engagement por estágio, e regras de reabertura.

Atualizar:
- `docs/flows/LEAD_LIFECYCLE.md` → seção "Reclassificação automática" com as guardas novas.
- `docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md` → marcar Onda 7.
- `docs/DRIFT.md` via `node scripts/docs-sync.mjs`.

## Detalhes técnicos

**Tabelas afetadas:**
- `lead_stage_history` (NOT NULL `source`, índice `(lead_id, moved_at DESC)` já existe).
- `stages` (nova coluna `kind`).
- `clinics.settings` (JSON: `auto_reply_templates: string[]`).

**Edge functions tocadas:**
- `extractor-tick/index.ts` — passa a chamar `can_move_to_qualifying` + `lead_human_engagement`; preenche `source='extractor'`.
- `field-rules-tick/index.ts` — idem.
- `stage-aging-tick/index.ts` — preenche `source='aging'`.
- `dedup-leads-tick/index.ts` — preenche `source='dedup'`.
- `evolution-webhook/index.ts` — quando cria lead via inbound, `source='webhook_inbound'`.
- Novo: `requalify-backfill-tick/index.ts`.

**Frontend:**
- `LeadJourneyTab.tsx` / `LeadTimelineTab.tsx` — exibir `source` no lugar de `?`.
- Kanban `MoveLeadDialog` — passa `source='manual'` + `moved_by_user_id`.

**Não-objetivos (fora desta onda):**
- Reescrita do extrator IA.
- Mudar UI do Kanban.
- Merge de duplicatas (R-2 já no roadmap).

## Validação

- Antes/depois: rodar o script `qualificacao-conversas-*.md` e comparar contagem de leads em Qualificação (esperado: cair de 36 para ~5-8 leads realmente em qualificação).
- Query: `SELECT source, COUNT(*) FROM lead_stage_history WHERE moved_at > now()-interval '1 day' GROUP BY 1` — nenhuma linha com `source='unknown'` após Fase 1.
- Golden eval no `extractor-tick/eval/` com 2 fixtures novas: "paciente antigo pedindo retorno" e "lead novo com auto-reply pendente" — ambas devem NÃO ir para Qualificação.

## Sequência sugerida

1. Você aprova este plano → começo pela Fase 1 (migration + auditoria de writers).
2. Entre fases peço aprovação antes de rodar a reclassificação retroativa (Fase 4) porque mexe em dados de produção.
