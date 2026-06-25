# Plano revisado: aplicar o novo fluxo (Fluxo-atual.md)

Mantém o espírito do plano original (refinar prompts + ligar toggles determinísticos), mas adiciona o que falta para o fluxo realmente funcionar: detecção determinística da 1ª mensagem, proteção de `origem`, conferência das colunas novas e ajustes no monthly sweep.

## Fase 1 — Detecção determinística de "1ª mensagem é template"

Arquivo: `supabase/functions/pipeline-classify/context.ts` (ou equivalente onde `LeadContext` é montado).

- Calcular `first_message_is_template: boolean`:
  - `true` se o lead tem apenas 1 mensagem enviada **e** o texto bate com regex de templates (`quero agendar`, `gostaria de informações`, `vim pelo google/instagram/facebook`, etc.) **ou** a mensagem veio de form/ad (`source` conhecido).
- Expor essa flag em `buildContextBlock` como linha `PRIMEIRA_MENSAGEM_TEMPLATE=true|false`.

## Fase 2 — Refinar prompts (Summarizer, Typifier, Maestro)

Arquivo: `supabase/functions/pipeline-classify/agent-core.ts`.

Adicionar bloco nas funções **`buildSummarizerSystem`**, **`buildTypifierSystem`** e na system message do **Maestro** (não só Agendador):

> "REGRA DA PRIMEIRA MENSAGEM: Se o contexto trouxer `PRIMEIRA_MENSAGEM_TEMPLATE=true`, ignore essa mensagem para definir `interesse_consulta`, `interesse_tratamento` e `scheduling_intent`. Considere apenas mensagens seguintes do lead.
>
> EXCEÇÃO ORIGEM: Mesmo nesse caso, você PODE extrair o campo `origem` (Google, Instagram, Facebook, Indicação) se a 1ª mensagem citar rastreio explícito. Nunca devolva `origem` se já houver intervenção humana sobre esse campo (o executor garantirá o lock)."

No Agendador o ajuste é opcional — ele já é raso.

## Fase 3 — `origem` com lock humano (não confiar só no prompt)

- Migration: adicionar (se não existir) coluna `human_edited_at timestamptz` em `lead_custom_fields`, e/ou usar `meta jsonb` para marcar `human_locked: true` quando o valor é alterado pela UI.
- Frontend (CustomFieldsPanel): ao salvar `origem` manualmente, gravar `human_edited_at = now()`.
- Backend (`apply.ts` do `pipeline-run-executor`): ao aplicar `custom_fields_patch`, ignorar `origem` quando `human_edited_at IS NOT NULL` e logar skip-reason `origem_human_locked`.

## Fase 4 — Garantir as colunas novas do pipeline

Antes de ligar qualquer cron, conferir/criar por clínica em `pipeline_stages`:

- `Qualificação`, `Consulta agendada`, `Tratamento agendado`, `Consulta finalizada`, `1ª Sessão Finalizada`, `Paciente antigo`, `Nutrição antigos`, `Nutrição inativa`.

Registrar aliases em `stage_canonical_aliases` para que o motor determinístico reconheça variações (`primeira_sessao_finalizada`, `nutricao_antigos`, `nutricao_inativa`).

Plano de saída: script de verificação (SELECT por clínica) + migração de aliases.

## Fase 5 — Ajustes no `pipeline-deterministic`

Em `supabase/functions/pipeline-deterministic/index.ts`:

1. **Monthly sweep** (`automation.monthly_sweep_paciente_antigo`):
   - Considerar como origem **tanto** `Consulta finalizada` quanto `1ª Sessão Finalizada`.
   - Filtro de janela: `entered_stage_at >= date_trunc('month', now() - interval '1 month') + interval '1 day'` (cobre "dia 2 até último dia"). Confirmar que leads que entraram no dia 1 do mês corrente NÃO são varridos.
2. **Inatividade Paciente antigo → Nutrição antigos** (60d sem mensagem do lead e sem appointment): destino deve ser `Nutrição antigos` (não `Nutrição inativa`). Confirmar no código.
3. **Qualificação 7d → Nutrição inativa**: confirmar destino canônico `Nutrição inativa`.

## Fase 6 — Ligar o toggle que falta

Apenas um `UPDATE` em `app_settings` (os outros dois já estão `true`):

```sql
UPDATE app_settings SET value = 'true'::jsonb WHERE key = 'automation.monthly_sweep_paciente_antigo.enabled';
```

(Validar antes via `SELECT` se já não foi ligado entre fases.)

## Fase 7 — Validar a parte que fica na UI (sem código)

Só validação, nada a alterar:

- Campo `Teleconsulta` (boolean) existe em `lead_custom_fields` da clínica.
- `automations-tick` aceita condição `Teleconsulta == true/false` em trigger `before_appointment` (já documentado em `USER_AUTOMATIONS.md`).
- Templates de saudação, lembretes (online/presencial, 1d/1h), follow-ups 24h/48h e pesquisas de satisfação serão criados pelo usuário em `/automations`.

## Fase 8 — Atualizar docs e validar

- Atualizar `docs/skill-datas.md` §8b com a regra do `origem` human-locked, o destino `Nutrição antigos` (≠ `Nutrição inativa`) e a janela do monthly sweep.
- Atualizar `docs/pipeline/runtime/DETERMINISTIC_RULES.md` com os destinos corretos.
- Rodar o `pipeline-replay.ts` em modo dry-run contra alguns leads de exemplo para validar transições.

## Detalhes técnicos consolidados

- Arquivos tocados: `pipeline-classify/context.ts`, `pipeline-classify/agent-core.ts`, `pipeline-run-executor/apply.ts`, `pipeline-deterministic/index.ts`, `CustomFieldsPanel.tsx`, migrations (lock humano + aliases), `app_settings` (1 update).
- Não cria automações de mensagem em código — tudo via UI `/automations`.
- Não mexe nos gates G10/G11 já existentes.

## O que difere do plano original

| Plano original | Plano revisado |
|---|---|
| `UPDATE` em 3 toggles | Só 1 toggle (os outros 2 já estão `true`) |
| Regra "1ª mensagem" só no prompt | Heurística determinística no contexto + prompt no Summarizer/Typifier/Maestro |
| `origem` protegida via prompt | Lock humano real em `lead_custom_fields` + skip no `apply.ts` |
| Não menciona colunas novas | Conferência/aliases para `Tratamento agendado`, `1ª Sessão Finalizada`, `Nutrição antigos`, `Nutrição inativa` |
| Monthly sweep ligado sem ajuste | Ajusta origem (2 stages) e janela (dia 2→último dia) antes de ligar |
