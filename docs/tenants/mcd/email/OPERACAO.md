---
title: "E-mail do MCD — Operação (D1)"
topic: email
kind: runbook
audience: both
status: vivo
updated: 2026-08-21
summary: "Como disparar, acompanhar, pausar e retomar uma campanha do MCD com o que existe hoje — incluindo o que cada estado da tela significa por dentro, a saída de emergência pelo SQL Editor enquanto o enfileiramento automático não funciona, e o checklist antes de um disparo grande."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
code_refs:
  - src/pages/email/EmailCampaigns.tsx
  - src/components/email/live/CampaignLiveDialog.tsx
  - supabase/functions/dispatch-campaign/index.ts
  - supabase/functions/process-scheduled-campaigns/index.ts
  - supabase/functions/process-email-queue/index.ts
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/INCIDENTES.md
  - docs/roadmap/EMAIL_ESCALA.md
---

# E-mail do MCD — Operação

> **Estado em 21/08/2026 à noite:** o disparo pela tela marca a campanha como
> "enviando", mas o enfileiramento automático (cron) **não está executando**.
> Até isso ser consertado, campanha grande disparada pela tela fica em
> "enviando" para sempre. A §5 tem a saída de emergência.

## 1. Se você é quem vai apertar o botão

Leia só isto se tiver pressa:

1. **Nunca dispare para o segmento "Desafio" como teste.** São 146 mil pessoas
   e não existe modo de simulação. Teste é com o segmento **"Leads Site"**, que
   tem 0 contatos e exercita o caminho inteiro sem enviar nada.
2. **Antes de um disparo grande**, passe pelo checklist da §6. O item que mais
   importa é o ritmo: sem ele, 146 mil e-mails saem o mais rápido que o
   sistema conseguir, e o domínio pode ser bloqueado pelos provedores.
3. "Enviando" com **0/0** por mais de 3 minutos não é normal hoje. Ver §5.
4. **Pausar funciona** e não tem vergonha. Pausar, conferir, retomar.
5. **Nunca** reenvie "para garantir" nem remova um descadastro.

## 2. O que acontece ao apertar enviar

Passo a passo real, com o que a tela mostra e o que está acontecendo por trás
(`EmailCampaigns.tsx` → `dispatch`, `dispatch-campaign/index.ts`):

| Momento | Tela | Por dentro |
|---|---|---|
| Você confirma "Enviar campanha agora?" | botão trava, toast "Campanha em envio", abre o diálogo **Ao vivo** | a tela chama a edge function `dispatch-campaign` |
| < 1 s | status vira **enviando** | a função checa feature e template ativo; marca `status='sending'`; devolve 202 **sem enfileirar** |
| até 1 min (esperado) | ainda **enviando**, diálogo em 0/0 | o cron `enqueue-pending-campaigns` deveria pegar a campanha e chamar `enqueue_campaign_recipients`, que monta a fila inteira numa transação |
| fim do enfileiramento | status vira **enviada**, destinatários aparecem (`N / N`) | `total_recipients` e `enqueued_count` preenchidos; `sent_at` gravado |
| a partir daí | barra de progresso sobe; diálogo mostra taxa e ETA | `process-email-queue` (a cada 10 s) pega lotes de 1.000 e envia via `send-email-batch` → Resend |

**Atenção ao vocabulário da tela:** "enviada" significa **enfileirada** — a
campanha foi aceita e está na fila. Os envios de verdade acontecem depois, e o
número à esquerda da barra (`sent_count`) é que conta o que já saiu.

Se algo falhar no enfileiramento, o status vira **falhou** e a mensagem fica
no campo `error` da campanha (visível pela query da §5). Isso é o comportamento
novo de 21/08: antes, a campanha era marcada como enviada com o público
parcial que tivesse dado tempo de coletar.

## 3. Os estados

| Na tela | No banco | Significa | Ações disponíveis |
|---|---|---|---|
| rascunho | `draft` | criada, nunca disparada | editar, enviar, duplicar, excluir |
| agendada | `scheduled` | tem `scheduled_for` futuro; `process-scheduled-campaigns` dispara quando chegar a hora (❓ confirmar que esse cron está ativo — não apareceu na listagem de 21/08) | editar, enviar agora, pausar |
| enviando | `sending` | disparada; enfileirando **ou** já enviando | Ao vivo, pausar |
| enviada | `sent` | fila montada; envio em curso ou concluído | relatório, duplicar |
| pausada | `paused` | itens pendentes da fila viraram `paused` | retomar |
| falhou | `failed` | pré-checagem ou enfileiramento falhou; motivo em `error` | relatório, duplicar |

**Pausar** (`pause` em `EmailCampaigns.tsx`, igual no diálogo Ao vivo):
troca `pending → paused` em todas as linhas da fila da campanha e marca a
campanha como `paused`. **Não** alcança o que já foi entregue ao Resend — o
lote em voo (até 1.000) ainda sai.

**Retomar** (`resume`): troca `paused → pending` com `scheduled_at = agora`
e decide o status pelo que a campanha tem:

- se tem `scheduled_for` futuro → `scheduled`;
- se tem `sent_count > 0` **ou** `total_recipients > 0` → `sending`;
- **senão → `draft`**.

Consequência prática: uma campanha pausada **antes** do enfileiramento
terminar (0 destinatários) volta para **rascunho** ao retomar, e o cron não a
pega mais. É preciso **disparar de novo**. Foi o caso da "Aula" em 21/08.

## 4. O diálogo "Ao vivo"

Lê `email_campaigns` (realtime) e `campaign_throughput` (1 linha por minuto,
alimentada pelo trigger `tg_email_queue_campaign_counters` a cada envio).

