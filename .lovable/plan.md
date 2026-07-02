## Ajuste do SLA de "Paciente antigo" → "Nutrição Antigos"

### O que muda
Hoje o cron `pipeline-deterministic` (branch `ruleInactivityTick`) só move um lead de **Paciente antigo** para **Nutrição Antigos** se ele estiver há **60 dias** sem interação. Se o lead **não tem nenhuma data** de interação (nem `last_inbound_at`, nem `last_message_at`), ele fica preso — nunca entra no filtro.

Vamos:

1. **Baixar o gatilho de 60 → 40 dias**.
2. **Incluir também os leads sem data alguma** de interação (ambas as colunas `NULL`) para que sejam movidos no próximo tick.
3. **Confirmar que a regra está habilitada** (`automation.inactivity_paciente_antigo.enabled` = true) — se estiver `off`, o cron nem roda esse branch, o que explicaria "não sei se está funcionando".

### Onde
- `supabase/functions/pipeline-deterministic/index.ts` (linhas 642–678):
  - Trocar `60 * 24 * 3600 * 1000` por `40 * 24 * 3600 * 1000`.
  - Ajustar o filtro `.or(...)` para: `last_inbound_at.lt.<cutoff40>` **OU** `and(last_inbound_at.is.null, last_message_at.lt.<cutoff40>)` **OU** `and(last_inbound_at.is.null, last_message_at.is.null)`.
  - Atualizar `reason` e `idempotencyKey` de `60d`/`ym` para `40d`/`ym` (mantém idempotência mensal, mas com novo prefixo `40d` para não colidir com runs antigos).
  - Renomear a métrica `tier60pa` → `tier40pa` no retorno.

- Verificar via query no banco se `app_settings.automation.inactivity_paciente_antigo.enabled` está `true`. Se estiver `false`/ausente, ligar via `supabase--insert`.

### Docs a atualizar
- `docs/archive/AUTOMATION_V5_ARCHITECTURE.md` e `docs/archive/ROADMAP_AUTOMATION_V5.md`: trocar as menções de "60 dias" → "40 dias".
- `docs/maps/PIPELINE_RUNTIME.md` (se citar a janela).

### Fora de escopo
- Não altero a lógica de reactivação (Nutrição Antigos → Paciente antigo quando o lead responde).
- Não mexo em Kanban / UI: o move ocorre pelo cron a cada execução agendada.

### Observação
Como o cron roda em intervalo agendado (não instantâneo), a movimentação em massa acontece no próximo tick após o deploy. Se quiser, disparo o `pipeline-deterministic` manualmente uma vez depois do merge para varrer imediatamente.