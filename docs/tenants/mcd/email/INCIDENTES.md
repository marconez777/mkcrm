---
title: "E-mail do MCD — Incidentes (D7)"
topic: email
kind: log
audience: both
status: vivo
updated: 2026-08-21
summary: "Linha do tempo do que já quebrou no e-mail do MCD, do ponto de vista de quem opera: sintoma, causa, correção e o que ficou. Inclui os diagnósticos errados e suas retratações — eles custaram tanto quanto os bugs."
tenant: mcd
clinic_id: 3c48b379-f084-478d-a51c-9daa41ad661a
related_docs:
  - docs/tenants/mcd/email/README.md
  - docs/tenants/mcd/email/OPERACAO.md
  - docs/roadmap/EMAIL_ESCALA.md
---

# E-mail do MCD — Incidentes

Formato fixo: **data · sintoma · causa · correção · o que ficou**. Entradas
mais recentes primeiro. O detalhe técnico de cada gargalo está em
[`docs/roadmap/EMAIL_ESCALA.md`](../../../roadmap/EMAIL_ESCALA.md) (códigos
G-xx); aqui é a visão de quem estava na tela.

---

## 2026-08-21 · Campanha "Aula" presa em "enviando" — ABERTO

**Sintoma.** Disparo real para ~146k. Status "enviando", diálogo Ao vivo em
0/0 por mais de 4 minutos. Pausada manualmente.

**Causa.** O enfileiramento passou a ser feito por um cron (`enqueue-pending-
campaigns`, job 58, a cada minuto) e **ele não executou**: campanha no estado
exato que ele procura (`sending`, `sent_at` nulo, fila vazia), sem erro
gravado, nenhuma query de enfileiramento em `pg_stat_activity`. O job está
ativo, no mesmo banco e usuário do `process-email-queue`, que funciona. Causa
raiz **não identificada** — a consulta a `cron.job_run_details` falhou no
editor.

**Correção.** Nenhuma ainda. Saída de emergência documentada em
[`OPERACAO.md` §5](./OPERACAO.md). Proposta: mover a checagem para dentro do
`process-email-queue`.

**O que ficou.** A campanha pausada com 0 destinatários volta para
**rascunho** ao retomar (regra do `resume`); precisa ser disparada de novo.
Nenhum e-mail saiu.

---

## 2026-08-21 · Campanha "teste" falhou com `forbidden` — resolvido

**Sintoma.** Teste com segmento vazio ("Leads Site") foi para "falhou".

**Causa.** `resolve_email_segment` exige contexto de serviço ou usuário com
acesso. O cron não tem nenhum dos dois → `forbidden`. Campanhas "Todos" nunca
tinham passado por isso porque não chamam o resolvedor.

**Correção.** `enqueue_campaign_recipients` declara o contexto de serviço via
`set_config(..., true)` antes de resolver o segmento.

**O que ficou.** Bom exemplo do que o teste com 0 contatos serve: achou um bug
real sem enviar um e-mail. Segundo teste passou: `sent`, 0 destinatários.

---

## 2026-08-21 · Enfileiramento síncrono estourou o teto de 8 s — resolvido

**Sintoma.** Primeira versão do disparo novo: campanha "teste" (ainda apontando
para o Desafio, 146k) foi para "falhou" com `canceling statement due to
statement timeout`.

**Causa.** Descoberta importante: o limite de 8 s vale para **toda** chamada
via PostgREST, inclusive as feitas por edge function com `service_role` — o
`statement_timeout` vem do papel `authenticator`, que abre a conexão, e trocar
de papel não reseta. Enfileirar 146k numa chamada nunca caberia.

**Correção.** Enfileiramento movido para `pg_cron` (que não tem o teto). O
`dispatch-campaign` só marca `sending` e devolve 202. → gerou o incidente
aberto acima.

---

## 2026-08-21 · Prévia de destinatários com "erro" — resolvido

**Sintoma.** No modal de campanha com "Todos os leads", o card Destinatários
mostrava "erro: canceling statement due to statement timeout".

**Causa.** Contar 162.874 e-mails distintos leva 8,6 s **mesmo com índice**
dedicado (compute mínimo). Não cabe nos 8 s.

**Correção.** Contagens passaram a ser pré-calculadas em
`email_audience_counts` a cada 10 min (cron `refresh-email-audience-counts`).
A prévia e a tela de Segmentos leem o número pronto.

