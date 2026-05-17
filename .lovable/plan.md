# Disparo em Massa WhatsApp (nativo)

Painel em **IA → Disparo em massa** que envia direto pela Evolution API (mesma usada no atendimento), sem depender de n8n. Multi-clínica, com RLS, feature flag `broadcasts`.

## 1. Conceito de envio

- Cada **broadcast** tem uma **fila de destinatários** (lead do pipeline ou contato avulso importado).
- Mensagens são organizadas em **grupos** (mínimo 1, padrão 3, sem limite máximo). Cada grupo tem N **partes** (mensagens curtas).
- **Rotação round-robin entre grupos**: contato 1 → grupo 1 (todas as partes em sequência), contato 2 → grupo 2, contato 3 → grupo 3, contato 4 → grupo 1…
- **Throttle por destinatário**: intervalo mínimo de **15 min** entre destinatários consecutivos da mesma instância (configurável, default 20 min).
- **Janela horária / dias da semana**: envia só dentro da janela; fora dela, pausa e reagenda para a próxima abertura.
- **Instância dedicada recomendada** (para reduzir risco de banimento) — seletor mostra todas as instâncias da clínica e marca a default do pipeline.

## 2. Estrutura de dados

```text
broadcasts
  id, clinic_id, name, status (draft|running|paused|done|failed)
  whatsapp_instance_id, throttle_seconds (>=900)
  send_window jsonb { start:"08:00", end:"18:00", tz, weekdays:[1..5] }
  source jsonb { pipeline_id?, stage_ids?[], include_imported:bool }
  totals jsonb { queued, sent, failed, replied, read }
  created_by, created_at, updated_at

broadcast_message_groups
  id, broadcast_id, position (1..N), name

broadcast_message_parts
  id, group_id, position, content (text), media_url?, media_kind?

broadcast_recipients
  id, broadcast_id, clinic_id
  lead_id?, phone, name, custom jsonb
  group_assigned (int)   -- definido no "congelar audiência" via round-robin
  status (pending|sending|sent|failed|skipped|replied)
  parts_sent int default 0
  next_send_at timestamptz
  last_error text
  unique (broadcast_id, phone)

broadcast_events
  id, broadcast_id, recipient_id?, type (queued|sent|delivered|read|replied|failed|paused|resumed)
  payload jsonb, created_at
```

RLS por `clinic_id` (membros da clínica leem/escrevem; super_admin tudo). Feature flag `broadcasts` em `lib/features.ts`.

## 3. Edge functions

- **`broadcast-tick`** (cron 1 min): para cada broadcast `running`, verifica janela horária; pega o próximo recipient com `next_send_at <= now()`; envia a próxima parte do grupo atribuído via `evolution-send` (reaproveita helper existente); incrementa `parts_sent`; quando todas as partes do grupo do recipient foram enviadas, marca `sent`, agenda o próximo recipient para `now() + throttle_seconds` (com jitter ±10%) respeitando a janela.
- **`broadcast-control`**: `start`, `pause`, `resume`, `cancel`, `freeze_audience` (materializa lista de recipients a partir de pipeline/stages/import e faz o round-robin de grupos), `add_contacts` (CSV/XLSX já parseado no client → array de `{phone,name,custom}`).
- **Tracking de respostas/leitura**: já vem do webhook da Evolution (`messages.upsert`/`status`) — adicionar handler que, ao receber mensagem `fromMe=false` de um número que tem recipient `sent`, marca `replied` e cria evento.

## 4. UI — `src/pages/Broadcasts.tsx` (rota `/ai/broadcasts`)

**Lista de broadcasts** com status, progresso, criado em.

**Editor** (abas):

1. **Configuração** — nome, instância WhatsApp, throttle (slider min 15 min, default 20), janela (start/end + checkboxes Seg-Dom), modo execução (imediato / agendado).
2. **Mensagens** — botão "Adicionar grupo" (default já cria 3: A/B/C). Em cada grupo, lista de partes (Textarea) com botão "Adicionar parte". Preview do round-robin: "Contato 1 → Grupo A | Contato 2 → Grupo B | Contato 3 → Grupo C | Contato 4 → Grupo A…".
3. **Audiência** — duas fontes combináveis:
   - **Do pipeline**: seletor de pipeline + checkboxes de stages (preview com contagem).
   - **Importar contatos**: botão "Baixar template Excel" (gera .xlsx com colunas `telefone`, `nome`, `custom1`, `custom2`) e drop zone que aceita .xlsx/.csv (parse com `xlsx` no client, valida telefone com regex BR). Lista paginada com remover.
   - Botão **"Congelar audiência"** (chama `broadcast-control freeze_audience`) — após congelar, novos leads na coluna não entram automaticamente.
4. **Dashboard / Execução** — botões **Play / Pause / Cancelar**; cards em tempo real (queued, enviados, falhas, respostas, taxa de leitura); gráfico de envios por hora; tabela de recipients com filtro por status, com ação "Reenviar" para falhas. Polling a cada 5s + realtime em `broadcast_events`.
5. **Relatórios** — taxa de entrega/leitura/resposta por grupo (compara performance A/B/C), melhor horário, falhas por motivo, export CSV.

## 5. Detalhes técnicos

- Parse Excel: `xlsx` (já comum) no client; template gerado on-the-fly.
- Normalização de telefone: helper `lib/phone.ts` (E.164 BR, remove máscara, valida 10-13 dígitos).
- Atribuição de grupo: na hora do `freeze_audience`, `group_assigned = ((row_number-1) % total_groups) + 1`, embaralhando a ordem dos recipients para distribuir leads "frescos" entre grupos.
- Janela horária: cron tick converte `now()` para `tz` da janela; se fora, atualiza `next_send_at` para próxima abertura.
- Throttle: aplicado **por instância** (não por broadcast), para se duas campanhas usarem a mesma instância não estourarem o limite — query considera última mensagem enviada pela instância em `messages`.
- Dedup: `unique(broadcast_id, phone)` impede importar o mesmo número 2x; opção "também ignorar números já enviados em outros broadcasts dos últimos X dias".
- Sem auto-restart: se Evolution retornar erro de instância, pausa o broadcast e registra evento.

## 6. Arquivos

Criar:
- `supabase/migrations/<ts>_broadcasts.sql` (tabelas, RLS, índices, feature flag)
- `supabase/functions/broadcast-tick/index.ts`
- `supabase/functions/broadcast-control/index.ts`
- `src/pages/Broadcasts.tsx`
- `src/components/broadcasts/{ConfigTab,MessagesTab,AudienceTab,DashboardTab,ReportsTab,ContactsImport,GroupEditor}.tsx`
- `src/lib/phone.ts`, `src/lib/broadcast-template.ts` (gerar .xlsx)

Editar:
- `src/App.tsx` (rotas `/ai/broadcasts` e `/ai/broadcasts/:id` com `FeatureRoute feature="broadcasts"`)
- `src/pages/ai/AiHub.tsx` (card "Disparo em massa")
- `src/lib/features.ts` (adicionar `broadcasts`)
- `supabase/functions/evolution-webhook/index.ts` (marcar `replied` quando recipient responde)
- `supabase/config.toml` (verify_jwt=false em `broadcast-tick` se necessário para cron)

Cron via `pg_cron` chamando `broadcast-tick` a cada minuto.

## Fora do escopo
- IA gerando textos (usuário escreve as partes manualmente; pode-se adicionar depois)
- A/B test estatístico automático (só relatório comparativo)
- Envio de mídia rica (1ª versão = texto; mídia entra em V2 reaproveitando `evolution-send-media`)
