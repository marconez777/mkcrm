---
title: "E-mail do MCD — Métricas e relatórios (D6)"
topic: email
kind: map
audience: both
updated: 2026-08-21
summary: "Para cada número visível nas telas de e-mail — Painel, Campanhas, Ao vivo, Relatório, Segmentos, Fila — de que tabela vem, se é ao vivo ou pré-calculado, a defasagem, e onde ele ainda mente. Inclui a regra que mais confunde: o status de um e-mail é o último evento que chegou."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
code_refs:
  - src/pages/email/EmailDashboard.tsx
  - src/hooks/useEmailMetrics.ts
  - src/pages/email/EmailCampaigns.tsx
  - src/components/email/CampaignReportDialog.tsx
  - src/components/email/live/CampaignLiveDialog.tsx
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/FLUXO_DE_ENVIO.md
  - docs/tenants/mcd/email/INTEGRACAO_RESEND.md
---

# E-mail do MCD — Métricas e relatórios

## 1. A regra que explica a maioria das confusões

Cada linha de `email_logs` tem um `status` e vários carimbos de tempo
(`delivered_at`, `opened_at`, `clicked_at`, `bounced_at`, `complained_at`).
**O `status` é o último evento que chegou**; os carimbos preservam cada um.

Um e-mail entregue, aberto e depois com bounce (acontece: caixa cheia depois
da abertura) fica `status='bounced'`, mas `opened_at` continua preenchido.
Telas que contam por `status` e telas que contam por carimbo **dão números
diferentes** para o mesmo conjunto. Nenhuma está errada; medem coisas
diferentes.

## 2. Painel (Dashboard)

| Número | Fonte | Ao vivo? | Observação |
|---|---|---|---|
| Enviados / Entregues / Abertura / Cliques / Falhas — **janela ≤ 24 h** | `email_logs` da janela, contados no navegador por carimbo | sim (refresh ≤ 8 s via realtime) | baixa até 50 mil linhas; acima disso, corta em silêncio |
| Os mesmos — **janela > 24 h** | `email_metrics_daily` via `useEmailMetrics` | não — cron de 15 min (janela de 2 dias) + diário (35 dias) | **mente**: a query não tem `.range()`, o PostgREST devolve no máximo **1.000 linhas** (dias × templates); com ordenação crescente por dia, **os dias mais recentes são os cortados** |
| Fila: pendentes / falhas | `count(*)` no servidor | sim | corrigido 21/08 — antes lia 1.000 linhas e parava |
| Enviados hoje / cota | `email_send_state.sent_today` / `settings.email.quota_daily` | sim | no MCD a cota é 50M; a barra nunca enche |
| Distribuição de status (pizza) | `email_logs` da janela, **por `status`** | sim | pela regra da §1, difere dos cards que contam por carimbo |
| Tabela de últimos envios | `email_logs` da janela, 50 linhas | sim | busca por destinatário é feita sobre o que foi baixado |

**`email_metrics_daily`** (o que alimenta janelas longas): uma linha por
clínica × dia × template, com `sent` contando status em
`('sent','delivered','opened','clicked','bounced','complained')` — ou seja,
**`failed` não entra em `sent`** — e `delivered`/`opened`/etc. por carimbo.
Recalculada a cada 15 min para os 2 últimos dias e uma vez ao dia para 35.

## 3. Campanhas (lista)

| Número | Fonte | Observação |
|---|---|---|
| `N / total` (Enviados) | `sent_count` / `total_recipients` da campanha, **refinados** pela RPC `campaign_send_counts` | `sent_count` é mantido pelo trigger por e-mail; a RPC reconta em `email_logs` + `email_queue.failed`. Se a RPC falhar, a lista mostra o valor do trigger e avisa no console |
| Status | `email_campaigns.status` | **"enviada" = enfileirada**, não "todos entregues". Ver `OPERACAO.md` §2 |
| Segmento | `segment_ids` → nomes | — |
| Barra verde | `sent_count / total_recipients` | com `total_recipients = 0` (enfileiramento não concluído) fica 0 % |

## 4. Ao vivo

