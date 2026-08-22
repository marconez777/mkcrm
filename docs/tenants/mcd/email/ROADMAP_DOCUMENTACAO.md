---
title: "Roadmap: documentação do e-mail do MCD"
topic: email
kind: roadmap
audience: both
status: concluido
updated: 2026-08-21
summary: "Plano detalhado para documentar o módulo de e-mail do tenant MCD: sete documentos, em ordem de urgência, cada um com o que precisa conter, de onde tirar a evidência (arquivo ou query) e quem responde o que o código não responde. Começa pelo que pode causar incidente amanhã."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/roadmap/EMAIL_ESCALA.md
  - docs/maps/EMAIL_MARKETING.md
---

# Roadmap: documentação do e-mail do MCD

## 0. Princípios

1. **Evidência antes de prosa.** Cada afirmação aponta para um arquivo e linha,
   ou para uma query cujo resultado foi colado. O que não foi verificado é
   marcado `❓` — em 21/08 três diagnósticos "certos" caíram por falta disso.
2. **O que é do MCD fica aqui; o que é do módulo fica no mapa geral.** Esta
   pasta não reexplica como o `send-email` renderiza template. Explica o que
   muda quando a clínica é o MCD.
3. **Documentar o estado real, incluindo o quebrado.** Doc que só descreve o
   cenário ideal é pior que nenhuma.
4. **Operador primeiro.** O Natanael vai operar sozinho. Cada doc tem uma seção
   "se você é quem vai apertar o botão" em linguagem sem jargão.

## 1. Os documentos, em ordem

| # | Arquivo | Pergunta que responde | Urgência |
|---|---|---|---|
| D1 ✅ | [`OPERACAO.md`](./OPERACAO.md) | Como disparar, pausar, retomar e saber se deu certo — hoje, com o que existe | 🔴 antes do próximo disparo |
| D2 ✅ | [`INTEGRACAO_RESEND.md`](./INTEGRACAO_RESEND.md) | Conta, chave, webhook e domínio próprios: o que é, onde está, como se perde | 🔴 |
| D3 ✅ | [`FLUXO_DE_ENVIO.md`](./FLUXO_DE_ENVIO.md) | O caminho de um e-mail do clique até o evento de entrega, com os limites em cada etapa | 🟠 |
| D4 ✅ | [`LISTA_E_SEGMENTOS.md`](./LISTA_E_SEGMENTOS.md) | De onde vem a lista, como entra, como é contada, o que a deduplica | 🟠 |
| D5 ✅ | [`ENTREGABILIDADE.md`](./ENTREGABILIDADE.md) | Reputação, ritmo, adiamentos, bounces — e a regra de aquecimento que o sistema ainda não tem | 🟠 |
| D6 ✅ | [`METRICAS_E_RELATORIOS.md`](./METRICAS_E_RELATORIOS.md) | O que cada número da tela significa, de onde vem, e onde ele mente | 🟡 |
| D7 ✅ | [`INCIDENTES.md`](./INCIDENTES.md) | Linha do tempo do que já quebrou, causa, correção, e o que ficou | 🟡 vivo |

## 2. D1 — `OPERACAO.md`

**Por que primeiro:** o caminho de disparo mudou três vezes em 21/08 e a versão
final ainda não funciona pela tela. Quem for disparar amanhã precisa saber
exatamente o que acontece ao apertar enviar.

**Conteúdo obrigatório:**

- Passo a passo do disparo pela tela: criar campanha → segmento → prévia →
  teste → enviar → o que a tela mostra em cada estado (`draft`, `sending`,
  `sent`, `paused`, `failed`).
- **O que "enviando" significa hoje**: a campanha foi marcada, o enfileiramento
  é assíncrono. Quanto tempo esperar antes de desconfiar.
- Como ler o diálogo "Ao vivo" — e por que ele mostra 0/0 até o enfileiramento
  terminar.
