## Auditoria — pipeline, kanban e robô de mensagens

Revisei o fluxo de ingestão (Evolution → webhook → leads/messages), o robô de auto-resposta (debounce + dispatcher), automações e a UI do Kanban. Abaixo os problemas reais encontrados e as correções propostas.

### 1. Bugs de ingestão (`_shared/evolution.ts` + `evolution-webhook`)

- **Sem deduplicação de webhook.** Existe `webhook_dedup` na base e `cleanup_webhook_dedup` agendado, mas o webhook nunca insere hash de evento. Em rajadas/retry da Evolution, a mesma mensagem é processada várias vezes (gera UPDATEs redundantes e dispara `ai-auto-reply` repetido).
  - Fix: calcular hash `event+key.id+timestamp` e tentar `INSERT … ON CONFLICT DO NOTHING` em `webhook_dedup`; se já existir, retornar `{ok:true, deduped:true}` cedo.
- **`MESSAGES_UPSERT` em mensagens já existentes nunca chama `downloadAndStoreMedia`.** A flag `needs_media` só dispara quando `isNew=true`. Se o primeiro upsert chegar antes do payload conter mídia decifrável (ex.: ack rápido), a mídia nunca é baixada.
  - Fix: também baixar quando `existing && !existing.media_url && isMediaType(type)` (retornar `message_id` do `existing` em `ingestMessage`).
- **Race entre `unread_count` em lead novo vs. update.** Quando `createdLead=true`, já gravamos `unread_count`/`last_message_at` no INSERT, mas se o webhook re-entregar o mesmo evento, o segundo passe cai no ramo "existing" e chama `increment_unread` — duplica o badge. Resolvido pela dedupe acima.
- **`MESSAGES_UPDATE` não promove mensagens enviadas pelo app.** Não atualiza `external_id` quando vier `keyId`/`update.message.key.id` para um row local com `client_message_id`. Hoje a única ponte é o retorno de `evolution-send`. Se o POST falhar mas o WhatsApp aceitar (timeout), perdemos o vínculo.
  - Fix: ao receber UPDATE com `keyId` e sem registro por `external_id`, buscar última mensagem `from_me` recente do lead com status `pending` e linkar `external_id`.
- **`ingestMessage` busca lead só por `phone`** (sem filtrar por `whatsapp_instance_id`). Se duas instâncias receberem o mesmo número, o lead é compartilhado; o primeiro instance "ganha" o `whatsapp_instance_id` e mensagens da segunda instância vão para esse mesmo lead silenciosamente. Aceitável se for intencional, mas vale documentar/decidir. Sugestão: manter como está, mas registrar evento `lead_events` quando uma instância diferente postar.

### 2. Robô de auto-reply (`ai-auto-reply` + `scheduled-dispatcher`)

- **Disparo redundante do dispatcher.** `ai-auto-reply` agenda `setTimeout(debounce+1s)` e ainda há cron de 1 min. Em bursts, dezenas de chamadas concorrentes batem no dispatcher. O claim `DELETE…RETURNING` protege contra processamento duplo, mas gera carga.
  - Fix: substituir o `setTimeout` por uma chamada única "no flush" controlada por `pending_replies.run_at`; ou melhor, deixar só o cron (1 min é suficiente p/ debounce ≥ 8s já garantido pela tabela). Se quiser latência menor, manter o waitUntil mas limitar a 1 disparo por lead via marcador em memória / `webhook_dedup`.
- **Sem trava de "pausa por humano".** Quando um atendente envia manualmente, `ai-auto-reply` ainda enfileira porque só verifica `paused_until`. Se o último envio foi `from_me=true` por um humano, deveríamos pular.
  - Fix: no início do dispatcher (`processPendingReplies`), checar se a última mensagem `from_me` foi enviada por usuário humano nos últimos N min e pular.
