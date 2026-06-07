---
title: "Mapa: Inbox + WhatsApp (Evolution API)"
topic: inbox
kind: map
audience: agent
updated: 2026-06-07
summary: Inbox unificado de conversas WhatsApp. Recebe via webhook da Evolution API, persiste em `messages`, exibe em `/inbox`, e envia respostas (manuais ou via IA) de volta. Inclui mídia, agendamento, encaminhamento, tarefas vinculadas, campos per
---
# Mapa: Inbox + WhatsApp (Evolution API)

> **Para localizar edições.** Para entender *por quê*, leia [`docs/integrations/EVOLUTION_API.md`](../integrations/EVOLUTION_API.md), [`docs/flows/INBOUND_WHATSAPP.md`](../flows/INBOUND_WHATSAPP.md), [`docs/flows/OUTBOUND_WHATSAPP.md`](../flows/OUTBOUND_WHATSAPP.md).
> **Última atualização:** 2026-06-03

---

## 1. O que é

Inbox unificado de conversas WhatsApp. Recebe via webhook da Evolution API, persiste em `messages`, exibe em `/inbox`, e envia respostas (manuais ou via IA) de volta. Inclui mídia, agendamento, encaminhamento, tarefas vinculadas, campos personalizados do lead.

## 2. Rotas / pontos de entrada

| Rota | Componente | Função |
|---|---|---|
| `/inbox` | `src/pages/Inbox.tsx` | inbox principal |
| `/inbox?lead=:id` | mesmo | abre conversa específica |
| `/settings/whatsapp` (em `/settings`) | `src/pages/Settings.tsx` + `WhatsAppQrDialog.tsx` | QR / provisionamento |
| `/lead/:id` | `src/pages/LeadDrawer.tsx` | drawer com histórico do lead |

## 3. Frontend

### Páginas
- `src/pages/Inbox.tsx` — orquestra ConversationList + ChatPane + ContextRail.

### Componentes (`src/components/inbox/`)
| Arquivo | Função |
|---|---|
| `ConversationList.tsx` | Lista de conversas (busca, filtros, unread badge) |
| `ChatPane.tsx` | Mensagens da conversa ativa |
| `Composer.tsx` | Input de envio (texto, mídia, quick replies) |
| `ContextRail.tsx` | Painel lateral direito (lead info, tasks, scheduled) |
| `CustomFieldsPanel.tsx` | Edição de `leads.custom_fields` |
| `LeadTasksPanel.tsx` | Tarefas do lead |
| `ScheduleMessageDialog.tsx` + `ScheduledMessagesPanel.tsx` | Agendamento de mensagens (`scheduled_messages`) |
| `MediaBubbles.tsx` | Renderização de mídia (imagem, áudio, vídeo, doc) |
| `ForwardDialog.tsx` | Encaminhar mensagem |
| `NewConversationDialog.tsx` | Iniciar conversa nova |
| `TaskDialog.tsx` | Criar/editar tarefa |

### Hooks
- `src/hooks/useAttendants.ts` — atendentes da clínica.
- `src/hooks/useQuickReplies.ts` — respostas rápidas.
- `src/hooks/useUnreadTitle.ts` — title do browser com contador.
- `src/hooks/useWaAvatar.ts` — avatar via `fetch-wa-avatar`.
- `src/hooks/useWhatsappInstances.ts` — instâncias Evolution.

### Libs
- `src/lib/phone.ts` — normalização E.164.
- `src/lib/media-url.ts` — resolução de URLs de mídia.
- `src/lib/scheduled-messages.ts` — CRUD de agendamentos.
- `src/lib/lead-tasks.ts` — CRUD de tarefas.
- `src/lib/internal-notes.ts` — notas internas.
- `src/lib/drafts.ts` — rascunhos locais.
- `src/lib/template-vars.ts` — variáveis em quick replies.
- `src/lib/quality-ladder.ts` — qualidade do número.
- `src/lib/delete-lead.ts` — exclusão de lead.

