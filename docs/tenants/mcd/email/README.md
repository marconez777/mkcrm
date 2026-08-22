---
title: "E-mail do MCD — índice e estado conhecido"
topic: email
kind: map
audience: both
updated: 2026-08-21
summary: "Como o e-mail do MCD é diferente dos outros tenants (conta Resend própria, webhook próprio, domínio próprio, cota e throttle próprios, lista de 163k) e o estado verificado em 21/08/2026 — incluindo o que está quebrado. Ponto de entrada da documentação de e-mail do tenant."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
code_refs:
  - supabase/functions/send-email/index.ts
  - supabase/functions/send-email-batch/index.ts
  - supabase/functions/resend-webhook/index.ts
  - supabase/functions/dispatch-campaign/index.ts
  - supabase/functions/process-email-queue/index.ts
related_docs:
  - docs/tenants/mcd/email/ROADMAP_DOCUMENTACAO.md
  - docs/roadmap/EMAIL_ESCALA.md
  - docs/maps/EMAIL_MARKETING.md
---

# E-mail do MCD — índice e estado conhecido

> Este arquivo é o **índice**. Documentos prontos:
>
> - [`OPERACAO.md`](./OPERACAO.md) — **comece aqui se vai disparar algo**: estados, pausar/retomar, saída de emergência, checklist.
> - [`INCIDENTES.md`](./INCIDENTES.md) — o que já quebrou, causa, correção, o que ficou.
> - [`INTEGRACAO_RESEND.md`](./INTEGRACAO_RESEND.md) — conta, chave, webhook e domínio próprios; o que some e como aparece.
> - [`FLUXO_DE_ENVIO.md`](./FLUXO_DE_ENVIO.md) — as oito etapas de um e-mail, com o limite e o sintoma de cada uma.
>
> Os demais (lista, entregabilidade, métricas) estão
> planejados em [`ROADMAP_DOCUMENTACAO.md`](./ROADMAP_DOCUMENTACAO.md). Enquanto não existem,
> o que se sabe está resumido abaixo.

## 1. O que é diferente no MCD

Tudo abaixo foi verificado em código e banco em 21/08/2026.

### 1.1 Conta Resend própria

Os tenants em geral enviam pela conta Resend principal (variável de ambiente
`RESEND_API_KEY`). O MCD **não**: a tabela `clinic_email_integrations` tem uma
linha para ele com `provider = 'resend'` e um `secret_name` — o **nome** de
outra variável de ambiente, onde está a chave da conta dele.

Como o código resolve (`send-email/index.ts:191-212`, igual em
`send-email-batch`): lê a linha da clínica (cache de 60s), pega a variável de
ambiente com aquele nome, e usa a chave dela. Se a variável não existir, **cai
para a chave principal em silêncio**, só com um `console.warn` — ou seja, um
secret apagado faria o MCD enviar pela conta errada sem ninguém perceber.

Consequências práticas:

- limites de envio, reputação de IP e blocklists do MCD são **dele**, não
  compartilhados com os outros tenants;
- o domínio `marketingcomdigital.com.br` está verificado **na conta dele**,
  não na principal;
- as chaves de três tenants existem hoje: `mkart`, `or` e `mcd`
  (`clinic_email_integrations`).

### 1.2 Webhook próprio

Cada conta Resend tem seu signing secret. O `resend-webhook` aceita **qualquer
variável de ambiente cujo nome comece com `RESEND_WEBHOOK_SECRET`** e testa a
assinatura contra todas, da mais curta para a mais longa. O do MCD é
`RESEND_WEBHOOK_SECRET_MCD`.

Dois fatos importantes:

- o endpoint do webhook precisa estar cadastrado **no painel Resend da conta
  do MCD**, apontando para a mesma URL da função;
- evento com assinatura que não bate com nenhum secret recebe **401 e não é
  registrado em lugar nenhum**. O secret do MCD foi cadastrado **depois** das
  primeiras campanhas — por isso elas quase não têm eventos de entrega (só
  1.238 `email.sent` na semana da campanha de 20/08, contra 16.778 enviados).
  Daqui em diante os eventos chegam; o buraco no histórico fica.

### 1.3 Domínio próprio e status defasado

`email_domains` guarda `marketingcomdigital.com.br` como **`partially_verified`**,
mas no painel Resend ele está **Verified** em tudo (DKIM, SPF, tracking). O
status no banco só muda quando alguém clica em verificar na tela — não há
sincronização automática (G-32 do roadmap de escala). O envio funciona com os
dois status; o que fica errado é a leitura.

### 1.4 Cota e throttle próprios

`clinics.settings->'email'` do MCD:

```json
{ "quota_daily": 50000000, "throttle_recipient_enabled": false }
```

- **Cota diária de 50 milhões** — na prática, sem cota. Os outros tenants
  estão no default de 1.000/dia (a ÓR tem 100.000).
