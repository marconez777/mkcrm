---
title: Broadcasts (Disparos em massa via WhatsApp)
topic: automations
kind: feature
audience: agent
updated: 2026-06-07
summary: "O módulo de **Broadcasts** permite a uma clínica disparar uma sequência de mensagens (texto, hoje) para uma audiência **congelada** (snapshot fixo), através de uma **instância Evolution** dedicada, respeitando:"
---
# Broadcasts (Disparos em massa via WhatsApp)

> Domínio: envio controlado de campanhas WhatsApp para listas grandes de
> contatos, respeitando janela horária, throttle por contato e múltiplas
> partes/grupos de mensagem.
>
> Última atualização: 2026‑05‑25

---

## 1. Visão geral

O módulo de **Broadcasts** permite a uma clínica disparar uma sequência de
mensagens (texto, hoje) para uma audiência **congelada** (snapshot fixo),
através de uma **instância Evolution** dedicada, respeitando:

- **Janela de envio** (horário/dia da semana/timezone) por broadcast.
- **Throttle** (segundos entre contatos) com jitter ±10%.
- **Grupos de mensagens** (variações A/B sequenciais por posição) com
  **partes** (multiple-message drip dentro do mesmo grupo, intervalo fixo
  de 1 segundo).
- **Idempotência por destinatário** via *claim* otimista no `broadcast_recipients`.
- **Eventos** (`broadcast_events`) para auditoria completa.

Frontend principal: `src/pages/Broadcasts.tsx`.
Backend principal:
- `supabase/functions/broadcast-control/index.ts` — actions (start, pause,
  resume, cancel, delete, freeze_audience, retry_failed, test_send_first).
- `supabase/functions/broadcast-tick/index.ts` — worker disparado por
  cron + auto‑trigger.

---

## 2. Modelo de dados

Tabelas (ver `docs/database/SCHEMA.md` para campos completos):

| Tabela                          | Papel                                                                 |
|---------------------------------|-----------------------------------------------------------------------|
| `broadcasts`                    | Cabeçalho da campanha (status, janela, throttle, instância, totals).  |
| `broadcast_message_groups`      | Grupos (variações) com `position`.                                    |
| `broadcast_message_parts`       | Partes de um grupo, ordenadas por `position` (drip).                  |
| `broadcast_recipients`          | Audiência congelada: phone, name, group_position, status, parts_sent, next_send_at, last_error. |
| `broadcast_events`              | Log de eventos (start, paused, sent, failed, done, test_sent).        |

### Status (`broadcasts.status`)

`draft → running → (paused ↔ running) → done | cancelled | failed`.

### Status (`broadcast_recipients.status`)

`pending → sending → sent | failed`.
`sending` = teve partes parciais enviadas; `sent` = todas as partes enviadas.

---

## 3. Fluxo de criação

### 3.1 Aba **Configuração**
1. Definir `name`, `whatsapp_instance_id`, `throttle_seconds`, `send_window`
   (`{ start, end, tz, weekdays[] }`).
2. Sem `whatsapp_instance_id` ou audiência não congelada → `start` retorna
   `400 no_whatsapp_instance` / `400 audience_not_frozen`.

### 3.2 Aba **Mensagens**
- Criar 1+ `broadcast_message_groups` (variações). Cada destinatário recebe
  o grupo cuja `position == recipient.group_position` (default 1).
- Cada grupo possui `broadcast_message_parts` ordenadas; o `tick` envia
  uma parte por execução (intervalo de 1s entre partes do mesmo contato).
- Suporte a `{{nome}}` (case‑insensitive) interpolado de `recipient.name`.

### 3.3 Aba **Audiência**
- `freeze_audience` chama RPC `broadcast_freeze_audience(_broadcast_id, _pipeline_id, _stage_ids, _extra_contacts)`.
  - Erros mapeados: `forbidden`, `no_message_groups`.
- A RPC tira um snapshot dos leads filtrados e popula `broadcast_recipients`
  com `status=pending`, `parts_sent=0`, `group_position` (distribuído quando
  há múltiplos grupos).
- Adição posterior: `action=add_contacts` (CSV via `src/lib/broadcast-template.ts`
  — `downloadBroadcastTemplate` / `parseContactsFile`).

### 3.4 **Teste de envio**
`action=test_send_first` envia todas as partes do **primeiro** recipient
pendente sem alterar status, retornando `results[]` e registrando
`broadcast_events.type='test_sent'`. Não consome destinatário.

### 3.5 **Start**
- Reseta `next_send_at = now()` para todos pending/sending.
- Atualiza `status='running'`.
- Dispara `broadcast-tick` imediatamente (fire‑and‑forget) para não esperar
  o cron.

---

## 4. Worker (`broadcast-tick`)

Cron: invocado pelo `pg_cron` a cada minuto + auto‑re‑disparado pelo próprio
worker após cada envio bem‑sucedido (para encadear partes/contatos sem
esperar o próximo tick).

### 4.1 Loop principal
Para cada broadcast `status='running'`:

1. **Janela**: `withinWindow(send_window)` calcula horário local no `tz` e
   verifica `weekdays`/`start`/`end`. Fora da janela → empurra `next_send_at`
   de todos os `pending` para `nextOpenIso`.
