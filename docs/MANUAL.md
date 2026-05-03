# Manual do Usuário

CRM de WhatsApp com três áreas principais: **Kanban**, **Inbox** e **Settings**.

---

## 1. Configuração inicial (Settings)

Acesse `/settings` e configure:

1. **Evolution URL** — URL base da sua instância Evolution API (ex.: `https://evo.exemplo.com`).
2. **API Key** — chave global da Evolution.
3. **Instance** — nome da instância WhatsApp.
4. **Webhook** — clique em **Salvar/Configurar** para que o sistema registre automaticamente o webhook na Evolution apontando para a edge function `evolution-webhook`.
5. **Conexão** — verifique o status (`open`, `connecting`, etc.) no card de saúde. Se estiver desconectado, escaneie o QR Code pela própria Evolution.

> O `webhook_token` é gerado automaticamente e usado como query param para autenticar chamadas do Evolution.

### Atendentes
Crie atendentes (nome + cor). Eles podem ser atribuídos a leads.

### Respostas rápidas
Cadastre atalhos com variáveis: `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`. Use `/atalho` no composer da Inbox.

---

## 2. Inbox (`/inbox`)

Tela principal de conversas, dividida em três colunas:

### 2.1 Lista lateral (esquerda)
- Conversas ordenadas por última mensagem.
- Badge de **não lidas** por conversa.
- Filtros por atendente, tag, arquivadas.
- Botão **+ Nova conversa**: abre diálogo para iniciar conversa por telefone.

### 2.2 Chat (centro)
- Histórico carregado uma vez na abertura. A partir daí, atualizações chegam via **Realtime** (websocket) — só novas mensagens aparecem, sem recarregar tudo.
- Ao abrir uma conversa, o contador de não lidas zera.
- Botão de **refresh manual** no header força reconciliação com o Evolution (usar quando suspeitar de divergência).
- **Composer**:
  - Texto livre, Enter envia, Shift+Enter quebra linha.
  - `/` abre menu de respostas rápidas.
  - Reply: clique em uma mensagem para citá-la.

### 2.3 ContextRail (direita)
Detalhes do lead: nome, telefone, email, empresa, valor do negócio, tags, anotações, atendente e estágio. Tudo editável inline.

---

## 3. Kanban (`/`)

Pipeline visual de leads.

- Colunas representam **estágios** (configuráveis em Settings).
- Arraste cards entre colunas para mudar de estágio (atualiza `stage_id` e registra evento em `lead_events`).
- Clique num card para abrir o **LeadDrawer** com detalhes completos e link para a conversa.

---

## 4. Como funciona o tempo real

- **Webhook Evolution → backend → Postgres → Realtime → UI.** Quando uma mensagem chega no WhatsApp, ela é salva no banco e enviada via WebSocket para a UI dos clientes conectados.
- A ingestão é **idempotente**: webhook + sync manual podem chegar juntos sem duplicar mensagens nem inflar o contador de não lidas.

---

## 5. Dicas e troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Mensagens não chegam | Webhook não configurado / token errado | Settings → Salvar webhook |
| Status "connecting" persistente | Sessão WhatsApp caiu | Re-escanear QR na Evolution |
| Lista pisca ao abrir conversa | (corrigido) ingestão não idempotente | Garantir versão atual do `_shared/evolution.ts` |
| Mensagem enviada não aparece | Falha no `evolution-send` | Ver `webhook_events` e logs da função |