- **Throttle por domínio de destino desligado** — o limite de 1.000/hora por
  provedor (Gmail, Outlook…) não se aplica ao MCD. É o que permite volume; é
  também o que remove um freio de reputação.
- **Warm-up inativo**: `email_domain_warmup` está vazia, então a escada de
  aquecimento por idade do domínio não se aplica.

### 1.5 A lista

| Medida | Valor |
|---|---|
| `email_segment_contacts` do MCD | **162.874** linhas / **146.727** e-mails distintos |
| Segmento "Desafio" (estático) | 146.683 linhas, todas distintas |
| Segmento "Leads Site" (dinâmico) | 0 |
| `leads` com e-mail | **0** |
| Entrada por mês | mai/26: 8.856 · jul/26: 11.713 · **21/08/26: 142.305** |

A lista inteira veio por importação de CSV. Nada é lead. Campanhas com público
"Todos" alcançam `leads` + `email_segment_contacts` — no MCD, só a segunda.

### 1.6 Campanhas enviadas

| Campanha | Data | Público da época | Alcançou | Logs |
|---|---|---|---|---|
| Campanha Cidô Amazon | 28/07 | ~4.5k | 4.504 | 4.469 |
| Campanha Aula Editora Digital | 31/07 | ~17k | 17.020 | 16.931 |
| convite dia 20 - ZAP | 20/08 | ~17k | 17.020 | 16.778 |

As três foram enviadas **antes** da importação dos 142k. Não houve truncagem
(hipótese levantada e descartada em 21/08).

### 1.7 Entregabilidade

Eventos do Resend nos últimos 7 dias antes de 21/08: `delivered` 1.167,
`bounced` 889, `opened` 928, **`delivery_delayed` 4.282**. Entrega adiada é o
provedor de destino segurando o remetente. Com lista fria e volume baixo já
nesse patamar, **um disparo de 146k de uma vez é risco real de bloqueio** —
não é problema de DNS (está verificado), é ritmo.

## 2. Estado do caminho de envio em 21/08/2026

Registrado sem enfeite, porque é o que a próxima pessoa precisa saber.

| Peça | Estado |
|---|---|
| Telas (Contatos, Campanhas, Segmentos, Fila, Painel, prévia) | **funcionam** com a lista de 163k; eram os primeiros a quebrar |
| Importação de CSV | **funciona** em lotes de 1.000, duplicado resolvido no banco |
| `dispatch-campaign` | só marca `sending` e devolve 202; **não enfileira** |
| Enfileiramento (`enqueue_pending_campaigns`, cron job 58, a cada minuto) | **não está executando** — campanha "Aula" ficou em `sending` com 0 na fila e sem erro por 4 min; foi pausada manualmente. Causa ainda não identificada (acesso a `cron.job_run_details` falhou no editor) |
| `enqueue_campaign_recipients` (função) | funciona quando chamada pelo editor; validada ponta a ponta com segmento vazio |
| `process-email-queue` | claim atômico (`FOR UPDATE SKIP LOCKED`); roda a cada 10s |
| `send-email-batch` | gates em lote (dedup, cota, warm-up, tokens), aborta o lote em erro de infra |
| Ritmo de envio | **não existe controle automático**; `send_rate_per_minute` fica no banco, sem campo na tela |

**Regra até o enfileiramento ser consertado:** nenhuma campanha grande deve
ser disparada pela tela — ela vai ficar em `sending` para sempre. A saída de
emergência é enfileirar pelo SQL Editor (`select enqueue_campaign_recipients(id)`),
que não tem o teto de 8s. Definir `send_rate_per_minute` **antes**.

## 3. Limites de plataforma que explicam o resto

- **8 segundos** para qualquer chamada via PostgREST — inclusive as feitas por
  edge function com `service_role`, porque o `statement_timeout` vem do papel
  `authenticator` que abre a conexão. Só `pg_cron` e o SQL Editor escapam.
- **Contar 162k e-mails distintos leva 8,6s** mesmo com índice (compute
  mínimo). Por isso as contagens da tela vêm de `email_audience_counts`,
  pré-calculada a cada 10 min, e não da hora.
- **1.000 linhas** por resposta do PostgREST.

## 4. Onde estão as coisas

| O quê | Onde |
|---|---|
| Chave Resend do MCD | env var apontada por `clinic_email_integrations.secret_name` |
| Secret do webhook | env var `RESEND_WEBHOOK_SECRET_MCD` |
| Cota / throttle | `clinics.settings->'email'` |
| Domínio | `email_domains` + painel Resend da conta do MCD |
| Lista | `email_segment_contacts` (`clinic_id` do MCD) |
| Contagens prontas | `email_audience_counts` (cron `refresh-email-audience-counts`) |
| Histórico de envio | `email_logs`; eventos brutos em `resend_webhook_events` |
| Gargalos e correções do dia | [`docs/roadmap/EMAIL_ESCALA.md`](../../../roadmap/EMAIL_ESCALA.md) |