- **Pausar**: o que ele faz (reverte pendentes da fila), o que ele não faz
  (não para o que já foi para o Resend), e o estado em que a campanha fica.
- Retomar.
- **Saída de emergência pelo SQL Editor** quando o cron não pega a campanha:
  query de diagnóstico (status, fila, erro) e o `enqueue_campaign_recipients`
  manual, com a ordem certa (ritmo antes, enfileirar depois).
- Checklist pré-disparo grande: webhook ativo no painel, domínio verificado,
  ritmo definido, segmento conferido na prévia, teste enviado.
- O que **nunca** fazer: reenviar para a lista toda "para garantir"; disparar
  para o Desafio achando que é teste; remover descadastro.

**Evidência:** `dispatch-campaign/index.ts`, `EmailCampaigns.tsx` (funções
`dispatch`, `pause`, `resume`), `CampaignLiveDialog.tsx`,
`enqueue_pending_campaigns` e `enqueue_campaign_recipients` (migrations de
21/08). Estados possíveis: `grep -n "status" src/components/email/StatusBadge.tsx`.

**Pergunta aberta:** por que o cron job 58 não executa. Sem isso o D1 documenta
uma saída de emergência como caminho normal — aceitável por pouco tempo.

## 3. D2 — `INTEGRACAO_RESEND.md`

**Conteúdo obrigatório:**

- Diagrama de quem fala com quem: edge function → `clinic_email_integrations`
  → env var → API Resend (conta do MCD) → webhook → `resend-webhook` → secret
  `RESEND_WEBHOOK_SECRET_MCD` → `email_logs`.
- A linha de `clinic_email_integrations` do MCD: `secret_name`, `enabled`.
  **Não copiar a chave** — só o nome da variável.
- O fallback silencioso: se a env var sumir, o MCD passa a enviar pela conta
  principal com um `console.warn`. Como detectar (query em `email_logs` pelo
  domínio remetente vs. conta) e o que fazer.
- Webhook: URL cadastrada, eventos assinados (`sent`, `delivered`,
  `delivery_delayed`, `bounced`, `complained`, `opened`, `clicked`,
  `received`, `suppressed` — todos confirmados chegando em 21/08), o que cada
  um grava em `email_logs`, e o que **não fica registrado** (401 por
  assinatura inválida).
- Domínio: registros DNS (DKIM `resend._domainkey`, SPF em `send`, CAA,
  tracking `links`), status no painel vs. status no banco, como sincronizar
  (clique em verificar; cron de sincronização é o F2.6 do roadmap de escala).
- Limites da conta do MCD no Resend: tier, requisições/segundo, e como isso
  bate com `CONCURRENCY=5` / `BATCH_PARALLELISM=5` do worker, que são globais.
- Procedimento de rotação de chave e de secret do webhook.

**Evidência:** `send-email/index.ts:186-214`, `send-email-batch/index.ts:69-78`,
`resend-webhook/index.ts:18-52`, `email-domain-manage/index.ts`
(`normalizeDomainStatus`, ação `verify`), migration `20260519192043` (tabela).

**Pergunta aberta ao Natanael:** qual o tier da conta Resend dele e o limite
de req/s contratado. Define se o worker está sub ou superdimensionado.

## 4. D3 — `FLUXO_DE_ENVIO.md`

**Conteúdo obrigatório:** um e-mail, do clique ao evento, com **o limite de
cada etapa**:

| Etapa | Peça | Limite que importa para o MCD |
|---|---|---|
| 1 | `dispatch-campaign` | 8s PostgREST — por isso só marca `sending` |
| 2 | `enqueue_pending_campaigns` (pg_cron) | sem teto; 146k linhas num `INSERT` |
| 3 | `email_queue` | 8 índices; cada campanha = 146k linhas |
| 4 | `process-email-queue` (10s + self-trigger) | `BATCH_SIZE=1000`, claim atômico |
| 5 | `send-email-batch` | gates em lote; `claim_recipient_throttle` por job quando ligado (MCD: desligado) |
| 6 | Resend Batch API | 100 por chamada |
| 7 | `tg_email_queue_campaign_counters` | um `UPDATE` na campanha por e-mail enviado |
| 8 | webhook → `email_logs` | 1 `UPDATE` por evento, `events` JSONB cresce |