| Número | Fonte | Ao vivo? |
|---|---|---|
| Enviados / Falhas | `sent_count` / `failed_count` (realtime na linha da campanha) | sim |
| Na fila | `count(*)` de `email_queue` pendente da campanha | sim |
| Taxa | média dos últimos minutos em `campaign_throughput` (1 linha/minuto, via trigger) | sim |
| ETA | `(total − enviados) / taxa` | só após os primeiros minutos |
| Últimas falhas | 20 linhas `failed` da fila | polling de 5 s mesmo com a campanha parada (G-20 aberto) |

Mostra **0 / 0 e "Calculando…"** enquanto `total_recipients` for 0.

## 5. Relatório de campanha

Botão **Relatório**. Duas fontes coexistem:

- os cards de entrega/abertura/clique vêm de **contagem de todas as linhas
  de `email_logs` da campanha baixadas para o navegador** (com barra de
  progresso; 146 mil linhas = 146 requisições). Funciona desde os índices de
  21/08, mas é lento. A RPC `report_campaign_stats` já existe e faria isso em
  uma chamada — troca pendente (F3.4);
- "Destinatários" conta e-mails distintos das mesmas linhas.

Campanhas **anteriores ao cadastro do webhook** (as três do MCD até 20/08)
mostram entrega/abertura perto de zero **porque os eventos nunca chegaram**,
não porque ninguém abriu. Ver `INCIDENTES.md`.

## 6. Relatórios (aba)

Por template ou por campanha, via `report_template_stats` /
`report_campaign_stats` — **uma chamada, agregado no servidor**, com taxa de
abertura sobre entregues e melhor hora. É o caminho certo; as outras telas
deveriam imitar.

Definições dessas RPCs: `delivered` = sem `bounced_at` e status ≠ `failed`;
`open_rate` = abertos / entregues; `bounce_rate` = bounces / enviados.

## 7. Segmentos e prévia de destinatários

| Número | Fonte | Defasagem |
|---|---|---|
| "N destinatário(s)" no card do segmento | `email_audience_counts` via `email_segment_counts` | até 10 min |
| Prévia no modal de campanha: enviáveis / descadastrados | `email_audience_counts` via `email_segment_preview` | até 10 min; com vários segmentos é **soma** (`aproximado: true`) |
| Prévia de segmento dinâmico em edição | `resolve_email_segment_preview` | **`LIMIT 5000` fixo** — nunca mostra mais que 5.000 |

Em falha, o card de segmento mostra "contagem indisponível" (antes mostrava
**0**, que fazia parecer que o segmento estava vazio).

## 8. Fila e Logs

- **Fila**: paginada no servidor (25 por página) com `count: exact`; filtros
  por status; realtime filtrado por clínica com refresh ≤ 5 s.
- **Logs**: paginada, `count: exact`, busca por destinatário com `ilike
  '%…%'` — **sem índice para isso**; numa base grande a busca pode estourar
  os 8 s.

## 9. Onde os números ainda mentem (resumo)

| Tela | Mentira | Item |
|---|---|---|
| Painel, janela > 24 h | corta os dias mais recentes em 1.000 linhas | G-22 / F3.8 |
| Prévia de segmento dinâmico | trava em 5.000 | G-22 |
| Relatório de campanha antiga | entrega ≈ 0 por falta de eventos, não por falta de entrega | INCIDENTES 20/08 |
| Prévia com vários segmentos | soma, conta duas vezes quem está em dois | por desenho, marcado `aproximado` |
| Qualquer contagem de público | até 10 min atrasada | por desenho |
| Relatório de automação | estoura e mostra zeros | G-20 — irrelevante no MCD (não usa automação) |

## 10. Para conferir um número na mão

Enviados/entregues/abertos de uma campanha, por carimbo:

```sql
select count(*) as logs,
       count(*) filter (where delivered_at is not null) as entregues,
       count(*) filter (where opened_at is not null) as abertos,
       count(*) filter (where clicked_at is not null) as cliques,
       count(*) filter (where bounced_at is not null) as bounces,
       count(*) filter (where status = 'failed') as falhas
from public.email_logs
where related_lead_table = 'campaign_' || (
  select id::text from public.email_campaigns
   where name = 'NOME DA CAMPANHA'
     and clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a');
```

Os mesmos, por `status` (o que a pizza do Painel mostra):

```sql
select status, count(*)
from public.email_logs
where clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
  and sent_at > now() - interval '7 days'
group by 1 order by 2 desc;
```
