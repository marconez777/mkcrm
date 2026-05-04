# Manual do Usuário

CRM de WhatsApp com IA, dividido nos módulos: **Inbox**, **Kanban**, **Agentes**, **Automações**, **Tarefas**, **Templates**, **Métricas** e **Settings**.

---

## 1. Acesso (Auth)

A aplicação exige login. Em `/auth` você cria conta ou entra com email/senha. Após autenticado, todas as rotas ficam disponíveis via `ProtectedRoute`. Detalhes técnicos em [AUTH.md](AUTH.md).

---

## 2. Configuração inicial (Settings)

Acesse `/settings`:

1. **Instâncias WhatsApp** — você pode cadastrar **múltiplas instâncias** Evolution (`whatsapp_instances`). Cada instância tem URL, API key, nome da instância e seu próprio `webhook_token`. Marque uma como default.
2. **Webhook** — clique em **Salvar/Configurar** para registrar o webhook automaticamente na Evolution apontando para `evolution-webhook?token=...`.
3. **Conexão** — verifique status (`open`, `connecting`, `close`).
4. **Atendentes** — cadastre operadores (nome + cor).
5. **Respostas rápidas** — atalhos disparados via `/comando` no composer.
6. **Campos customizados** — em `/settings/custom-fields` você define campos (texto, número, data, select, etc.) exibidos no ContextRail.

---

## 3. Inbox (`/inbox`)

Três colunas: lista de conversas, chat e ContextRail.

### 3.1 Lista lateral
- Ordenada por última mensagem.
- Badge de não lidas, conversas fixadas (`pinned_at`) e marcadas como não lidas (`marked_unread`).
- Filtros por atendente, tag, arquivadas, pipeline.
- **+ Nova conversa**: inicia conversa por telefone.

### 3.2 Chat
- Histórico carregado uma vez; atualizações chegam via Realtime.
- Ao abrir, o contador de não lidas zera.
- **Refresh manual** força reconciliação com a Evolution.
- **Composer**: Enter envia, Shift+Enter quebra linha. `/` abre menu de respostas rápidas. Clique em uma mensagem para citá-la (reply).
- **Encaminhar** mensagem para outro lead (`ForwardDialog`).
- **Agendar mensagem** (`ScheduleMessageDialog`): define data/hora; o `scheduled-dispatcher` envia automaticamente.
- **Áudio**: mensagens de voz são transcritas pela função `transcribe-audio`.
- **Notas internas**: comentários só visíveis para o time, separados das mensagens do cliente.

### 3.3 ContextRail
Detalhes do lead: nome, telefone, email, empresa, valor, tags, anotações, atendente, estágio, pipeline. Editável inline. Mostra também:
- **Campos customizados** (`CustomFieldsPanel`).
- **Tarefas do lead** (`LeadTasksPanel`).
- **Mensagens agendadas** (`ScheduledMessagesPanel`).
- **IA do lead**: agente atribuído, auto-reply on/off, pausa temporária.

---

## 4. Kanban (`/`)

Pipeline visual com suporte a **múltiplos pipelines** (sales/internal).

- **PipelineSwitcher** alterna entre pipelines.
- **PipelineSidebar** lista pipelines e permite criar/editar/excluir.
- **PipelineOverview** mostra KPIs do pipeline atual.
- **Colunas (estágios)** configuráveis com cor e posição.
- **Drag de cards** entre colunas muda `stage_id` e registra `lead_events`.
- **Pan horizontal do board**: clique e arraste o **fundo** para rolar lateralmente. Os cards continuam draggable; o sensor de DnD foi isolado para reagir só a `[data-kanban-card]`.
- **TopScrollbar**: barra de rolagem horizontal sempre visível no topo.
- Clique num card para abrir o **LeadDrawer**.

---

## 5. Agentes de IA (`/agents`)

Crie agentes com RAG para responder leads automaticamente. Detalhes completos em [AI.md](AI.md).

- **Configuração**: nome, prompt, modelo (Lovable AI Gateway ou provider próprio), temperatura, ferramentas, RAG top-K, debounce.
- **Base de conhecimento**: ingestão de documentos (texto, PDF, URLs).
- **Threads e mensagens**: histórico de conversas do agente (`ai_threads`, `ai_messages`).
- **Auto-reply por lead**: ative em `lead_ai_settings` (via ContextRail).
- **MCP servers**: integração com servidores Model Context Protocol.
- **Evals**: rodar avaliações automatizadas (`agent_evals`).

---

## 6. Automações (`/automations`)

Crie regras "quando X, faça Y". Detalhes em [AUTOMATIONS.md](AUTOMATIONS.md).

- Gatilhos: nova mensagem, mudança de estágio, tag adicionada, etc.
- Ações: enviar mensagem, mover de estágio, atribuir atendente, criar tarefa, ativar/pausar IA.
- Execução por `automations-tick` (cron). Histórico em `automation_runs`.

---

## 7. Tarefas (`/tasks`)

Lista global de tarefas vinculadas a leads (`lead_tasks`). Vencimento, status concluído, criação inline a partir do ContextRail.

---

## 8. Templates (`/templates`)

Mensagens reutilizáveis com variáveis (`{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, customizadas). Podem ter atalho para uso rápido.

---

## 9. Métricas (`/metrics` e `/metrics/ops`)

- **/metrics**: KPIs de atendimento — leads por estágio, conversões, tempo médio, mensagens enviadas.
- **/metrics/ops**: métricas operacionais — saúde de instâncias, throughput de webhook, custo de IA (`ai_usage`), runs de automação.

---

## 10. Tempo real

Webhook Evolution → backend → Postgres → Realtime → UI. Tabelas publicadas: `leads`, `messages`, `pipeline_stages`, `pipelines`, `attendants`, `quick_replies`, `lead_tasks`, `lead_internal_notes`, `scheduled_messages`. A ingestão é **idempotente** (`webhook_dedup` + chave `(lead_id, external_id)`).

---

## 11. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Mensagens não chegam | Webhook não configurado / token errado | Settings → Instâncias → Salvar webhook |
| Status "connecting" | Sessão WhatsApp caiu | Re-escanear QR na Evolution |
| Mensagem agendada não saiu | Cron `scheduled-dispatcher` parado | Ver logs da função |
| IA não responde | Auto-reply off, agente sem API key, debounce alto | Conferir `lead_ai_settings` e configuração do agente |
| Pipeline não rola lateral | Sensor DnD interceptando | Use o fundo do board (não os cards) — comportamento por design |
| Custo de IA alto | Top-K muito grande, modelo caro | Reduzir `rag_top_k`, trocar para gemini-flash |