- **`get_lead_history` usa `desc` + `reverse()`** — ok, mas filtra `m.content` antes do reverse, perdendo a ordem original quando há mídia sem caption (mensagem sem `content` é dropada). Considerar manter placeholder `[mídia]` para preservar contexto de ordem.
- **`ai-auto-reply` em mensagens enviadas pelo próprio robô.** O webhook checa `!it?.key?.fromMe`, ok. Mas mensagens enviadas via `evolution-send` (humano) também voltam como webhook `MESSAGES_UPSERT` com `fromMe=true` → não dispara, ok. Apenas confirmar no log que não há regressão.

### 3. Kanban / cards / pipeline (UI)

- **`useLeads` carrega só 2000 leads** e filtra por pipeline no cliente. Funis grandes ficam capados sem aviso. Sugestão: log/aviso quando `data.length === 2000`, e migrar para fetch por `pipeline_id` quando `currentId` muda.
- **Drag and drop não atualiza `position`.** `onEnd` só muda `stage_id`; ao soltar entre cards, a ordem visual depende do sort por `last_message_at`. Mover para o topo de outra coluna não persiste posição. Correção opcional: gravar `position` baseado no índice no SortableContext alvo.
- **Auto-scroll horizontal durante drag** (`autoScroll.threshold.x: 0.2`) conflita com o pan custom de `useHorizontalScroll`. Em telas pequenas, pode "fugir" o card. Reduzir threshold para 0.1 ou desativar quando o usuário não estiver arrastando.
- **Toast de "desfazer" ao mover etapa** chama UPDATE direto sem reverter `position`. Ok porque não mexemos em position.
- **`addLead` não define `position`** (default 0) — todo novo lead empilha na mesma posição. Calcular `max(position)+1` da etapa.
- **`PipelineSwitcher` e `PipelineSidebar` mostram contadores baseados em `allLeads` (truncado a 2000)** — mesma limitação acima.

### 4. Infra/cron

- **`evolution-health` está agendado duas vezes** (`evolution-health-every-minute` e `evolution-health-watchdog`), executando em paralelo a cada minuto. Remover um dos dois.
- **Cron usa `apikey` anon** para chamar `automations-tick` e `scheduled-dispatcher`; funciona porque `verify_jwt=false`. Tudo bem, só observar.

### 5. Observabilidade

- `webhook_events.error` é gravado, mas hoje não há tela. Já existe `Metrics`/`MetricsOps` — adicionar painel "Webhook saúde (24h)" com erros recentes.
- Logs do edge mostram `MESSAGES_UPSERT` com 1.7-2.1s de latência — quase todo gasto no `ingestMessage`. Vale paralelizar `for (const it of items)` com `Promise.all` (cada item é independente).

---

## Plano de implementação

```text
Backend
├─ _shared/evolution.ts
│   ├─ ingestMessage: retornar message_id também para 'existing'
│   ├─ ingestMessage: needs_media verdadeiro quando existing.media_url == null
│   └─ helper insertWebhookDedup(hash) → boolean (true se primeiro)
├─ evolution-webhook/index.ts
│   ├─ dedupe na entrada (hash do evento + key.id)
│   ├─ Promise.all nos items de MESSAGES_UPSERT
│   ├─ MESSAGES_UPDATE: tentar linkar external_id em msg pendente
│   └─ baixar mídia também para mensagens já existentes sem media_url
├─ ai-auto-reply: remover setTimeout/dispatcher trigger duplicado
└─ scheduled-dispatcher: pular reply se último from_me foi humano (<5min)

Frontend
├─ Kanban.tsx
│   ├─ addLead: calcular position = max(position)+1 da primeira etapa
│   ├─ onEnd: ao mover entre etapas, gravar position alvo
│   └─ DndContext autoScroll threshold x: 0.1
└─ useCrm.ts
    └─ aviso quando leads.length === 2000

Infra (migration)
└─ DROP cron job 'evolution-health-watchdog' (manter only 'every-minute')
```

Após aprovação, aplico todas as alterações em uma única passagem e deploy automático das edge functions afetadas.