# Helpers do Pipeline V6

O núcleo da V6 centralizou operações críticas de segurança e regras transversais em helpers compartilhados localizados em `supabase/functions/_shared`.

## `pipelineMove()` (`pipeline-move.ts`)
A função mais importante de movimentação do funil. **Todas** as regras automáticas (seja determinísticas ou via Classifier) DEVEM usar essa função para mover um card. Nunca se faz `UPDATE leads SET stage_id = ...` diretamente no código da V6.

### Proteções e Gates (Segurança em Profundidade)
Ao invocar `pipelineMove()`, o sistema aplica a seguinte ordem de restrições de maneira transacional:
1. **Gate G3 (Toggle de Regra):** Verifica dinamicamente na tabela `app_settings` se a automação invocadora (ex: `automation.b2b_move.enabled`) está ativa. Se não, aborta silenciosamente.
2. **Gate G4 (Idempotência):** Checa se um registro idêntico com a mesma `idempotencyKey` já existe na tabela `lead_events`. Evita que o LLM duplique um movimento ou que triggers paralelos do banco corrompam o fluxo.
3. **Allowlist:** Consulta o `pipeline_automation_allowlist` para ver se a clínica e o respectivo pipeline estão autorizados a usar o auto-move.
4. **Gate G2 (Destino Bloqueado):** Aborta a ação caso o estágio destino esteja marcado com `lock_auto_move = true` (ex: colunas de erro manual).
5. **Guard D3 (Proteção de Paciente Antigo):** Bloqueia qualquer movimentação automática de um lead que já esteja no estágio "Paciente antigo" (pois o ciclo foi finalizado e novos agendamentos não devem removê-lo de lá), com a única exceção permitida sendo a movimentação cronometrada para "Nutrição inativa".
6. **Wipe Centralizado de Chips:** Limpa proativamente custom_fields perecíveis (como a data de `consulta_agendada_em` ao chegar em "Consulta finalizada" ou `interesse` ao sair de "Qualificação").
7. **Gate G8:** O próprio update assegura que a alteração seja atômica afetando apenas `stage_id` e `stage_changed_at`.

### Side-effects Automáticos
Se o lead for movido com sucesso, o helper dispara ações assíncronas (via `EdgeRuntime.waitUntil`):
1. Cria a trilha de auditoria em `lead_stage_history` preenchendo a coluna `source` e o motivo (`reason`).
2. Notifica a Edge Function `pipeline-post-move-verifier` (Hook A2) para que o Agente Verificador de rollback analise se a transição automatizada fez sentido.
3. Notifica o `applyStageBindings` para potencialmente incluir o lead em sequências de mensagens.
