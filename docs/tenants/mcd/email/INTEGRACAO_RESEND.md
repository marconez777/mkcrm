---
title: "E-mail do MCD — Integração Resend (D2)"
topic: email
kind: map
audience: both
updated: 2026-08-21
summary: "A conta Resend própria do MCD: como a chave é resolvida (e o fallback silencioso para a conta principal), como o webhook valida a assinatura contra vários secrets, o que cada evento grava, como o domínio é verificado e por que o status do banco fica defasado, e os procedimentos de rotação. Tier da conta ainda não confirmado."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
code_refs:
  - supabase/functions/send-email/index.ts
  - supabase/functions/send-email-batch/index.ts
  - supabase/functions/resend-webhook/index.ts
  - supabase/functions/email-domain-manage/index.ts
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/FLUXO_DE_ENVIO.md
  - docs/maps/EMAIL_MARKETING.md
---

# E-mail do MCD — Integração Resend

## 1. Quem fala com quem

```
                 ┌──────────────────────────────┐
  envio          │ send-email / send-email-batch │
  ───────────►   │  lê clinic_email_integrations │──► env var <secret_name> ──► API Resend (conta MCD)
                 │  (cache 60 s por clínica)     │                                   │
                 └──────────────────────────────┘                                   │ eventos
                                                                                    ▼
                 ┌──────────────────────────────┐                      painel Resend (conta MCD)
  retorno        │ resend-webhook               │◄── POST assinado ◄──  endpoint cadastrado lá
  ◄───────────   │  testa RESEND_WEBHOOK_SECRET* │
                 │  grava em email_logs          │
                 └──────────────────────────────┘
```

Três coisas do MCD vivem **fora** do repositório e do banco: a chave da API
(variável de ambiente), o secret do webhook (variável de ambiente) e o cadastro
do endpoint (painel Resend). Se qualquer uma sumir, o sintoma é diferente e
nenhuma grava erro visível — ver §6.

## 2. A chave da API

**Onde está:** `clinic_email_integrations` tem uma linha por clínica com
conta própria. Hoje: `mkart`, `or`, `mcd`. Colunas que importam:

| Coluna | MCD |
|---|---|
| `provider` | `resend` |
| `secret_name` | o **nome** da variável de ambiente que guarda a chave (não a chave) |
| `enabled` | `true` |

**Como é resolvida** (`send-email/index.ts:190-212`; igual em
`send-email-batch/index.ts:69-78`):

1. Começa com a chave principal, `RESEND_API_KEY`.
2. Busca a linha da clínica (cache em memória de 60 s por `clinic_id`).
3. Se existe e `enabled`, lê `Deno.env.get(secret_name)`.
4. Se a variável **existe**, usa ela. Se **não existe**, faz `console.warn` e
   **continua com a chave principal**.

Esse passo 4 é o ponto de atenção do documento: **um secret apagado ou
renomeado não para o envio — redireciona o MCD para a conta principal**. O
domínio `marketingcomdigital.com.br` não está verificado lá, então o Resend
recusaria o `from`… a menos que a campanha use rotação de domínio para um
domínio que exista na conta principal. Em qualquer caso, a conta errada é
cobrada e a reputação errada é afetada.

**Como detectar:** o `send-email` só registra o `warn` no log da edge
function. Não há alerta. A checagem manual é comparar os IDs que o Resend
devolve com o painel da conta do MCD — se os envios não aparecem lá, saíram
pela outra conta.

**Só o MCD usa isso?** Não — `mkart` e `or` também têm linha. Mas o MCD é o
único com volume em que a troca silenciosa de conta teria consequência.

## 3. O webhook

### 3.1 Validação da assinatura

`resend-webhook/index.ts:18-52`. Cada conta Resend assina com seu próprio
secret (Svix). A função:

1. Lista **todas** as variáveis de ambiente cujo nome começa com
   `RESEND_WEBHOOK_SECRET`, ordenadas da mais curta para a mais longa (a
   principal vem primeiro porque concentra o tráfego).