**O que ficou.** Os números têm até 10 min de defasagem. Com mais de um
segmento selecionado, o total é **soma** (conta duas vezes quem está em dois).

---

## 2026-08-21 · Diagnóstico errado: "campanhas foram para 12% da lista" — retratado

**Sintoma (aparente).** Segmento Desafio com 146.683 contatos; campanhas
marcadas `sent` com 17.020 e 4.504 destinatários. Concluí que o disparo
truncava em silêncio e que ~130 mil pessoas não tinham recebido.

**O que estava errado.** Comparei o público de **hoje** com campanhas enviadas
**antes** da importação dos 142k (que entraram em 21/08). Os 17.020 e 4.504
eram o público da época. O usuário apontou: "as que deram erro são as zeradas".

**O que ficou.** O `break` silencioso no `dispatch-campaign` **existia** e foi
removido — mas não havia incidente a remediar. Lição registrada no roadmap de
escala: evidência antes de conclusão; a Fase 0 existe para isso.

---

## 2026-08-21 · Campanhas em rascunho com 0/0 após tentativa de envio — sem conclusão

**Sintoma.** O Natanael tentou disparar ("ESTAMOS AO VIVO", "CONVITE AULA
ZOOM") e as campanhas ficaram em rascunho, sem erro gravado.

**Causa.** Rascunho + erro vazio significa que a falha aconteceu **antes** de
o disparo começar (a função marca `sending` logo no início). Permissão foi
descartada (ele é owner); template foi descartado (todos ativos). Restam:
sessão expirada, função sem responder, chamada que não saiu. A mensagem só
apareceu no toast da tela e ninguém guardou.

**O que ficou.** Pergunta aberta ao Natanael: qual mensagem apareceu. Os logs
da edge `dispatch-campaign` daquele horário também respondem.

---

## 2026-08-21 · Tela de Campanhas mostrava "1–6 de 6" com tabela vazia — resolvido

**Sintoma.** Contador certo, nenhuma linha.

**Causa.** Depois de contar as campanhas, a tela baixava **todas** as linhas de
`email_logs` e `email_queue` das campanhas para recalcular enviados — centenas
de milhares de linhas sob policy por linha → timeout → a função abortava antes
de renderizar.

**Correção.** RPC `campaign_send_counts` conta no servidor; a lista renderiza
antes e só enriquece depois, com aviso em vez de sumir.

---

## 2026-08-21 · Tela de Contatos não carregava (500) — resolvido

**Sintoma.** Spinner infinito; no console, `HEAD …/email_segment_contacts`
devolvendo 500.

**Causa.** A policy RLS da tabela chamava duas funções `SECURITY DEFINER`
**por linha**; com 162.874 linhas, o `count(*)` passava dos 8 s.

**Correção.** Policy reescrita na forma InitPlan (`clinic_id = ANY ((SELECT
accessible_clinic_ids(...))::uuid[])`, avaliada uma vez por query). Mesma
regra de acesso. Replicada depois para `email_logs`, `email_queue` e as demais.

**O que ficou.** A tela ainda baixa a lista inteira para o navegador (teto
subiu de 100k para 300k). Funciona, mas é o limite do desenho; paginação no
servidor é item aberto (F3.3).

---

## 2026-08-20 · Campanha "convite dia 20 - ZAP" sem eventos de entrega — explicado

**Sintoma.** 16.778 enviados, mas quase nenhum `delivered`/`opened` nos logs.

**Causa.** O secret do webhook da conta Resend do MCD foi cadastrado
**depois** da campanha. Eventos com assinatura desconhecida recebem 401 e
**não são registrados em lugar nenhum**.

**Correção.** Secret cadastrado (pelo usuário). Eventos chegam desde então —
8.623 na semana seguinte, incluindo `delivered`.

**O que ficou.** O buraco no histórico dessa campanha é permanente. E o
sistema continua sem registrar rejeições de webhook (G-31).

---

## 2026-08-21 · Descadastro removido apagava em todos os tenants — resolvido

**Sintoma.** Nenhum visível — era silencioso.

**Causa.** A tela de Descadastros apagava por `email` sem `clinic_id`. Como o
super admin enxerga todas as clínicas, remover um descadastro no MCD reabria
o e-mail em **todas** as outras.

**Correção.** O delete passou a usar o par `(clinic_id, email)`.

**O que ficou.** Não há como saber se aconteceu antes — não existe log de
remoção de descadastro.
