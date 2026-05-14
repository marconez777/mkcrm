# Automação de Mensagens (Sequências)

> Recurso tipo "automação de e-mails" para WhatsApp. Sequências de mensagens pré-configuradas que disparam por gatilhos, enviam em intervalos controlados e param automaticamente quando o lead responde.

## Visão geral do fluxo

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  Gatilho    │────▶│  Enrollment     │────▶│  Cron (sequence-tick)│
│             │     │  (fila interna) │     │  a cada 1 min        │
└─────────────┘     └─────────────────────┘  └──────────┬───────────┘
   │                                                    │
   ├ Lead movido para coluna X                          ├ Step 1 (0min)
   ├ Webhook do site (teste depressão)                  ├ Step 2 (+2h)
   └ Manual (botão no drawer do lead)                   └ Step N (+1d)

Parada automática: lead respondeu  |  Cancelamento manual
```

## Tabelas

### `message_sequences`
Definição da sequência.
- `id`, `clinic_id`, `name`, `description`.
- `enabled bool` — liga/desliga a sequência inteira.
- `trigger_type` (`stage_enter`|`webhook`|`manual`) + `trigger_config jsonb`.
  - `stage_enter`: `trigger_config = { stage_id }`.
  - `webhook`: `trigger_config = {}`, usa `public_token` único.
  - `manual`: só dispara via botão no lead ou chamada à edge function.
- `whatsapp_instance_id uuid` — instância dedicada para envio; `null` = usa a instância padrão do lead.
- `stop_on_reply bool` (default `true`) — pausa enrollment se lead responder.
- `cooldown_days int` (default `30`) — não reinscreve o mesmo lead nesse intervalo.
- `public_token text unique` — token de autenticação do webhook público (gerado automaticamente).

### `message_sequence_steps`
Passos da sequência, ordenados por `position`.
- `sequence_id`, `position int`, `delay_minutes int`.
- `template_id uuid` — referencia `message_templates` (opcional).
- `content text` — texto livre com variáveis `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}`.
- `send_window jsonb` — opcional. Ex: `{ start_hour: 8, end_hour: 20, weekdays: ['mon','tue',...], timezone: 'America/Sao_Paulo' }`. Fora da janela o cron adia 30 min e tenta de novo.

### `message_sequence_enrollments`
Inscrição de um lead em uma sequência (fila de execução).
- `sequence_id`, `lead_id`.
- `status` (`active`|`completed`|`canceled`|`stopped_by_reply`|`failed`).
- `current_step int` — índice do próximo step a executar (0-based).
- `next_run_at timestamptz` — quando o cron deve processar.
- `started_at`, `ended_at`.
- `source jsonb` — origem da inscrição (`{ trigger: 'stage_enter'|'webhook'|'manual', ... }`).
- Índices: `msenroll_active_idx(status, next_run_at) WHERE status='active'` (usado pelo cron), `msenroll_lead_idx(lead_id)`, `msenroll_seq_lead_idx(sequence_id, lead_id)`.

### `message_sequence_runs`
Log de cada envio tentado.
- `enrollment_id`, `step_id`.
- `status` (`sent`|`failed`|`skipped`).
- `message_id uuid` — referencia `messages` se enviado com sucesso.
- `detail text` — texto enviado (truncado) ou mensagem de erro.

## Gatilhos de inscrição

### 1. `stage_enter` — movimento de coluna (trigger DB)
- Trigger `trg_enroll_on_stage_change` em `leads` (AFTER UPDATE OF stage_id).
- Para cada sequência `enabled` com `trigger_type='stage_enter'` cujo `trigger_config.stage_id` bata com o novo `stage_id`, cria um enrollment.
- Respeita `cooldown_days`: se já existe enrollment recente, ignora.

### 2. `webhook` — site externo
- Endpoint público `POST /functions/v1/sequence-trigger` (sem JWT).
- Body:
  ```json
  {
    "token": "<public_token da sequência>",
    "phone": "+5511999999999",
    "name": "Joana",
    "email": "...",
    "tags": ["teste-depressao"],
    "metadata": { ... }
  }
  ```
- A função:
  1. Valida o token e se a sequência é `webhook` + `enabled`.
  2. Busca lead pelo `phone` na clinic; se não existir, cria com pipeline padrão.
  3. Faz merge de campos ausentes (`name`, `email`) e append de `tags`.
  4. Verifica cooldown.
  5. Cria enrollment com `source.trigger = 'webhook'`.
  6. Retorna `{ ok, lead_id, enrollment_id }` (ou `deduped: true`).

### 3. `manual` — botão no drawer do lead
- UI chama `sequence-enroll` (edge function interna, com JWT).
- Body: `{ sequence_id, lead_id }`.
- Respeita cooldown e `enabled`. Cria enrollment com `source.trigger = 'manual'`.

## Parada automática por resposta

- Trigger `trg_stop_sequences_on_reply` em `messages` (AFTER INSERT).
- Quando chega mensagem inbound (`from_me = false`), busca enrollments `active` do lead cujas sequências tenham `stop_on_reply = true` e marca como `stopped_by_reply` + `ended_at = now()`.
- Acontece no momento do INSERT, antes do cron processar o próximo step.

## Motor de execução (cron)

### Edge function `sequence-tick`
- Chamada a cada 1 minuto via `pg_cron`.
- Busca até 50 enrollments `active` com `next_run_at <= now()` (índice `msenroll_active_idx`).
- Para cada um:
  1. Carrega sequência, steps e lead.
  2. Se sequência desabilitada → cancela enrollment.
  3. Se lead não existe mais → marca como `failed`.
  4. Resolve conteúdo do step atual: `template_id` → busca `message_templates.content`; senão usa `content`.
  5. Substitui variáveis (`renderVars`).
  6. Verifica `send_window`; se fora do horário, empurra 30 min.
  7. Se conteúdo vazio → grava `skipped` e avança step.
  8. Se `sequence.whatsapp_instance_id` estiver definido, faz um patch temporário no lead (`leads.whatsapp_instance_id`) para que `evolution-send` use a instância correta.
  9. Chama `evolution-send` (com `client_message_id` aleatório para idempotência).
  10. Sucesso → grava run `sent`, agenda próximo step (`next_run_at = now() + delay_minutes do próximo step`). Se não há próximo step → `completed`.
  11. Falha → grava run `failed`, retry em 15 min. Após 3 falhas no mesmo step → `failed`.

### Retry e tolerância a falha
- Falhas de envio são retentadas automaticamente a cada 15 min.
- Máximo de 3 tentativas por step (contadas em `message_sequence_runs` com `status='failed'`).
- Se ultrapassar 3 falhas, o enrollment inteiro vai para `failed`.

## Frontend (`/sequences`)

### Tela principal (`src/pages/Sequences.tsx`)
Layout de 3 painéis:
- **Sidebar esquerda**: lista de sequências, com indicador `enabled`/`off` e botões "Executar agora" (chama `sequence-tick` manualmente) e "Nova sequência".
- **Editor central** (abas):
  - **Configuração**: nome, descrição, ativar/desativar, instância WhatsApp, cooldown, stop_on_reply, e gatilho.
    - Gatilho `stage_enter`: dropdown de estágios.
    - Gatilho `webhook`: exibe URL pública, token, e botão para copiar snippet `fetch` pronto.
    - Gatilho `manual`: explicação.
  - **Mensagens**: lista ordenável de steps. Cada step tem: atraso (minutos), template (opcional), texto livre com preview de variáveis. Botões de reordenar e excluir.
  - **Inscritos**: últimos 50 enrollments da sequência, com nome/telefone do lead, status, próximo step e data.

## Variáveis suportadas nos templates

| Variável | Substituição |
|---|---|
| `{{nome}}` | `lead.name` ou `lead.phone` |
| `{{primeiro_nome}}` | Primeira palavra de `lead.name` |
| `{{telefone}}` | `lead.phone` |
| `{{email}}` | `lead.email` |
| `{{empresa}}` | `lead.company` |

## Múltiplas instâncias de WhatsApp

Cada sequência pode ter uma `whatsapp_instance_id` própria. Isso permite, por exemplo, uma instância dedicada só para disparos automáticos, separada da instância principal de atendimento humano.

- A instância é escrita temporariamente no lead (`leads.whatsapp_instance_id`) antes do `evolution-send`, **apenas quando o lead não tem instância própria definida**.
- Se o lead já tem `whatsapp_instance_id`, o CRM mantém a instância do lead (a sequência não sobrescreve).
- O cadastro de novas instâncias reutiliza o fluxo existente de `evolution-provision` + QR (tela de Configurações).

## RLS e segurança

- Todas as 4 tabelas usam policy `clinic_scoped`: `clinic_id = current_clinic_id()`.
- `sequence-trigger` é o único endpoint público (sem JWT); autenticação é por `public_token`.
- `sequence-enroll` e `sequence-tick` exigem JWT (ou service-role key para cron interno).

## Pontos de extensão (futuro)

- **IA por step**: adicionar flag `use_ai` no step, que antes do envio passa o template + contexto do lead pelo Lovable AI Gateway para personalizar o texto.
- **Webhook externo como executor**: em vez de enviar via `evolution-send`, um step poderia ter `action_type='webhook'` que chama uma URL (ex: n8n) com o lead e conteúdo renderizado.
- **Condicionais**: steps com condições (ex: só enviar se lead tiver tag X).
- **Métricas**: taxa de abertura (resposta) por sequência, tempo médio até resposta.

## Dependências

- `evolution-send` — envio de mensagens WhatsApp.
- `pg_cron` — agendamento do `sequence-tick`.
- `message_templates` — templates reutilizáveis nos steps.
- `leads`, `pipeline_stages`, `pipelines` — para gatilho de stage e criação de lead via webhook.
