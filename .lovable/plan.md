# Relatório diário no grupo do WhatsApp

Sim, dá pra fazer. Vou criar um sistema novo de "Relatórios agendados" (separado das Automações de lead, porque elas atuam sobre 1 lead — aqui o destinatário é um grupo). Você cadastra: instância WhatsApp + grupo + horário + métricas. Todo dia, no horário escolhido, o sistema dispara a mensagem.

## O que entra no relatório (período: hoje, fuso da clínica)

- Visitantes únicos
- Cliques no WhatsApp (botões/links rastreados pelo tracker, incluindo `wa-redirect`)
- Leads novos via formulário (`form_source` começando com `form:`)
- Leads novos via WhatsApp (`form_source = 'whatsapp'`)

Formato da mensagem (ajustável depois):
```text
📊 Relatório do dia — 26/05
👀 Visitantes únicos: 342
💬 Cliques no WhatsApp: 47
📝 Leads (formulário): 8
📱 Leads (WhatsApp): 12
```

## Onde fica na interface

Nova aba/página **"Relatórios agendados"** (sugiro em `Automações → Relatórios`, ou item próprio na sidebar). Lista com:
- Nome
- Instância WhatsApp (dropdown das já existentes)
- Grupo de destino (botão **"Buscar grupos"** consulta a Evolution e mostra os grupos da instância; também aceita colar o JID manualmente, ex.: `12036xxxxxx@g.us`)
- Horário (ex.: 20:00) + fuso (default America/Sao_Paulo)
- Dias da semana (default: todos)
- Quais métricas incluir (checkboxes)
- Ativar/Pausar
- Botão **"Enviar agora"** (teste)
- Histórico das últimas execuções

## Detalhes técnicos

**Nova tabela** `scheduled_reports` (clinic_id, name, instance_id, group_jid, send_time, tz, weekdays[], metrics jsonb, enabled, last_sent_at, last_status, last_error) + `scheduled_report_runs` para histórico. RLS por `clinic_id`.

**Nova edge function** `scheduled-report-tick`:
- Roda a cada minuto via `pg_cron` (já temos pg_cron/pg_net configurados).
- Lê `scheduled_reports` enabled, calcula a hora local de cada um pelo `tz`, compara com `send_time` e `weekdays`, e ignora se `last_sent_at` já é de hoje.
- Para cada elegível: roda as queries de métricas e envia via Evolution `/message/sendText/{instance}` usando `number = group_jid` (a API aceita JID de grupo nesse mesmo endpoint).
- Grava `scheduled_report_runs` com status/preview do texto.

**Nova edge function** `evolution-fetch-groups` (autenticada): chama `/group/fetchAllGroups/{instance}?getParticipants=false` e devolve `[{id, subject}]` para popular o seletor no painel.

**Queries das métricas** (escopo `clinic_id` + janela do dia local convertida para UTC):
- Visitantes únicos: `count(distinct visitor_id) FROM tracking_events WHERE clinic_id=$1 AND created_at >= $2`
- Cliques no WhatsApp: `tracking_events` com `event='click'` e `properties->>'kind' IN ('whatsapp','wa')` **ou** `url ILIKE '%wa.me%'`, **mais** acessos ao endpoint `wa-redirect` (já contabilizados como evento) — uso a união por `visitor_id`.
- Leads form / Leads WhatsApp: `count(*) FROM leads WHERE clinic_id=$1 AND created_at >= $2 AND form_source ...`

**Envio para grupo:** Evolution aceita JID de grupo no campo `number` do `sendText`. Se preferir, posso criar um helper `evoSendToJid(instance, jid, text)` em `_shared/evolution.ts` para reuso.

**Sem novas secrets:** usa Evolution API já configurada por instância e o LOVABLE/Supabase service role já presentes.

## Fora de escopo desta primeira versão

- Gráficos/imagens no relatório (só texto).
- Comparativo com dia anterior / semana (pode ser próximo passo).
- Múltiplos grupos por relatório (crie 1 relatório por grupo).

Se aprovar, eu sigo: migration → edge functions → cron → tela de gestão.