Para cada etapa: o que pode travar, como se manifesta, onde olhar.

**Evidência:** os cinco arquivos em `code_refs` do README desta pasta +
`tg_email_queue_campaign_counters` (migration `20260528022355`).

## 5. D4 — `LISTA_E_SEGMENTOS.md`

**Conteúdo obrigatório:**

- Origem da lista (CSV da ferramenta anterior? qual? opt-in de onde?). **Isso
  o código não sabe — perguntar.**
- Como a importação funciona hoje (`import_email_contacts`, lotes de 1.000,
  `ON CONFLICT DO NOTHING`), o que conta como duplicado, o que acontece com
  caixa alta e espaços.
- Os dois índices únicos e o buraco entre eles: contato **sem** segmento é
  único por `(clinic, lower(email))`; contato **dentro** de segmento é único
  por `(segment_id, email)` — reimportar o mesmo CSV em outro segmento
  duplica a pessoa.
- Segmentos do MCD: "Desafio" (estático, 146.683) e "Leads Site" (dinâmico,
  vazio). Público "Todos" = união de leads + contatos.
- Como a contagem é feita (`email_audience_counts`, a cada 10 min) e a
  defasagem que isso implica.
- Descadastro: fluxo `email-unsubscribe`, token HMAC, o que acontece com a
  fila, e a regra `(clinic_id, email)` — por que remover descadastro é perigoso.

**Evidência:** `EmailContacts.tsx` (import), `EmailSegments.tsx`,
`resolve_email_segment` (migration `20260525231823`), `import_email_contacts`,
`refresh_email_audience_counts`, `email-unsubscribe/index.ts`.

**Query para o doc:** distribuição por domínio de destino da lista (define o
custo de qualquer throttle):

```sql
select lower(split_part(email, '@', 2)) as dominio, count(*) as contatos,
       round(count(*) * 100.0 / sum(count(*)) over (), 1) as pct
from public.email_segment_contacts
where clinic_id = '3c48b379-f084-478d-a51c-9daa41ad661a'
group by 1 order by 2 desc limit 15;
```

## 6. D5 — `ENTREGABILIDADE.md`

**Por que existe:** é o único risco que nenhuma correção de código cobre.
4.282 `delivery_delayed` em uma semana com volume baixo; o domínio está
verificado; o throttle está desligado; o warm-up está inativo. Não há freio.

**Conteúdo obrigatório:**

- Leitura dos eventos: o que `delivery_delayed` significa no Resend, o que
  `bounced` hard vs. soft significa, o que `suppressed` significa.
- Os três freios que o sistema tem e o estado de cada um no MCD (cota: 50M,
  inativa; throttle: desligado; warm-up: sem linha).
- **Proposta de ritmo automático** (decisão de 21/08: o operador não deve
  escolher número): limite na clínica, começa conservador, sobe enquanto
  adiamento/bounce ficam abaixo de limiar, desce sozinho quando passam. Os
  dados para isso já existem em `email_logs` e `resend_webhook_events`.
  Enquanto não existe, a regra manual: `send_rate_per_minute` definido
  **antes** de enfileirar, e subir em degraus por dia.
- Tabela de referência de ritmo por reputação (a preencher com dados reais
  após a primeira campanha grande).

**Evidência:** `claim_recipient_throttle`, `claim_domain_warmup`,
`clinic_email_quota` (migrations `20260526121517`, `20260516003608`),
`check_clinic_bounce_health`.

