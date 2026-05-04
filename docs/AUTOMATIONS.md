# Automações

Regras "quando X, faça Y" sobre eventos do CRM. Cadastradas em `/automations`.

## Tabelas

### `automations`
- `id`, `name`, `enabled bool`.
- `trigger` — tipo do gatilho (ex.: `message_received`, `stage_changed`, `tag_added`, `lead_created`, `no_reply_for`).
- `conditions jsonb` — filtros opcionais (estágio, tag, atendente, regex de mensagem).
- `actions jsonb` — lista ordenada de ações.
- `created_at`, `updated_at`.

### `automation_runs`
Histórico de execução: `automation_id`, `lead_id`, `status` (`success|failed|skipped`), `payload`, `error`, `created_at`.

## Gatilhos suportados

| Trigger | Quando dispara |
|---|---|
| `message_received` | Nova mensagem de cliente (`from_me=false`). |
| `message_sent` | Nova mensagem do operador. |
| `stage_changed` | Lead muda de estágio. |
| `tag_added` / `tag_removed` | Mudança em `leads.tags`. |
| `lead_created` | Novo lead. |
| `attendant_changed` | Atribuição de atendente. |
| `no_reply_for` | Lead sem resposta por X horas. |

## Ações suportadas

| Ação | Efeito |
|---|---|
| `send_message` | Envia texto (com variáveis) via `evolution-send`. |
| `send_template` | Envia `message_template` resolvendo variáveis. |
| `move_to_stage` | Atualiza `stage_id`. |
| `assign_attendant` | Define `attendant_id`. |
| `add_tag` / `remove_tag` | Mexe em `leads.tags`. |
| `create_task` | Insere em `lead_tasks` com `due_at` relativo. |
| `enable_ai` / `disable_ai` | Atualiza `lead_ai_settings.auto_reply`. |
| `pause_ai` | Define `paused_until` por N minutos. |
| `set_custom_field` | Atualiza `leads.custom_fields`. |
| `webhook` | POST para URL externa. |

## Execução

`automations-tick` é uma edge function chamada por cron (intervalo curto, ex.: 30s). Em cada tick:

1. Lê `automations` com `enabled=true`.
2. Para cada gatilho baseado em evento, lê eventos novos desde o último processamento (`messages`, `lead_events`, etc.).
3. Avalia `conditions` contra o lead/evento.
4. Executa `actions` em ordem; pára na primeira falha (registrada em `automation_runs.error`).
5. Para `no_reply_for`, varre `leads` cuja `last_message_at` está fora da janela e não foram processados ainda.

## Variáveis

Em `send_message`/`send_template`: `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}`, `{{atendente}}`, `{{estagio}}`, mais qualquer chave de `custom_fields` como `{{custom.minha_chave}}`.

## Boas práticas

- Combine com IA: use `disable_ai` antes de mover para um estágio que exige humano.
- Use `no_reply_for` para reativar leads frios.
- Sempre teste com um lead de QA antes de habilitar — ações são imediatas.
- Acompanhe `automation_runs` para detectar regras que falham silenciosamente.