2. **Seleção**: pega **1 recipient** com `status in ('pending','sending')` e
   `next_send_at <= now()`, ordenado por `next_send_at`. (1 por tick para
   respeitar throttle entre contatos.)
3. **Encerramento**: se não há mais recipients elegíveis → marca
   `broadcasts.status='done'`, registra evento `done`.
4. **Instância**: `loadInstance(whatsapp_instance_id)`. Sem instância →
   pausa o broadcast com `payload.reason='no_instance'`.
5. **Grupos/partes**: carrega uma vez por broadcast.

### 4.2 Claim atômico (idempotência)
Antes de enviar, faz `UPDATE broadcast_recipients SET next_send_at = now()+60s
WHERE id=? AND parts_sent=? AND next_send_at<=now() RETURNING id`. Se 0 linhas,
outro worker (cron + auto‑trigger concorrentes) já pegou — pula. Isso evita
envio duplicado mesmo com múltiplos ticks paralelos.

### 4.3 Envio
`POST /message/sendText/{instance}` via `evoFetch` (helper de `_shared/evolution.ts`).

Heurística importante: a Evolution pode responder **200 OK sem `messageId`**
quando o número **não existe no WhatsApp**. O worker exige
`resp.key.id || resp.messageId || resp.message.id`, caso contrário marca
`failed` com erro descritivo.

### 4.4 Throttle entre contatos
- Partes do mesmo grupo: intervalo fixo **1s**.
- Quando a **primeira parte** ou a **última parte** é enviada, todos os
  outros `pending` do mesmo broadcast têm `next_send_at` empurrado para
  `now() + throttle_seconds * (1 ± 10% jitter)`. Isso garante que nenhum
  outro contato é intercalado enquanto este está recebendo o drip completo.

### 4.5 Falhas e totals
- `failed` por contato é definitivo (não retenta por padrão; usuário usa
  `action=retry_failed` para reabrir).
- Após cada `sent` completo: atualiza `broadcasts.totals.sent` com COUNT
  exato e re‑dispara o tick.

---

## 5. Frontend (`src/pages/Broadcasts.tsx`)

- Listagem, criação, edição em abas (Configuração / Mensagens / Audiência / Eventos).
- Botões: **Testar primeiro envio**, **Iniciar**, **Pausar**, **Retomar**,
  **Cancelar**, **Excluir**, **Retentar falhas**.
- Upload de CSV/XLSX usando `src/lib/broadcast-template.ts` (normaliza
  telefone via `src/lib/phone.ts::normalizePhoneBR`).
- Realtime: assina mudanças em `broadcast_recipients` e `broadcast_events`
  para atualizar progresso ao vivo.

---

## 6. Erros comuns / troubleshooting

| Sintoma                                                | Causa provável / fix                                                            |
|--------------------------------------------------------|---------------------------------------------------------------------------------|
| `Start` retorna `no_whatsapp_instance`                 | Selecionar instância na aba Configuração antes.                                 |
| `Start` retorna `audience_not_frozen`                  | Congelar audiência (mesmo que vazia) antes de iniciar.                          |
| `freeze_audience` falha com `no_message_groups`        | Criar pelo menos 1 grupo de mensagens.                                          |
| Recipients todos `failed` com "Evolution 200 sem messageId" | Números fora do WhatsApp — normal para listas frias. Limpar a lista.       |
| Broadcast travado em `running` sem progresso           | Verificar cron (`pg_cron.job` para `broadcast-tick`), checar logs da função, validar `send_window` no timezone correto. |
| Duplicação de mensagens                                | Não deveria ocorrer por causa do *claim*. Se ocorrer, conferir se `parts_sent` está sendo escrito atomicamente. |
| Throttle não respeitado                                | `throttle_seconds` muito baixo + jitter pode aproximar. Aumentar para ≥30s.    |

---

## 7. Limitações conhecidas / melhorias futuras

- **Sem mídia em broadcast**: apenas `sendText`. Para incluir mídia, integrar
  `evolution-send-media` no worker (requer storage de mídia por parte).
- **Sem A/B real**: a distribuição por `group_position` é determinística no
  `freeze`, não há split aleatório com métricas comparativas.
- **Sem opt‑out**: respeitar `leads.opt_out_marketing` no freeze (hoje
  depende da RPC; verificar `broadcast_freeze_audience`).
- **Throttle global por instância**: hoje throttle é por broadcast. Dois
  broadcasts simultâneos na mesma instância podem somar pressão. Idealmente,
  um `lock` por `whatsapp_instance_id`.
- **Retentativas automáticas**: falhas transitórias (`HTTP 502` na Evolution)
  poderiam ter backoff exponencial antes de marcar `failed`.
- **Métricas**: hoje só `totals.sent`. Adicionar `delivered`, `read`,
  `replied` via webhook da Evolution + correlação por `key.id`.

---

## 8. Links

- Schema: [`docs/database/SCHEMA.md`](../database/SCHEMA.md) (domínio Broadcasts).
- Edge functions WhatsApp: [`docs/edge-functions/WHATSAPP.md`](../edge-functions/WHATSAPP.md).
- Shared helpers (`evoFetch`, `loadInstance`): [`docs/edge-functions/SHARED_HELPERS.md`](../edge-functions/SHARED_HELPERS.md).