2. Tenta verificar a assinatura com cada uma, na ordem.
3. A primeira que bate é a válida. Se **nenhuma** bate: `401 invalid
   signature` — e **nada é gravado**. O evento simplesmente desaparece.

O secret do MCD é `RESEND_WEBHOOK_SECRET_MCD`. Foi cadastrado depois das
primeiras campanhas; por isso elas não têm eventos (ver
[`INCIDENTES.md`](./INCIDENTES.md), entrada de 20/08).

### 3.2 Cadastro no painel

O endpoint precisa estar cadastrado **na conta do MCD**, apontando para a
mesma URL da função `resend-webhook`. Eventos assinados e confirmados
chegando em 21/08 (`resend_webhook_events`, últimos 7 dias):

| Evento | 7 dias | Total |
|---|---|---|
| `email.sent` | 1.238 | 16.605 |
| `email.delivered` | 1.167 | 14.981 |
| `email.delivery_delayed` | **4.282** | 7.576 |
| `email.bounced` | 889 | 2.691 |
| `email.opened` | 928 | 1.067 |
| `email.clicked` | 54 | 115 |
| `email.complained` | 1 | 3 |
| `email.received` | 50 | 240 |
| `email.suppressed` | 14 | 86 |

### 3.3 O que cada evento faz (`resend-webhook/index.ts:60-127`)

Antes de tudo: o `svix-id` do evento é inserido em `resend_webhook_events`;
se já existia, responde `deduped` e para. Depois localiza o `email_logs` pelo
`resend_id` (`data.email_id`); se não acha, responde `ignored: log not found`
— isso acontece com e-mails enviados por fora do CRM na mesma conta.

| Evento | Grava em `email_logs` | Efeito colateral |
|---|---|---|
| `email.delivered` | `status='delivered'`, `delivered_at` | — |
| `email.opened` | `status='opened'`, `opened_at` | — |
| `email.clicked` | `status='clicked'`, `clicked_at` | atribui origem "email" ao lead (só se `related_lead_table='leads'` — no MCD nunca, a lista não é lead) |
| `email.bounced` | `status='bounced'`, `bounced_at` | trigger `trg_email_logs_suppress_on_bounce` insere em `email_unsubscribes` e remove de `email_segment_contacts` |
| `email.complained` | `status='complained'`, `complained_at` | upsert em `email_unsubscribes` com `reason='complaint'` |
| `email.sent`, `delivery_delayed`, `received`, `suppressed` | só o `events` JSONB | — |

Todo evento é anexado ao array `events` do log — esse campo cresce sem limite
por e-mail.

**Implicação importante:** o `status` do log é **o último evento que chegou**.
Um e-mail aberto e depois com bounce fica `bounced`; um com bounce e depois
aberto fica `opened`. Os campos `*_at` preservam cada um; o `status` não.

### 3.4 O que o webhook não registra

- Eventos com assinatura inválida (401).
- Eventos para `resend_id` desconhecido (respondidos como `ignored`, não
  persistidos além do `svix-id`).
- Eventos recebidos enquanto a função estava fora do ar — o Resend retenta,
  mas não indefinidamente. A função `backfill-resend-events` existe para
  re-sincronizar pelo `resend_id`.

## 4. O domínio

### 4.1 Registros DNS (painel Resend, 21/08 — todos **Verified**)

| Tipo | Nome | Para quê |
|---|---|---|
| TXT | `resend._domainkey` | DKIM |
| MX | `send` | feedback de bounce (`feedback-smtp…amazonses.com`, prioridade 10) |
| TXT | `send` | SPF (`v=spf1 include:…amazonses.com ~all`) |
| CNAME | `links` | tracking de cliques (`links1.resend-dns.com`) |
| CAA | — | `0 issue "amazon.com"` |

"Enable Sending" ligado; "Enable Receiving" desligado.

### 4.2 Status no banco vs. no painel

`email_domains.status` do MCD está `partially_verified`; o painel diz
Verified. **O banco só muda quando alguém dispara uma das ações** de
`email-domain-manage` (`import`, `create`, `verify`) — não há cron. O valor
guardado é do momento do cadastro, com o DNS ainda propagando.