- **0 / 0 e "Calculando…"** enquanto `total_recipients` for 0 — ou seja,
  enquanto o enfileiramento não terminou. Normal por até ~1 minuto.
- **Enviados / Falhas** vêm de `sent_count` / `failed_count` da campanha.
- **Na fila** vem de contagem da `email_queue`.
- **Taxa** é a média dos últimos minutos em `campaign_throughput`; só aparece
  depois dos primeiros envios.
- O botão **Pausar** do diálogo faz exatamente o mesmo que o da lista.

## 5. Saída de emergência (enquanto o cron não pega a campanha)

Tudo abaixo é no **SQL Editor**, que não tem o teto de 8 segundos.

**5.1 Diagnóstico** — o que está acontecendo com a campanha:

```sql
select k.name, k.status,
       coalesce(k.total_recipients, 0) as destinatarios,
       coalesce(k.send_rate_per_minute, 0) as por_minuto,
       (select count(*) from public.email_queue q
         where q.related_lead_table = 'campaign_' || k.id::text) as na_fila,
       (select count(*) from public.email_queue q
         where q.related_lead_table = 'campaign_' || k.id::text and q.status = 'sent') as enviados,
       coalesce(k.error, '-') as erro,
       to_char(k.updated_at, 'DD/MM HH24:MI') as atualizada
from public.email_campaigns k
where k.clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
order by k.updated_at desc
limit 5;
```

Leitura: `sending` + `na_fila = 0` + `erro = -` por mais de 3 minutos = o cron
não executou.

**5.2 Ritmo antes de tudo.** Sem isso, a fila inteira fica com o mesmo
horário e sai de uma vez:

```sql
update public.email_campaigns
   set send_rate_per_minute = 500, updated_at = now()
 where name = 'NOME DA CAMPANHA'
   and clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a';
```

500/min espalha 146 mil em ~5 horas. Ver `ENTREGABILIDADE.md` (D5) para a
regra de aquecimento — enquanto ela não existe no sistema, **comece abaixo do
que acha seguro**.

**5.3 Enfileirar na mão** — só quando quiser que o envio comece de fato:

```sql
select public.enqueue_campaign_recipients(
  (select id from public.email_campaigns
    where name = 'NOME DA CAMPANHA'
      and clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'));
```

Devolve `{"campaign_id": …, "enqueued": N}`. Se a campanha já tiver linhas na
fila, a função **recusa** (não duplica) — limpe antes, se for intencional.
Para 146 mil linhas pode levar alguns minutos; o editor espera.

**5.4 Concluir o status** (a função não faz isso quando chamada na mão):

```sql
update public.email_campaigns
   set status = 'sent',
       total_recipients = (select count(*) from public.email_queue q
                            where q.related_lead_table = 'campaign_' || id::text),
       enqueued_count  = (select count(*) from public.email_queue q
                            where q.related_lead_table = 'campaign_' || id::text),
       sent_at = now(), updated_at = now()
 where name = 'NOME DA CAMPANHA'
   and clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
   and status = 'sending';
```

A partir daí o `process-email-queue` (10 s) começa a drenar a fila sozinho.

**5.5 Parar tudo agora** — equivale ao botão Pausar, sem depender da tela:

```sql
update public.email_queue
   set status = 'paused', updated_at = now()
 where status = 'pending'
   and related_lead_table = 'campaign_' || (
     select id::text from public.email_campaigns
      where name = 'NOME DA CAMPANHA'
        and clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a');
```

## 6. Checklist antes de um disparo grande

- [ ] **Teste com "Leads Site"** concluiu como `sent` com 0 destinatários e sem erro.
- [ ] **E-mail de teste** da campanha chegou e o conteúdo está certo (botão de
      teste — envia 1 e-mail, não muda o status).
- [ ] **Prévia de destinatários** mostra o número esperado (lembrando que ela
      é pré-calculada a cada 10 min).
- [ ] **Webhook** ativo e sem falhas acumuladas no painel Resend **da conta do
      MCD** — senão entrega/abertura/bounce não aparecem.
- [ ] **Domínio** verificado no painel Resend (o status no banco pode estar
      defasado; o que vale é o painel).
- [ ] **Ritmo definido** (`send_rate_per_minute`), ver §5.2.
- [ ] Ninguém mais vai disparar a mesma campanha ao mesmo tempo (há 4 owners
      na conta).
- [ ] Você sabe **pausar** (§3) e vai olhar o diálogo Ao vivo nos primeiros
      minutos: falhas subindo rápido = pausar e investigar.

## 7. O que nunca fazer

- **Reenviar a lista toda "para garantir".** O dedup (`email_send_dedup`)
  protege contra o mesmo template ir duas vezes para o mesmo e-mail no mesmo
  contexto — mas uma campanha nova é contexto novo. Reenviar envia de novo.
- **Disparar para o "Desafio" como teste.**
- **Remover descadastro** (`Descadastros` → lixeira). A pessoa pediu para sair.
  (Desde 21/08 a remoção respeita a clínica; antes apagava em todas.)
- **Desligar o dedup** ou "otimizar" o `email_send_dedup` para acelerar.
- **Editar a fila na mão** além do que está na §5.

## 8. Pendências que mudam este documento

- Cron `enqueue-pending-campaigns` (job 58) não executa — causa não
  identificada. Proposta em aberto: mover a checagem de campanhas pendentes
  para dentro do `process-email-queue`, que roda a cada 10 s e comprovadamente
  funciona. Quando resolver, a §5 vira apêndice.
- Ritmo automático (decisão de 21/08: o operador não escolhe número). Até lá,
  §5.2 é manual.
- Confirmar o cron de campanhas agendadas (§3).