**Query para o doc** (taxa de adiamento por dia, últimos 30 dias):

```sql
select received_at::date as dia,
       count(*) filter (where event_type = 'email.sent') as enviados,
       count(*) filter (where event_type = 'email.delivery_delayed') as adiados,
       count(*) filter (where event_type = 'email.bounced') as bounces
from public.resend_webhook_events
where received_at > now() - interval '30 days'
group by 1 order by 1;
```

## 7. D6 — `METRICAS_E_RELATORIOS.md`

**Conteúdo obrigatório:** para cada número visível (Painel, Campanhas,
Relatório de campanha, Segmentos, Fila): de que tabela vem, se é ao vivo ou
pré-calculado, qual a defasagem, e **onde ele ainda mente** — lista em 21/08:

- métricas do Painel em janelas longas cortam os dias mais recentes em 1.000
  linhas (`useEmailMetrics.ts:33`);
- prévia de segmento dinâmico em edição trava no `LIMIT 5000`;
- relatório de automação (`AutomationReportDialog`) não escala — irrelevante
  para o MCD, que não usa automação;
- campanhas anteriores ao cadastro do webhook não têm entrega/abertura.

## 8. D7 — `INCIDENTES.md`

Formato fixo por entrada: **data · sintoma · causa · correção · o que ficou**.
Semear com 21/08/2026 — o dia inteiro está em
[`docs/roadmap/EMAIL_ESCALA.md`](../../../roadmap/EMAIL_ESCALA.md) §4 e §8,
mas ali é por gargalo; aqui é por incidente, do ponto de vista de quem opera.

Entradas iniciais: tela de contatos com 500; campanhas "1–6 de 6" vazia;
prévia de destinatários com timeout; campanha "teste" marcada `failed` por
`forbidden` (cron sem contexto); campanha "Aula" presa em `sending` (cron não
executa); diagnóstico errado de truncagem (17.020 de 146k) e sua retratação.

## 9. Ordem de execução e esforço

| Passo | O quê | Depende de | Esforço |
|---|---|---|---|
| 1 ✅ | D1 Operação — versão "estado de hoje" (21/08) | cron 58 documentado como pendência | — |
| 2 ✅ | D2 Integração Resend (21/08; tier da conta marcado ❓) | — | — |
| 3 ✅ | D7 Incidentes — semeado com 21/08 | — | — |
| 4 ✅ | D3 Fluxo de envio (21/08) | — | — |
| 5 ✅ | D4 Lista e segmentos (21/08; origem da lista ❓) | — | — |
| 6 ✅ | D5 Entregabilidade (21/08; números por dia ainda não rodados — §7.1) | — | — |
| 7 ✅ | D6 Métricas (21/08) | — | — |

Depois do e-mail, a mesma pasta recebe: `sdr-ia/` (agente "LOL", incidente do
loop, ausência de teto de respostas), `acessos.md` (contas duplicadas, papéis)
e `cobranca.md` (plano manual). Fora de escopo deste roadmap.

## 9b. Estado em 21/08/2026

Os sete documentos existem. O que ficou marcado `❓` dentro deles depende das
respostas da §10 e das queries de medição (D5 §7.1, D4 §7) — ninguém rodou
ainda. O incidente aberto (cron de enfileiramento) está em `OPERACAO.md` §8 e
`INCIDENTES.md`.

## 10. Perguntas que o código não responde

Para o Natanael, antes dos passos 2, 5 e 6:

1. Qual o tier da conta Resend e o limite de requisições por segundo?
2. De onde veio a lista de 142k importada em 21/08? Houve opt-in? Quando
   essas pessoas ouviram falar dele pela última vez?
3. Já houve bloqueio ou aviso de reputação nessa conta?
4. Qual ritmo ele considera aceitável: 146k em um dia, em uma semana?
5. Quem mais além dele dispara campanha? (Há dois "Natanael" e dois "Marco"
   como owner.)
