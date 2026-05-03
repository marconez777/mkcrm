
# Camada de resiliência production-grade para Evolution API

Entendido — vamos tratar como produção real, não MVP. A pesquisa que você trouxe é precisa: 90% dos problemas de CRM com Evolution vêm de eventos não entregues, webhook que se desativa sozinho, e duplicações em reconnect. Abaixo, a defesa em camadas que vou implementar. Cada item ataca um ou mais dos bugs que você listou.

## Princípio: nunca confiar só no webhook

A Evolution **vai** falhar em algum momento. Nossa estratégia: webhook é o caminho rápido (tempo real), mas **toda mensagem é também reconciliada por polling**. Se um caminho falha, o outro entrega. E ambos passam por dedup forte no banco.

## O que vamos construir

### 1. Watchdog automático (resolve #1, #3, #6, #7)
Edge function `evolution-health` rodando via `pg_cron` **a cada 60 segundos**:
- `GET /instance/connectionState/{instance}` — registra estado em `settings.connection_state`. Se `close` por >2 min, gera alerta crítico no app.
- `GET /webhook/find/{instance}` — se o webhook estiver desativado, com URL errada, ou faltando algum evento essencial, **reativa automaticamente** via `POST /webhook/set/{instance}`. Mata o bug v2.2.3 (toggle desliga sozinho) e regressões pós-update.
- Atualiza `settings.last_health_check`, `settings.webhook_ok`, `settings.connection_state`.

### 2. Polling de reconciliação (resolve #2, #4 — eventos perdidos)
A mesma `evolution-health`, ao rodar, chama `POST /chat/findMessages/{instance}` filtrando mensagens dos **últimos 10 minutos**. Faz upsert em `messages` com índice único — o que já estava entra silenciosamente; o que faltou aparece. Janela de 10 min cobre folga de cron, restart, e atrasos da Evolution.

### 3. Reconciliação on-demand por lead (resolve #4 em tempo real)
Ao abrir o `LeadDrawer`, dispara `evolution-sync-lead` em paralelo: busca últimas 50 mensagens daquele número e faz upsert. Se algo sumiu naquela conversa específica, aparece no momento que o atendente abre.

### 4. Envio resiliente com fila e retry (resolve #5)
`evolution-send` reescrita:
- Cria a mensagem no banco com `status='pending'` **antes** de chamar a Evolution (atendente já vê na UI).
- Retry exponencial: 3 tentativas (0s, 2s, 5s) em 5xx/408/429/erro de rede.
- Sucesso → `status='sent'`. Falha total → `status='failed'` + UI mostra ícone vermelho + botão "Reenviar".
- Idempotência: gera `client_message_id` (UUID) para evitar duplicar se a Evolution responder após timeout.

### 5. Deduplicação real no banco (resolve #5 — duplicações em reconnect)
```sql
CREATE UNIQUE INDEX messages_lead_external_unique
  ON messages(lead_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX messages_client_id_unique
  ON messages(client_message_id) WHERE client_message_id IS NOT NULL;
```
Sem índice único de verdade, `onConflict` do supabase-js não dedupa de forma confiável.

### 6. Auditoria de webhook events
Tabela nova `webhook_events(id, event_type, payload, received_at, processed_at, error, lead_id)`. Toda chamada do webhook é gravada **antes** do processamento. Benefícios:
- Diagnóstico: "essa msg chegou mas falhou no parsing?"
- Replay: botão "reprocessar" eventos com erro.
- Métrica: quantos eventos/min, taxa de erro.
- Limpeza automática (>14 dias).

### 7. Painel de saúde na UI
Nova seção em **Configurações** (e badge no header):
- Estado da conexão (verde/amarelo/vermelho) com tempo desde último heartbeat.
- Webhook OK? Eventos corretos configurados?
- Mensagens recebidas/enviadas nas últimas 24h.
- Mensagens com `status='failed'` (acionável).
- Botões: "Reativar webhook agora", "Sincronizar últimas 24h", "Ver eventos do webhook".

### 8. Alertas (opcional mas recomendado)
Quando `connection_state='close'` por >5 min ou taxa de erro >10%, envia notificação. No MVP: badge persistente vermelho no app. Posso adicionar e-mail depois se quiser.

### 9. Lock de processamento (resolve race conditions)
O `unread_count` atualmente tem race condition (lê depois escreve). Trocar por função RPC atômica:
```sql
CREATE FUNCTION increment_unread(lead_id uuid) RETURNS void ...
```

### 10. Observabilidade
- Logs estruturados em todas edge functions (JSON com `event_id`, `lead_id`, `phone`, `latency_ms`).
- Página `/admin/logs` mostrando últimas 100 chamadas de webhook + erros.

## Resumo técnico

**Migrations:**
- `messages`: + `client_message_id uuid`, `retry_count int`, índices únicos parciais.
- `settings`: + `connection_state`, `last_health_check`, `webhook_ok`, `webhook_last_error`.
- Tabela nova `webhook_events`.
- RPC `increment_unread(lead_id)`.

**Edge functions:**
- `evolution-health` (nova, agendada): connection check + webhook self-heal + polling reconciliação 10 min.
- `evolution-sync-lead` (nova): reconciliação por lead.
- `evolution-send` (reescrita): pending→retry→sent/failed, idempotente.
- `evolution-webhook` (reforçada): grava em `webhook_events`, dedup via índice, RPC atômico.

**Cron:** `pg_cron` + `pg_net` chamando `evolution-health` a cada 60s. Vou criar o SQL do agendamento via insert tool (não migration, porque tem URL/token específicos do projeto).

**Frontend:**
- `Settings.tsx`: card de saúde + auditoria.
- `LeadDrawer.tsx`: sync ao abrir + botão reenviar.
- `AppShell.tsx`: badge global de status.
- Nova página `/admin/events` com webhook events.

## Limites honestos

- Se a Evolution **nem recebeu** a msg do WhatsApp (sessão Baileys derrubada pela Meta), nada na nossa camada resolve — mas o watchdog detecta e te avisa em <2 min, e o polling pega assim que voltar.
- Se a VPS da Evolution cair, idem — alerta visual imediato.
- Mudanças do Baileys/Meta exigem update da Evolution (fora do nosso código).

## Próximo passo
Aprovando, eu executo nesta ordem: (1) migrations e índices, (2) edge functions novas + reescrita das existentes, (3) cron job, (4) UI de saúde + auditoria, (5) testes manuais com você (derruba webhook propositalmente, vê reativar; manda msg com instância parada, vê fila pending).
