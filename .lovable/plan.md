
# Automação de Mensagens (sequências tipo email marketing)

Nova tela `/sequences` para criar **sequências de mensagens WhatsApp** disparadas por gatilhos, com steps em intervalos (minutos/horas/dias), parada automática na resposta do lead, e webhook público para o site de testes de depressão criar lead + iniciar sequência.

## Conceito

```
Gatilho  ─▶  Inscreve lead na Sequência  ─▶  Cron processa steps
   │                                              │
   ├ Lead movido para coluna X                    ├ Step 1 (após 0min)
   ├ Webhook do site (teste de depressão)         ├ Step 2 (após 2h)
   └ Manual (botão no lead)                       └ Step N (após 1d)
                                                  
Parada: lead respondeu  |  cancelado manualmente
```

## Tela `/sequences`

- **Lista** de sequências (nome, gatilho, status enabled/paused, nº de inscritos ativos, taxa de resposta).
- **Editor** de sequência:
  - Nome, descrição, enabled.
  - **Gatilho**: `stage_enter` (escolhe pipeline+stage) ou `webhook` (mostra URL pública + token) ou `manual`.
  - **Instância de WhatsApp**: dropdown (instância principal do CRM ou outra cadastrada). Permite cadastrar nova via Evolution.
  - **Parar quando**: lead responder (default on), manualmente.
  - **Cooldown de re-inscrição** (não reentrar nos próximos N dias).
  - **Steps** (lista ordenável):
    - Atraso desde o anterior (valor + unidade min/h/d).
    - Conteúdo: escolhe um Template existente OU texto livre com variáveis `{{nome}}`, `{{primeiro_nome}}`, etc.
    - (Opcional) Janela de envio: só entre HH:MM-HH:MM dias úteis, para não mandar de madrugada.
- **Aba "Inscritos"** por sequência: lista de leads ativos/concluídos/cancelados, com próximo step e botão de cancelar.

## Webhook público para o site

Endpoint `POST /functions/v1/sequence-trigger` (sem JWT):
```json
{ "token": "<sequence_token>", "phone": "+5511...", "name": "Joana", "tags": ["teste-depressao"], "metadata": {...} }
```
- Valida token da sequência.
- Cria/atualiza lead no clinic dono da sequência (matching por phone).
- Inscreve na sequência (respeitando cooldown).
- Retorna `{ ok, lead_id, enrollment_id }`.

O site no outro projeto Lovable só precisa fazer um `fetch` para essa URL com o token que aparece no editor da sequência.

## Schema (migrations)

- **`message_sequences`**: id, clinic_id, name, description, enabled, trigger_type (`stage_enter|webhook|manual`), trigger_config jsonb (stage_id), whatsapp_instance_id, stop_on_reply bool, cooldown_days int, public_token text unique (para webhook), created_at, updated_at.
- **`message_sequence_steps`**: id, sequence_id, position, delay_minutes int, template_id nullable, content text nullable, send_window jsonb nullable (horários permitidos), created_at.
- **`message_sequence_enrollments`**: id, clinic_id, sequence_id, lead_id, status (`active|completed|canceled|stopped_by_reply`), current_step int, next_run_at timestamptz, started_at, ended_at, source jsonb (de onde veio: stage/webhook/manual + payload).
- **`message_sequence_runs`**: id, enrollment_id, step_id, status (`sent|failed|skipped`), message_id nullable, error text, created_at.
- Índice em `enrollments(status, next_run_at)` para o cron.
- RLS clinic_scoped em todas (igual padrão atual).

## Edge functions

1. **`sequence-trigger`** (verify_jwt=false): webhook público descrito acima.
2. **`sequence-enroll`** (interno): cria enrollment, agenda step 1.
3. **`sequence-tick`** (cron a cada 1min): pega enrollments `active` com `next_run_at <= now()`, renderiza variáveis, chama `evolution-send` (com a instância configurada), grava run, avança step ou completa.
4. **Trigger DB** em `leads.stage_id`: chama `sequence-enroll` para sequências com `trigger_type='stage_enter'` e stage correspondente (via pg_net ou hook em edge function que já escuta mudanças — mais simples: cron `sequence-tick` também detecta novos enters comparando `stage_changed_at`).
5. **Hook em `messages` INSERT** (from_me=false): se há enrollment ativo do lead com `stop_on_reply=true`, marca como `stopped_by_reply`. Implementado dentro do `evolution-webhook` que já processa inbound.

## Múltiplas instâncias de WhatsApp

Já existe `whatsapp_instance_id` em `pipelines` e `leads`. Adiciono o mesmo campo em `message_sequences` e o `sequence-tick` passa essa instância para `evolution-send`. Para cadastrar uma nova instância dedicada, reuso o fluxo de `evolution-provision` + QR já existente (na tela de Settings já dá pra criar; deixo um link rápido no editor).

## Sobre o n8n

Não é necessário — tudo que o JSON do n8n faz (ler planilha, filtrar horário, enviar texto) cabe em `sequence-tick` + Evolution. Vantagens de fazer aqui:
- Inscrição automática por stage/webhook (n8n só lê planilha).
- Para na resposta do lead automaticamente.
- Métricas e logs no mesmo lugar do CRM.
- Sem manter dois sistemas.

Se quiser manter o n8n como executor, dá pra adicionar depois um `action_type='webhook'` que chama uma URL configurada — mas sugiro começar nativo.

## Sobre IA / OpenAI

A sequência em si não precisa de IA. Se quiser, em uma versão futura cada step pode ter flag "personalizar com IA" que passa o template + contexto do lead pelo Lovable AI Gateway antes de enviar. Fora do MVP.

## Entregas do MVP

1. Migrations das 4 tabelas + RLS + índices.
2. Edge functions `sequence-trigger`, `sequence-tick` (cron 1min via pg_cron), `sequence-enroll`.
3. Hook de parada em `evolution-webhook` (inbound → stop enrollment).
4. Tela `/sequences` (lista + editor + inscritos) e link no menu lateral.
5. Botão "Inscrever em sequência" no drawer do lead (gatilho manual).
6. Doc curta para colar no projeto do site com o snippet de `fetch` para o webhook.

Me confirma que posso seguir nesse formato (nativo no CRM, sem n8n) que já implemento.
