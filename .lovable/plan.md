
# CRM WhatsApp com Kanban + Evolution API

Não é difícil — sua infra já está pronta (Evolution rodando na VPS), então o trabalho aqui é só construir a interface do CRM e plugar nos endpoints da Evolution. Vamos fazer um MVP enxuto, focado em funcionar bem.

## O que vamos construir

### 1. Configuração da Evolution API
Tela de **Configurações** onde você cola:
- URL base da sua Evolution (ex: `https://evolution.seudominio.com`)
- API Key global
- Nome da instância que vai usar
- URL do webhook (gerada automaticamente pra você colar no Evolution)

Botão **"Testar conexão"** que chama `/instance/connectionState` e mostra se está conectado, e um QR code caso precise reconectar.

### 2. Pipeline Kanban (tela principal)
- Colunas customizáveis (criar, renomear, reordenar, excluir). Padrão inicial: `Novo Lead → Em atendimento → Qualificado → Proposta → Ganho / Perdido`
- Cards de lead com: nome, telefone, última mensagem, tag, valor do negócio, atendente responsável, tempo parado na coluna
- Drag & drop entre colunas
- Click no card abre o **drawer do lead** com chat + dados

### 3. Caixa de entrada / Chat
- Lista de conversas (igual WhatsApp Web): foto, nome, prévia da última mensagem, badge de não lidas, ordenado por mais recente
- Painel de chat: histórico de mensagens (texto, imagem, áudio, doc — exibir; envio só de texto no MVP), campo de resposta, indicador de "enviado/entregue/lido"
- Tempo real: novas mensagens aparecem sem refresh (via polling a cada 3s no MVP, ou Realtime do Supabase consumindo o webhook)

### 4. Cadastro de leads
- Cada contato do WhatsApp vira automaticamente um lead na coluna "Novo Lead" na primeira mensagem recebida
- Campos: nome, telefone, e-mail, empresa, valor, etapa, atendente, tags (múltiplas), anotações (timeline)
- Campos customizáveis: você define campos extras (texto, número, data, select) em Configurações

### 5. Múltiplos atendentes + atribuição
Sem login no MVP (você confirmou uso pessoal), mas já deixamos a estrutura:
- Cadastro simples de "atendentes" (nome + cor)
- Cada lead pode ser atribuído a um atendente
- Filtro do Kanban por atendente
- (Login real fica fácil de adicionar depois quando quiser abrir pra equipe)

## Como conecta com a Evolution

```text
WhatsApp ──► Evolution API ──► Webhook ──► Edge Function ──► DB ──► UI (realtime)
                  ▲                                                    │
                  └────────── Envio de mensagem ◄──────────────────────┘
```

- **Recebimento**: Edge Function `evolution-webhook` recebe eventos (`MESSAGES_UPSERT`, `CONNECTION_UPDATE`, `CONTACTS_UPSERT`), salva no banco, dispara realtime pro front
- **Envio**: Edge Function `send-message` chama `POST /message/sendText/{instance}` da sua Evolution usando a API key salva
- **Histórico inicial**: ao conectar a instância, importa contatos via `/chat/findContacts` e cria leads

## Detalhes técnicos

- **Backend**: Lovable Cloud (Supabase) — Postgres + Edge Functions + Realtime + Storage (pra mídias)
- **Tabelas**: `settings`, `pipeline_stages`, `attendants`, `leads`, `lead_custom_fields`, `conversations`, `messages`, `tags`
- **Sem login** no MVP, mas tabelas já preparadas com `user_id` opcional pra plugar auth depois
- **Webhook**: a Edge Function gera uma URL pública que você cola no painel da Evolution (`Webhook` da instância) com os eventos: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`, `CONTACTS_UPSERT`
- **Realtime**: Supabase Realtime nas tabelas `messages` e `leads` pra UI atualizar sozinha
- **Stack UI**: React + Tailwind + shadcn/ui, `@dnd-kit` pro Kanban

## Fora do MVP (deixar pra depois)
- Login multi-usuário real
- Chatbot / fluxos automáticos (pode plugar no n8n que você já tem)
- Envio de mídia (só recebimento no MVP)
- Relatórios e métricas
- Disparos em massa

## Próximo passo
Aprovando, eu já começo: ativo o Lovable Cloud, crio o schema do banco, as edge functions de webhook/envio, e a UI (Configurações → Kanban → Chat). Quando estiver de pé, te passo a URL do webhook pra colar na sua Evolution e testamos juntos.
