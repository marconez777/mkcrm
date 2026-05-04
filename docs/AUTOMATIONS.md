# Automações

Regras "quando X, faça Y" sobre eventos do CRM. Cadastradas em `/automations` e executadas pelo cron `automations-tick`.

> **Estado atual**: o motor implementa **2 triggers** e **3 actions**. Outras combinações citadas em versões anteriores destas docs ainda não existem no código.

## Tabelas

### `automations`
Colunas reais:
- `id uuid pk`, `name text`, `description text?`, `enabled bool`.
- `trigger_type text` — ver lista abaixo.
- `trigger_config jsonb` — parâmetros do gatilho.
- `action_type text` — ver lista abaixo.
- `action_config jsonb` — parâmetros da ação.
- `cooldown_hours int` (default 24) — janela em que uma mesma automação não roda duas vezes para o mesmo lead.
- `created_at`, `updated_at`.

### `automation_runs`
Histórico: `automation_id`, `lead_id`, `status` (`success|failed|skipped`), `detail text` (truncado em 500 chars), `created_at`.

## Triggers implementados

| `trigger_type` | `trigger_config` | Quando dispara |
|---|---|---|
| `no_reply_after` | `{ hours: number, stage_id?: uuid }` | Lead com `last_message_at <= now() - hours` cuja **última mensagem é inbound** (`from_me=false`) e não está arquivado. |
| `stage_idle` | `{ stage_id: uuid, hours: number }` | Lead parado no estágio há mais de `hours` (via `stage_changed_at`). |

## Actions implementadas

| `action_type` | `action_config` | Efeito |
|---|---|---|
| `ai_followup` | `{ agent_id: uuid, prompt?: string }` | Pega últimas 20 mensagens, chama `ai-chat` com a instrução interna do prompt e envia a resposta via `evolution-send`. |
| `move_stage` | `{ stage_id: uuid }` | Atualiza `leads.stage_id`. |
| `send_template` | `{ template_id: uuid }` ou `{ content: string }` | Envia template (com substituição básica de variáveis) via `evolution-send`. |

Qualquer outro `action_type` retorna `unknown action`.

## Execução

`automations-tick` é uma edge function chamada por cron. Em cada tick:

1. Lê `automations` com `enabled=true`.
2. Para cada automação, calcula candidatos via `findCandidates(trigger)`.
3. Para cada candidato, verifica `recentlyRan(automation_id, lead_id, cooldown_hours)`.
4. Executa a ação; loga em `automation_runs` (`success` / `failed` com `detail`).

## Boas práticas

- Combine com IA: use cooldown alto em `ai_followup` para não saturar o lead.
- Sempre teste com um lead de QA antes de habilitar.
- Acompanhe `automation_runs` para detectar regras que falham (`status='failed'`).

## Roadmap

Triggers/ações úteis ainda **não implementadas** (PRs bem-vindos): `message_received`, `tag_added`, `lead_created`, `assign_attendant`, `add_tag`, `pause_ai`, `webhook`, `set_custom_field`.