A ação `verify` (`email-domain-manage/index.ts:233-266`): chama
`POST /domains/{id}/verify` no Resend, busca o domínio, normaliza o status
(`partially_failed` → `partially_verified`) e grava com `last_checked_at`.
É o botão "verificar" da tela de domínios.

**Para o envio tanto faz:** `send-email` aceita `verified` **ou**
`partially_verified` (`send-email/index.ts:181`). Só recusa `pending` /
`failed`. O que fica errado com o status defasado é a leitura — e um
domínio que passasse a falhar de verdade continuaria marcado como bom.
Sincronização automática é o item F2.6 do roadmap de escala.

### 4.3 Qual domínio sai no `from`

`send-email/index.ts:160-163`: o domínio do `from_email` do **template**, a
menos que a fila traga `from_domain_override` (rotação de domínio por
`from_domain_pool` da campanha). O MCD não usa pool (`email_domains.rotation_pool`
vazio), então é sempre o do template.

## 5. Limites da conta

**❓ Não confirmado.** O worker (`process-email-queue`) está calibrado com
`CONCURRENCY=5` e `BATCH_PARALLELISM=5` — comentário no código diz "Tier 4:
Resend permite 5 req/s por team". Esses valores são **globais**: valem para a
conta principal e para a do MCD igualmente. Se a conta do MCD for de outro
tier, ou sobra capacidade sem uso, ou o Resend devolve 429 — que o worker
trata como `rate limit` e reagenda respeitando `Retry-After`.

Pergunta para o Natanael: tier da conta e limite de requisições por segundo.

O que o CRM manda em cada chamada (`send-email-batch/index.ts:304-326`):
`from` com nome, `to` com nome, `subject`, `html`, `text` quando o template
tem, headers `List-Unsubscribe` + `List-Unsubscribe-Post` (exigência
Gmail/Yahoo para remetente em massa), e três tags: `template`, `category`,
`clinic` (= slug `mcd`). As tags aparecem no painel do Resend e permitem
filtrar os envios do CRM dos feitos por fora.

Batch API: até 100 e-mails por chamada, com `Idempotency-Key` por lote.

## 6. Sintomas por peça que some

| Sumiu | Sintoma | Onde ver |
|---|---|---|
| env var da chave (`secret_name`) | envio **continua**, pela conta principal; `from` provavelmente recusado (`domain not verified`) → fila em `failed` | log da edge `send-email` (`warn … not set, falling back`); painel da conta principal |
| linha em `clinic_email_integrations` ou `enabled=false` | idem acima, sem nem o `warn` | `select * from clinic_email_integrations` |
| `RESEND_WEBHOOK_SECRET_MCD` | envio normal; **nenhum** evento do MCD chega (401 silencioso); relatórios param em "enviado" | `resend_webhook_events` para de receber `clinic`=mcd; painel Resend mostra falhas no endpoint |
| endpoint no painel | idem | painel Resend → Webhooks |
| domínio no painel | `domain not verified` em todo envio → fila em `failed` | `email_queue.error` |

## 7. Procedimentos

**Rotacionar a chave da API:** criar a chave nova no painel do MCD; atualizar
o valor da variável de ambiente (mesmo nome — `secret_name` não muda); o
`send-email` pega em até 60 s (cache da integração é só da linha, a env var é
lida a cada chamada); revogar a antiga no painel.

**Rotacionar o secret do webhook:** criar o endpoint novo no painel (ou
regenerar o secret); atualizar `RESEND_WEBHOOK_SECRET_MCD`; como a função
testa todos os secrets, dá para manter os dois por um período adicionando
`RESEND_WEBHOOK_SECRET_MCD2` e removendo o antigo depois.

**Forçar sincronização do domínio:** tela de domínios → verificar. Ou, pelo
SQL Editor, conferir `last_checked_at` em `email_domains`.

Variáveis de ambiente só podem ser alteradas pelo agente do Lovable (Cloud
→ Secrets); não há acesso direto.