## 4. Edge functions

### Núcleo Evolution
| Function | Função |
|---|---|
| `evolution-webhook/index.ts` | **Recebe webhook** da Evolution. Persiste mensagem em `messages`, cria/atualiza lead, dispara `ai-auto-reply` se aplicável. |
| `evolution-send/index.ts` | Envia mensagem de texto. Chamada por composer humano e por `ai-auto-reply`. |
| `evolution-send-media/index.ts` | Envia mídia. |
| `evolution-provision/index.ts` | Cria instância nova. |
| `evolution-qr/index.ts` | Retorna QR para conectar. |
| `evolution-restart` / `evolution-logout` / `evolution-delete-instance` | Gestão de instância. |
| `evolution-health/index.ts` | Healthcheck. |
| `evolution-test/index.ts` | Teste manual. |
| `evolution-sync-lead` / `evolution-collect-leads` / `evolution-backfill-all` | Sincronização inicial. |
| `evolution-fetch-groups` | Lista grupos da instância. |
| `evolution-delete-lead` / `evolution-delete-message` | Exclusão. |

### Suporte
- `fetch-wa-avatar` — avatar do contato.
- `wa-redirect` — redirect link público.
- `transcribe-audio` — (TODO) transcrição inbound.
- `scheduled-dispatcher` — envia `scheduled_messages` no horário.
- `ai-auto-reply` — invocada pelo webhook (ver [AI_RUNTIME](./AI_RUNTIME.md)).
- `watch-stale-leads` — alerta de lead parado.

### Compartilhado
- `_shared/evolution.ts` — **wrapper Evolution API** (auth, base URL, endpoints). Toda chamada Evolution passa aqui.

## 5. Banco de dados

### Tabelas
| Tabela | Colunas-chave |
|---|---|
| `messages` | `id`, `lead_id`, `clinic_id`, `direction` ('in'/'out'), `body`, `media_url`, `media_type`, `external_id`, `bot_agent_id`, `attendant_id`, `created_at` |
| `leads` | `id`, `clinic_id`, `phone`, `name`, `stage_id`, `ai_paused`, `custom_fields` (jsonb), `tags[]`, `attendant_id` |
| `lead_internal_notes` | notas privadas |
| `lead_tasks` | tarefas |
| `scheduled_messages` | `lead_id`, `send_at`, `body`, `status` |
| `whatsapp_instances` | `id`, `clinic_id`, `evolution_instance`, `status`, `phone_number` |
| `quick_replies` | respostas rápidas |
| `attendants` | usuários atendentes |
| `pipeline_stages` | stages (entram aqui via `move_lead_stage` tool) |
| `stage_ai_defaults` | agente default por stage |
| `message_sequence_runs` | engagement de sequences |

### RLS
- Tudo escopado por `clinic_id = current_user_clinic()`.
- `messages`: usuários da clínica veem todas; criação por edge function via `service_role`.

### Triggers
- `trg_stop_sequences_on_reply` em `messages` — interrompe sequences quando lead responde.
- Atualização de `leads.last_message_at` em insert de `messages`.
- Trigger de `updated_at` padrão.

⚠️ **Não existe** `tg_pause_ai_on_human_reply`. Pausa de IA é manual (botão no Inbox) ou via tool `transfer_to_human`.

## 6. Integrações externas

- **Evolution API** (self-hosted) — base URL e API key em secrets:
  - `EVOLUTION_API_URL`
  - `EVOLUTION_API_KEY`
  - Webhook configurado em `evolution-provision`.
- Avatar: vem da própria Evolution.

## 7. Invariantes — "não toque sem ler"

