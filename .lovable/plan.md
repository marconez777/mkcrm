## Objetivo

Recuperar as mensagens que chegaram no WhatsApp enquanto a conexão estava "muda" (06/05 → reconexão de hoje) e que não entraram no banco, e deixar o sistema preparado para fazer essa recuperação automaticamente toda vez que a conexão voltar.

## Por que as mensagens "sumiram"

Quando a Evolution/Baileys reconecta após ficar offline, o WhatsApp envia o histórico recente via **`messages.history.set`** (sync de histórico do Baileys). Hoje nosso webhook **não escuta esse evento** — só escuta `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONTACTS_UPSERT` e `CONNECTION_UPDATE`. Resultado: o histórico chega na Evolution mas é descartado pelo nosso backend.

Além disso, o `findMessages` da Evolution só retorna o que já está no banco dela — se a Evolution também não recebeu na hora, depende do `MESSAGE_HISTORY` do Baileys para popular.

## Plano

### 1. Recuperação imediata (mensagens dos últimos 4 dias)

Rodar um **backfill agressivo** logo após a reconexão:

- Chamar `evolution-backfill-all` com `force: true` para os leads ativos (ou os 200-500 com `last_message_at` mais recente), ignorando o anchor de timestamp local.
- Isso re-pagina `findMessages` na Evolution para cada lead. Se a Evolution recebeu o history sync na reconexão, as mensagens "perdidas" entram agora.
- Subir uma tela/botão **"Recuperar mensagens perdidas"** em Settings, mostrando progresso (NDJSON já existe).

### 2. Adicionar suporte a eventos de histórico no webhook

Atualizar `evolution-webhook` para também processar:

- **`MESSAGING_HISTORY_SET`** (ou `messages.history.set`) — o evento do Baileys que entrega o backlog após reconexão.
- **`CHATS_SET` / `CHATS_UPSERT`** — para descobrir chats que tiveram atividade.

Cada item recebido nesses eventos passa pelo mesmo `ingestMessage` (já é idempotente por `(lead_id, external_id)`), então não duplica.

E registrar esses eventos na chamada `webhook/set` da Evolution (`docs/EVOLUTION.md` + função que salva o webhook).

### 3. Habilitar sincronização completa de histórico na Evolution

Na criação/configuração da instância, garantir as flags da Evolution que controlam quanto histórico ela puxa do WhatsApp:

- `SYNC_FULL_HISTORY=true` (variável da Evolution) — faz o Baileys pedir histórico completo no pareamento/reconexão.
- Confirmar que `events_message` inclui `MESSAGES_SET` / `MESSAGING_HISTORY_SET` no webhook.

Isso é configuração no servidor Evolution; documentar em `docs/EVOLUTION.md` e checar no `evolution-provision`.

### 4. Auto-backfill após reconexão

No handler de `CONNECTION_UPDATE`, quando o estado mudar de `close`/`connecting` → `open`:

- Marcar `whatsapp_instances.last_reconnect_at`.
- Disparar automaticamente `evolution-backfill-all` para essa instância (assíncrono, `force: true`, limitado aos leads com `last_message_at` nos últimos 30 dias).
- Logar resultado em `webhook_events` para auditoria.

Assim, da próxima vez que cair e voltar, o resgate é automático — sem intervenção manual.

### 5. Observabilidade

Em Settings, adicionar:

- "Última reconexão": timestamp.
- "Mensagens recuperadas na última reconexão": contador.
- Botão manual **"Recuperar mensagens perdidas agora"** chamando o backfill com `force: true`.

## Detalhes técnicos

```text
Fluxo desejado após reconexão:

WhatsApp → Evolution (reconecta)
            │
            ├── envia MESSAGING_HISTORY_SET ──► webhook ──► ingestMessage (idempotente)
            │
            └── popula DB interno da Evolution
                            │
CONNECTION_UPDATE=open ──► trigger auto-backfill
                            │
                            └── findMessages por lead (force) ──► ingestMessage
```

Arquivos que serão tocados na fase de build:
- `supabase/functions/evolution-webhook/index.ts` — novos event types
- `supabase/functions/_shared/evolution.ts` — registrar eventos extras no webhook/set
- `supabase/functions/evolution-backfill-all/index.ts` — já suporta `force`, só consumir
- `supabase/functions/evolution-provision/index.ts` — flag `SYNC_FULL_HISTORY` se aplicável
- `src/pages/Settings.tsx` — botão "Recuperar mensagens perdidas" + status
- `docs/EVOLUTION.md` — documentar eventos e flags

## Resultado esperado

- Mensagens dos últimos dias que ficaram presas na Evolution voltam para a inbox agora (passo 1).
- Toda futura reconexão dispara recuperação automática (passos 2–4).
- Você tem visibilidade e um botão manual de fallback (passo 5).

## Ressalva honesta

Mensagens que **a própria Evolution também não recebeu** (por exemplo, se o servidor Evolution ficou offline junto, ou se o WhatsApp não entregou history sync para aquela sessão) **não há como resgatar** — o WhatsApp não expõe API de "mensagens passadas" fora do history sync do dispositivo. O plano cobre o caso mais comum: Evolution recebeu, mas nosso backend descartou.
