---
title: "E-mail do MCD — Entregabilidade (D5)"
topic: email
kind: map
audience: both
status: vivo
updated: 2026-08-21
summary: "O risco que nenhuma correção de código cobre: lista fria de 146k, 16% de bounce acumulado, 4.282 entregas adiadas em uma semana, e todos os freios automáticos do sistema inativos no MCD — incluindo a descoberta de que a pausa automática por bounce não para a fila e, desde 21/08, nem alcança campanha em envio. Proposta de ritmo automático."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/OPERACAO.md
  - docs/tenants/mcd/email/LISTA_E_SEGMENTOS.md
  - docs/roadmap/EMAIL_ESCALA.md
---

# E-mail do MCD — Entregabilidade

## 1. Por que este é o documento que mais importa

Tudo que foi corrigido em 21/08 faz o sistema **conseguir** enviar 146 mil
e-mails. Nada disso decide se eles **chegam**. Quem decide é o Gmail, o
Outlook e o Yahoo, olhando a reputação do `marketingcomdigital.com.br` — e
reputação queimada não tem correção de código.

## 2. Os números de hoje

Eventos da conta Resend do MCD (`resend_webhook_events`, 21/08):

| Evento | Últimos 7 dias | Total | Leitura |
|---|---|---|---|
| `email.sent` | 1.238 | 16.605 | aceito pelo Resend |
| `email.delivered` | 1.167 | 14.981 | entregue na caixa |
| **`email.delivery_delayed`** | **4.282** | 7.576 | o provedor **segurou** — tentando de novo |
| **`email.bounced`** | **889** | **2.691** | recusado |
| `email.complained` | 1 | 3 | marcado como spam |
| `email.opened` | 928 | 1.067 | — |

Duas contas que assustam:

- **Bounce acumulado: 2.691 de 16.605 = 16%.** O mercado considera
  > 2% preocupante e > 5% motivo de bloqueio. O próprio sistema tem um
  limiar de 5% (§4).
- **Adiamentos: 4.282 em uma semana com só 1.238 enviados.** Um e-mail pode
  gerar vários `delivery_delayed` (cada tentativa); ainda assim, é o sinal
  clássico de remetente sob suspeita.

**Ressalva honesta:** parte desse histórico é de campanhas anteriores ao
webhook ser configurado, e os eventos de julho chegaram com atraso. Os
números por dia da §7 são a medida certa — rodar antes de qualquer decisão.

O que **não** é o problema: DNS. DKIM, SPF, CAA e tracking estão todos
verificados no painel (ver `INTEGRACAO_RESEND.md` §4).

## 3. O que define reputação, em linguagem direta

Os provedores olham, por domínio e por IP de envio:

1. **Taxa de bounce** — mandar para caixa inexistente é o sinal mais forte de
   lista comprada ou velha.
2. **Reclamações de spam** — acima de 0,1% já pesa; 0,3% é o limiar do sistema.
3. **Volume repentino** — um domínio que mandava 17 mil e de repente manda
   146 mil em uma hora se parece com conta invadida.
4. **Engajamento** — abertura e clique ajudam; e-mail ignorado em massa pesa
   contra.
5. **Consistência** — volume previsível, todo dia, constrói histórico.

A lista do MCD é **fria** (142 mil entraram em 21/08; origem ❓) e o domínio
tem histórico curto. Os itens 1, 3 e 4 são todos desfavoráveis hoje.

## 4. Os freios que o sistema tem — e o estado de cada um no MCD

| Freio | Como funciona | No MCD |
|---|---|---|
| **Cota diária** (`clinic_email_quota`) | `settings.email.quota_daily`; default 1.000/dia | **50.000.000** — inativa |
| **Warm-up por idade do domínio** (`claim_domain_warmup`) | escada: dia 0 = 50, 1 = 100, 2 = 500, 3 = 1.000, 4-6 = 5.000, 7-10 = 10.000, 11-13 = 25.000, 14+ = livre | **sem linha** em `email_domain_warmup` — inativo |
| **Throttle por provedor de destino** (`claim_recipient_throttle`) | 1.000/hora por domínio de destino (Gmail, Outlook…) | **desligado** (`throttle_recipient_enabled=false`) |
| **Ritmo da campanha** (`send_rate_per_minute`) | espaça o `scheduled_at` da fila | só se preenchido; **sem campo na tela** |
| **Pausa automática por saúde** (`check_clinic_bounce_health`) | ver §4.1 | ativa, mas ver o problema |

Ou seja: com a configuração atual, uma campanha de 146 mil sem
`send_rate_per_minute` sai o mais rápido que o worker conseguir — algo como
25 e-mails em paralelo, continuamente, até acabar.

### 4.1 A pausa automática não freia de verdade

Trigger `email_logs_bounce_health_trigger`: a cada bounce ou reclamação,
olha os **últimos 1.000 logs da clínica**; se bounce > **5%** ou reclamação
> **0,3%** (com pelo menos 50 na amostra), grava em `email_health_alerts` e
marca como `paused` as campanhas em `running`, `sending` ou `scheduled`. Só
dispara uma vez a cada 10 min.

Dois problemas, achados em 21/08 ao escrever este documento:

1. **Ela só muda o status da campanha — não toca na fila.** O
   `process-email-queue` pega jobs `pending` sem olhar o status da campanha.
   Os e-mails **continuam saindo**. A "pausa" só impede campanhas
   `scheduled` de serem disparadas.
2. **Desde 21/08 a campanha vai para `sent` assim que é enfileirada.**
   `sent` não está na lista que o trigger pausa. Uma campanha em pleno envio
   é invisível para ele.

Conclusão: **hoje não existe freio automático que pare um envio ruim em
andamento.** O único é o botão Pausar, apertado por uma pessoa olhando o
diálogo Ao vivo. Registrado como G-39 no roadmap de escala.

`email_health_alerts` tem 1 linha (Fase 0) — o trigger já disparou uma vez.

## 5. Regra manual, até existir a automática

Enquanto o sistema não regula sozinho:

1. **Nunca 146 mil de uma vez.** Defina `send_rate_per_minute` antes de
   enfileirar (`OPERACAO.md` §5.2).
2. **Degraus por dia**, inspirados na escada de warm-up que o sistema tem e
   não está usando: começar na casa de **5 mil/dia**, dobrar a cada 2-3 dias
   **se** bounce < 3% e adiamento não disparar, parar de subir ao primeiro
   sinal ruim. 146 mil caberiam em ~2 semanas.
3. **Olhar o Ao vivo nos primeiros 15 minutos** de cada degrau: falhas
   subindo rápido = pausar.
4. **Antes do primeiro degrau, limpar o óbvio:** a query da §7.2 lista
   domínios de destino inexistentes ou com erro de digitação (`gmail.con`,
   `hotmal.com`…). Cada um é um bounce garantido.
5. **Depois de cada degrau**, a §7.1 mostra bounce e adiamento do dia.

Uma verdade desconfortável: com 16% de bounce histórico, é possível que a
primeira campanha grande **pause sozinha** pelo trigger — mas, pelo §4.1,
pausar não para. Quem para é você.

## 6. Proposta: ritmo automático (decisão de 21/08)

Pedir ao operador um número ("quantos por minuto?") transfere para ele uma
decisão que depende de dados que ele não vê. Errar para cima custa dias.
**O sistema deve decidir.** Esboço do que entra no roadmap de escala:

- **Limite vive na clínica**, não na campanha: `settings.email.rate_per_minute`
  lido pelo enfileiramento. Campanha só sobrescreve para baixo.
- **Começa conservador** (ex.: 50/min) quando não há histórico.
- **Sobe sozinho** a cada dia em que bounce < 3%, reclamação < 0,1% e
  `delivery_delayed` / `sent` < 20% — degraus da escada de warm-up.
- **Desce sozinho** (metade) quando qualquer limiar estoura, e **pausa a
  fila de verdade** (`pending → paused` das campanhas da clínica) acima do
  limiar crítico — o que o trigger de hoje deveria fazer.
- Tudo que ele precisa já existe: `email_logs` (bounce, complaint),
  `resend_webhook_events` (adiamentos), `email_domain_warmup` (a escada), e
  o cron de 10 min.

## 7. Queries

### 7.1 Saúde por dia (rodar antes de decidir o próximo degrau)

```sql
select received_at::date as dia,
       count(*) filter (where event_type = 'email.sent') as enviados,
       count(*) filter (where event_type = 'email.delivered') as entregues,
       count(*) filter (where event_type = 'email.delivery_delayed') as adiados,
       count(*) filter (where event_type = 'email.bounced') as bounces,
       count(*) filter (where event_type = 'email.complained') as reclamacoes,
       round(100.0 * count(*) filter (where event_type = 'email.bounced')
             / nullif(count(*) filter (where event_type = 'email.sent'), 0), 1) as bounce_pct
from public.resend_webhook_events
where received_at > now() - interval '30 days'
group by 1 order by 1;
```

(`resend_webhook_events` não tem `clinic_id`; se outra conta enviar no mesmo
período, os números se misturam. Para isolar o MCD, usar `email_logs` com
`clinic_id`, que só registra o que passou pelo webhook dele.)

### 7.2 Domínios de destino suspeitos (bounce garantido)

```sql
select lower(split_part(email, '@', 2)) as dominio, count(*)
from public.email_segment_contacts
where clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
  and lower(split_part(email, '@', 2)) similar to
      '%(gmail\.co|gmail\.con|gmai\.com|gmial\.com|hotmal\.com|hotmai\.com|outlok\.com|yaho\.com|\.comm|\.con)$'
group by 1 order by 2 desc;
```

### 7.3 Bounce por campanha (depois de cada envio)

```sql
select k.name,
       count(l.id) as logs,
       count(*) filter (where l.bounced_at is not null) as bounces,
       round(100.0 * count(*) filter (where l.bounced_at is not null) / nullif(count(l.id), 0), 1) as bounce_pct,
       count(*) filter (where l.complained_at is not null) as reclamacoes
from public.email_campaigns k
join public.email_logs l on l.related_lead_table = 'campaign_' || k.id::text
where k.clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
group by k.name order by logs desc;
```

## 8. O que ainda não se sabe

- Tier da conta Resend e limite de req/s (❓).
- Origem e idade da lista (❓).
- Se já houve aviso de reputação no painel do Resend (❓ — perguntar).
- Os números **por dia** — a §7.1 responde; ninguém rodou ainda.