1. **Toda chamada Evolution passa por `_shared/evolution.ts`.** Não fazer `fetch` direto.
2. **`messages.bot_agent_id`** preenchido em TODA mensagem `direction='out'` originada por IA. Usado pelo anti-loop bot↔bot em `ai-auto-reply`.
3. **`messages.attendant_id`** preenchido em mensagens `out` enviadas por humano via Composer.
4. **Pause de IA é manual.** Composer/Inbox seta `leads.ai_paused=true` quando atendente humano responde. Botão "retomar IA" reverte.
5. **Telefone sempre E.164.** `src/lib/phone.ts` normaliza. DB não armazena formato local.
6. **`external_id`** da Evolution é único — usar para idempotência no webhook (evitar duplicar mensagem).
7. **Mídia:** URLs assinadas curtas. `src/lib/media-url.ts` resolve. Não cachear URL.
8. **Sequences param em resposta** via trigger `trg_stop_sequences_on_reply`. Mudar isso quebra automações.
9. **`whatsapp_instances.status`** é fonte da verdade do estado da instância — UI lê daqui, não da Evolution direto (latência).
10. **Webhook idempotente.** Evolution pode reenviar mesmo evento — tratar `external_id`.

## 8. Pegadinhas

- Áudio inbound não é transcrito (ver TODO em `transcribe-audio`). Agente IA responde "ainda não escuto áudios".
- Markdown WhatsApp usa `*bold*`, não `**bold**`. Composer deve respeitar.
- 2 mensagens inbound em <1s → 2 webhooks → advisory lock em `ai-auto-reply` serializa.
- Limpar instância via `evolution-delete-instance` **não** apaga `messages` históricas — só desconecta. Exclusão de mensagens é manual via `evolution-delete-message`.
- Avatar via `fetch-wa-avatar` tem rate limit — cache em `useWaAvatar` é importante.
- `scheduled_messages.send_at` em UTC. Frontend converte para timezone da clínica.
- Composer guarda rascunho em `localStorage` via `src/lib/drafts.ts` — bug comum: rascunho de um lead aparece em outro se chave colidir.
- `evolution-webhook` precisa retornar 2xx rápido (Evolution faz retry agressivo) — trabalho pesado em jobs/edges separadas.

## 9. Receitas

### Adicionar novo tipo de mídia suportada
1. `evolution-webhook/index.ts` — branch novo em parsing.
2. `_shared/evolution.ts` — endpoint correspondente em `evolution-send-media` se for envio.
3. UI: `MediaBubbles.tsx` (renderização) + `Composer.tsx` (upload).
4. Storage: bucket apropriado em Supabase Storage.

### Adicionar campo ao painel lateral do Inbox
1. UI: `ContextRail.tsx` ou subcomponente.
2. Hook de dados em `src/hooks/use*.ts`.
3. Se persiste, garantir RLS por `clinic_id`.

### Trocar provider de WhatsApp (de Evolution para outro)
1. Criar `_shared/<provider>.ts` análogo a `_shared/evolution.ts`.
2. Substituir chamadas em `evolution-*` edges (ou criar paralelo `<provider>-*`).
3. Webhook: novo endpoint público + provisionamento.
4. **Cuidado:** muitos pontos hardcoded — fazer refactor para abstração antes.

### Adicionar quick reply com variáveis
1. UI: gerenciamento em `src/hooks/useQuickReplies.ts` + painel em Settings.
2. Variáveis: `src/lib/template-vars.ts` (lista de tokens disponíveis).
3. Render em `Composer.tsx`.

### Debug "mensagem inbound não aparece"
1. Logs do `evolution-webhook` — chegou?
2. `messages` table — foi inserida?
3. `leads.clinic_id` bate com a instância em `whatsapp_instances`?
4. RLS — usuário do Inbox pertence à clínica?
5. Realtime ligado? (`useCrm` hook subscreve a inserts de `messages`).

### Debug "IA não responde inbound"
Ver [AI_RUNTIME §9 — Debug "agente não responde"](./AI_RUNTIME.md#9-receitas).
