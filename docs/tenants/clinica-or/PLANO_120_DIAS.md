---
title: "Plano — regra de 120 dias para Paciente Inativo"
topic: kanban
kind: roadmap
audience: both
status: vigente
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
updated: 2026-08-20
summary: "Trocar os prazos de 7 e 60 dias por 120 dias em ambas as entradas de Paciente Inativo, limpar a coluna de quem não cumpre o critério e ligar as duas regras em segurança. Inclui o defeito de idempotência que faria cada paciente entrar na coluna uma única vez na vida."
related_docs:
  - docs/tenants/clinica-or/auditoria-20-08-2026.md
  - docs/tenants/clinica-or/FLUXO_ALVO.md
code_refs:
  - supabase/functions/automations-tick/index.ts
  - supabase/functions/_shared/pipeline-move.ts
---

# Regra de 120 dias — Paciente Inativo

> ## Execução — 20/08/2026
>
> | Fase | Estado | Resultado |
> |---|---|---|
> | **F0** medir | ✅ 11:05 | `ui_rule_move.enabled = true`, `automations_paused = false`, `run_once = false` nas duas, cooldown 24h. Primeiro tick a 120d moveria **0** cards |
> | **F1** idempotência | ✅ 20/08 | Chave passa a incluir `stage_changed_at` — única por **estadia** na coluna. Deploy do `automations-tick` feito pelo Lovable, patch conferido no repositório (`cea2721c`). Nenhum lead chegou a ser bloqueado antes: nenhuma automação de `move_stage` jamais rodou nesta clínica |
> | **F2** prazos → 2880h | ✅ 11:13 | As duas regras em `hours = 2880`, ainda `enabled = false` |
> | **F3** limpar a coluna | ✅ 11:11 | **26 cards** devolvidos a *Paciente Ativo*. Inativo 469 → 443, Ativo 145 → 171. Backup em `_bkp_20260820_paciente_inativo` (469 linhas) |
> | **F4** ligar as duas | ✅ 20/08 11:24 | As duas `enabled = true` em 2880h. Primeira hora: **zero runs, zero erros** — sem candidato até dezembro, como previsto |
>
> **3 cards ficaram de fora da F3 de propósito** — `Help Elevadores` (fornecedor),
> `Ana Paula MK ART` (interno) e `Ivan` (provável Dr. Ivan). Violam a regra dos 120
> dias mas não são pacientes: o destino certo é *Administrativo* ou
> `is_internal_contact`, não a fila de trabalho.
>
> **Efeito colateral aceito:** a F3 zera `stage_changed_at` dos 26. O relógio deles
> recomeça hoje, então só retornam a *Paciente Inativo* em meados de dezembro, e não
> em outubro (120 dias reais desde o agendamento de junho).

## 1. O que o cliente pediu

> Paciente só pode estar em **Paciente Inativo** com **mais de 120 dias sem agendar
> consulta ou procedimento**. Quem mandar mensagem continua indo para **Paciente
> Ativo**, como já vai hoje.

Traduzido para as duas regras que alimentam a coluna:

| Regra | Hoje | Alvo |
|---|---|---|
| *Paciente Ativo* parado → *Paciente Inativo* | 7 dias (168h) | **120 dias (2880h)** |
| *Consulta / Tratamento Finalizado* parado → *Paciente Inativo* | 60 dias (1440h) | **120 dias (2880h)** |
| Paciente responde → *Paciente Ativo* | imediato | **inalterado** |

---

## 2. "120 dias sem agendar" × "120 dias parado na coluna"

O mecanismo disponível (`stage_idle`) mede **tempo na coluna** — `leads.stage_changed_at`
— e não "tempo desde o último agendamento". Não são a mesma coisa, mas nas duas
entradas **coincidem**, e é importante entender por quê antes de confiar nisso:

- **Saindo de *Paciente Ativo*:** enquanto o card está lá, o paciente **não tem
  agendamento** — preencher a data (ou marcar compromisso) move o card para
  *Consulta/Tratamento agendado* na hora, o que zera o relógio. 120 dias parado ali
  são 120 dias sem agendar.
- **Saindo de *Finalizada*:** o card entra na coluna quando o compromisso é
  realizado. 120 dias parado ali são 120 dias desde a última consulta, sem nenhuma
  nova marcação — pelo mesmo motivo.

**A invariante se sustenta:** todo caminho automático para *Paciente Inativo* exige
120 dias numa coluna onde, por construção, não existe agendamento.

**A única brecha é humana:** a secretária pode arrastar um card para *Paciente
Inativo* a qualquer momento. Nenhuma regra impede — e nem deveria. Fica registrado
como exceção conhecida, não como defeito.

---

## 3. A cadeia inteira, do relógio ao card

Cada elo abaixo pode matar a regra em silêncio. Estados medidos em 20/08 11:05;
só o elo 8 continua **quebrado**.

| # | Elo | O que faz | Estado |
|---|---|---|---|
| 1 | `pg_cron` → `automations-tick` | roda a cada 5 min (comentário do código) | ❓ cron nunca verificado |
| 2 | `automations.enabled` | as duas regras seguem **desligadas** até a F1 | ❌ off |
| 3 | `clinics.settings.automations_paused` | kill-switch por clínica; se `true`, o tick pula tudo | ✅ `false` |
| 4 | `findCandidates('stage_idle')` | `stage_changed_at <= now() - hours`, **limite de 50 leads por automação por tick** | ✅ |
| 5 | `recentlyRan` | cooldown de 24h nas duas; `run_once = false` | ✅ |
| 6 | `runAction('move_stage')` → `pipelineMove` | `source: auto:automation-rule` | ✅ |
| 7 | G3 — toggle `automation.ui_rule_move.enabled` | **se não for `true`, nenhum move acontece** | ✅ `true` |
| 8 | **G4 — idempotência** | chave `automation:{id}:{lead}:{stage}` — **permanente** | 🔴 **defeito, ver §4** |
| 9 | Filtro `ai_target_pipeline_ids` | corrigido hoje (20/08) | ✅ |
| 10 | G9 travessia | ambas as colunas vivem no mesmo funil — não se aplica | ✅ |
| 11 | G2 `lock_auto_move` | nenhuma coluna marcada | ✅ inerte |
| 12 | Guard D3 | morto pelo rename de 13/08 | ✅ inerte |
| 13 | `auto_tag_on_enter` de *Paciente Inativo* | aplica `paciente_antigo` e `segmento_paciente_antigo` → alimenta segmento de e-mail | ⚠️ ver §8 |
| 14 | `stage_sequence_bindings` de *Paciente Inativo* | sequência de reengajamento, **desligada** | ✅ off |
| 15 | `pg_net` | entrega das chamadas internas — **perdeu 12 de 134 hoje, sem rastro** | ⚠️ |

---

## 4. 🔴 O defeito que precisa ser corrigido antes de ligar

`automations-tick` monta a chave de idempotência como
`automation:{automation_id}:{lead_id}:{stage_id}`
([automations-tick/index.ts:410](../../../supabase/functions/automations-tick/index.ts)),
e o gate G4 procura essa chave em `lead_events` **sem nenhuma janela de tempo**
([pipeline-move.ts:117](../../../supabase/functions/_shared/pipeline-move.ts)).

Consequência: **cada automação consegue mover um lead para uma coluna uma única vez
na vida.** Na segunda vez, `pipelineMove` devolve `idempotent:automation:…` e o card
fica parado.

Isso é fatal para uma regra de ciclo de vida. O paciente vai passar por
*Paciente Inativo* → *Paciente Ativo* → agenda → *Finalizada* → *Paciente Inativo*
várias vezes ao longo dos anos. **Da segunda volta em diante, ele nunca mais entra
na coluna** — e o sintoma seria idêntico ao de hoje: cards parados sem explicação.

Com 7 dias o defeito já existia; ninguém viu porque as regras estavam desligadas.
Com 120 dias, ele só apareceria daqui a quatro meses.

**Correção:** incluir a estadia atual na chave, para que ela seja única por passagem.
`runAction` recebe apenas `leadId`, então o campo precisa ser buscado dentro do
próprio bloco `move_stage` — uma leitura a mais só quando há movimento de verdade:

```ts
if (a.action_type === "move_stage") {
  const stageId = a.action_config?.stage_id;
  if (!stageId) return { ok: false, detail: "missing stage_id" };

  // Idempotência por ESTADIA, não por par lead+coluna: sem isto a chave é
  // permanente e cada lead entra numa coluna uma única vez na vida.
  const { data: leadRow } = await supabase
    .from("leads").select("stage_changed_at").eq("id", leadId).maybeSingle();
  const estadia = leadRow?.stage_changed_at ?? "";

  const moveRes = await pipelineMove(supabase, {
    // ...
    idempotencyKey: `automation:${a.id}:${leadId}:${stageId}:${estadia}`,
```

`stage_changed_at` muda a cada entrada em coluna nova, então dois ciclos do mesmo
paciente nunca colidem. O `?? ""` mantém o comportamento atual quando o campo for
nulo. Dentro da mesma estadia a chave continua idêntica — a proteção contra
repetição no mesmo tick permanece intacta.

> **Deploy:** é mudança de edge function — vai pelo agente do Lovable.

---

## 5. Fase 0 — medir antes de tocar em qualquer coisa

Nada abaixo é conhecido hoje. Sem esses números, ligar as regras é apostar.

```sql
select jsonb_pretty(jsonb_build_object(
  'pausa_global', (select c.settings->'automations_paused'
      from clinics c where c.id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'),
  'toggle_move_ui', (select value from app_settings
      where key = 'automation.ui_rule_move.enabled'),
  'as_duas_regras', (select jsonb_agg(jsonb_build_object(
        'nome', a.name, 'ligada', a.enabled, 'gatilho', a.trigger_type,
        'config', a.trigger_config, 'acao', a.action_config,
        'cooldown_h', a.cooldown_hours, 'run_once', a.run_once))
      from automations a
     where a.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
       and a.action_type = 'move_stage'),
  'entrariam_no_1o_tick', jsonb_build_object(
     'de_paciente_ativo', (select count(*) from leads l
        where l.stage_id = '6f492197-9eeb-438d-a940-bd1d7e0224e4'
          and l.archived_at is null
          and l.stage_changed_at <= now() - interval '120 days'),
     'de_consulta_finalizada', (select count(*) from leads l
        where l.stage_id = '7584241f-6e4b-4824-aaea-e271e865227d'
          and l.archived_at is null
          and l.stage_changed_at <= now() - interval '120 days'),
     'de_tratamento_finalizado', (select count(*) from leads l
        where l.stage_id = '2a352661-01e2-41f8-be10-032f803e2387'
          and l.archived_at is null
          and l.stage_changed_at <= now() - interval '120 days')),
  'inativo_quem_nao_cumpre_120d', (select jsonb_build_object(
        'total_na_coluna', count(*),
        'com_agendamento_120d_qualquer_status', count(*) filter (where ult_qualquer > now() - interval '120 days'),
        'com_agendamento_120d_agendado_ou_realizado', count(*) filter (where ult_valido > now() - interval '120 days'),
        'sem_agendamento_nenhum', count(*) filter (where ult_qualquer is null))
      from (
        select l.id,
               (select max(ap.scheduled_at) from appointments ap
                 where ap.lead_id = l.id and ap.kind in ('consulta','procedimento')) as ult_qualquer,
               (select max(ap.scheduled_at) from appointments ap
                 where ap.lead_id = l.id and ap.kind in ('consulta','procedimento')
                   and ap.status in ('agendado','realizado')) as ult_valido
          from leads l
         where l.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
           and l.stage_id = '7fea97d7-c2af-4e6f-8f39-af8375bb4468'
           and l.archived_at is null
           and coalesce(l.is_internal_contact,false) = false) s),
  'tags_de_entrada', (select jsonb_agg(jsonb_build_object(
        'coluna', s.name, 'tags', s.auto_tag_on_enter))
      from pipeline_stages s
     where s.id in ('7fea97d7-c2af-4e6f-8f39-af8375bb4468',
                    '6f492197-9eeb-438d-a940-bd1d7e0224e4')),
  'segmentos_paciente_antigo', (select jsonb_agg(jsonb_build_object(
        'nome', g.name, 'ativo', g.active, 'sistema', g.is_system, 'filtros', g.filters))
      from email_segments g
     where g.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
       and g.filters::text ilike '%segmento_paciente_antigo%')
)) as raio_x;
```

**Decisão que o resultado destrava:** contar como "agendou" qualquer compromisso, ou
só os `agendado`/`realizado`? Cancelado e faltou também foram tentativa de marcar —
paciente que cancelou há 30 dias não é um inativo de 120. **Recomendação:** contar
qualquer status; a query mede os dois para a diferença ficar visível.

---

## 6. Fase 1 — corrigir a idempotência (§4)

**Antes de qualquer outra coisa.** Se as regras forem ligadas com a chave atual, os
primeiros movimentos gravam chaves permanentes e cada lead movido fica queimado para
aquela automação **para sempre** — inclusive os que forem movidos na Fase 3.

**Critério de pronto:** mover um lead de mesa duas vezes pela mesma automação, com
uma saída no meio, e as duas passarem.

---

## 7. Fase 2 — reconfigurar os prazos, ainda desligadas

Pela tela de Automações (recomendado — é o caminho que o cliente usa) ou por SQL:

```sql
update automations
   set trigger_config = jsonb_set(trigger_config, '{hours}', '2880'::jsonb)
 where clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
   and action_type = 'move_stage'
   and trigger_type = 'stage_idle'
   and (action_config->>'stage_id')::uuid = '7fea97d7-c2af-4e6f-8f39-af8375bb4468'
returning name, enabled, trigger_config;
```

Confirmar no retorno que **as duas** linhas saíram com `hours = 2880` e `enabled = false`.

> ⚠️ Conferir também `cooldown_hours` e `run_once` no resultado da Fase 0. Se
> `run_once = true` em alguma delas, **desligar**: com "uma vez para sempre" o
> paciente entraria em *Paciente Inativo* uma única vez na vida — o mesmo defeito da
> §4 por outro caminho.

---

## 8. Fase 3 — limpar a coluna

Hoje há **469 cards** em *Paciente Inativo*, e a maioria chegou lá por critérios
antigos (60 dias, sweep mensal, ou a fusão de *Nutrição Antigos* no Bloco B). Quem
agendou nos últimos 120 dias não pode continuar ali.

**Não usar `stage_changed_at` como critério de limpeza.** 422 daqueles cards
entraram na coluna em 13/08 pela migração do Bloco B — por esse relógio, todos
teriam "7 dias de coluna" e sairiam em massa.

**Nem usar `appointments`: a tabela está vazia neste tenant** (medido em 20/08).
O registro durável de "agendou" é o `lead_stage_history` — toda entrada em
*Consulta agendada* ou *Tratamento agendado* fica gravada e sobrevive ao apagamento
da data no card.

**Medição de 20/08 11:05, sobre os 463 da coluna:**

| Grupo | Qtd | Destino |
|---|---|---|
| Agendou **há menos de 120 dias** | **22** | 🔴 violam a regra → *Paciente Ativo* |
| Agendou há mais de 120 dias | 0 | ficam |
| **Nunca agendou** | 441 | ficam (cumprem por definição) |
| ↳ dos quais, nunca falaram também | 335 | ficam — mas são **lead frio, não paciente** |
| Com data ainda preenchida no card | 24 | 🔴 conferir: data futura = agendamento vivo |

> ⚠️ **A coluna mistura duas populações.** 422 dos 463 vieram de *Nutrição Antigos*
> na fusão do Bloco B — geladeira de **lead**, não de paciente — e 335 nunca
> agendaram nem mandaram uma mensagem. Não viola a regra dos 120 dias, mas
> *"Paciente Inativo"* com 72% de lead frio que nunca foi paciente é decisão de
> produto em aberto, não defeito.

**Destino:** *Paciente Ativo* — é a fila de trabalho do funil, e é para onde a regra
de reativação já manda todo mundo.

```sql
begin;

create table if not exists public._bkp_20260820_paciente_inativo as
select id, clinic_id, stage_id, pipeline_id, stage_changed_at, now() as snapshot_at
from public.leads
where clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  and stage_id  = '7fea97d7-c2af-4e6f-8f39-af8375bb4468';

update public.leads l
   set stage_id = '6f492197-9eeb-438d-a940-bd1d7e0224e4'
 where l.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
   and l.stage_id  = '7fea97d7-c2af-4e6f-8f39-af8375bb4468'
   and l.archived_at is null
   and coalesce(l.is_internal_contact,false) = false
   and (
     -- agendou nos últimos 120 dias, pelo histórico de colunas
     exists (select 1 from public.lead_stage_history h
              where h.lead_id = l.id
                and h.to_stage_id in ('e12f004a-6445-4815-8d6b-22f928507a9a',
                                      '98320189-6002-4f75-b99d-0b407189efe8')
                and h.moved_at > now() - interval '120 days')
     -- ou tem data de agendamento ainda preenchida no card
     or l.custom_fields ? 'consulta_agendada_em'
     or l.custom_fields ? 'procedimento_agendado_em'
   );

-- confira o número antes de confirmar
commit;
```

**Por que `UPDATE` direto e não a fila de automação:** não existe regra que faça
*Inativo → Ativo* por tempo, e a fila `pg_net` perdeu 12 de 134 chamadas hoje sem
deixar rastro. O `UPDATE` é síncrono e verificável. Os dois funis são o mesmo, então
`pipeline_id` não muda e o trigger de coerência não reclama.

**O que os triggers fazem sozinhos:** gravam `lead_stage_history` (source `system`),
aplicam `auto_tag_on_enter` de *Paciente Ativo* e avaliam vínculos de sequência —
**nenhuma sequência está vinculada a *Paciente Ativo***, então não sai mensagem.
Confirmar as duas coisas no resultado da Fase 0 antes de rodar.

**O que não é limpo:** as tags `paciente_antigo` e `segmento_paciente_antigo` ficam
no lead — nada as remove hoje. Quem sair da coluna continua marcado, e continua
dentro do segmento de e-mail correspondente. Se houver campanha usando esse
segmento (Fase 0 mede), limpar as tags no mesmo `UPDATE`.

---

## 9. Fase 4 — ligar, uma de cada vez

**Ordem:** primeiro a de *Finalizada 120d*, depois a de *Paciente Ativo 120d*.
A primeira tem volume previsível (cards antigos parados nas colunas de finalizadas);
a segunda quase não tem candidato hoje, porque 134 dos 145 cards de *Paciente Ativo*
entraram em 20/08 — o primeiro candidato natural aparece só em dezembro.

O tick processa **50 leads por automação por vez**, a cada 5 minutos: no pior caso
600 cards/hora. Não existe blast instantâneo, mas dá para acompanhar.

**Depois do primeiro tick de cada uma:**

```sql
select a.name,
       r.status,
       count(*) as qtd,
       max(r.created_at) as ultimo,
       (array_agg(r.detail order by r.created_at desc))[1] as ultimo_detalhe
  from automation_runs r
  join automations a on a.id = r.automation_id
 where r.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
   and r.created_at > now() - interval '1 hour'
 group by a.name, r.status
 order by a.name, r.status;
```

`status = error` com `detail` começando em `idempotent:` significa que a Fase 1 não
foi aplicada. `gate_g3_disabled` significa que o toggle da linha 7 da §3 está `false`.

---

## 10. Fase 5 — guarda opcional contra agendamento futuro

Cinto de segurança: um paciente com consulta marcada não pode cair em *Paciente
Inativo* nem por acidente. O `stage_idle` aceita `condition` sobre um custom field:

```json
{ "hours": 2880, "stage_ids": ["..."], "condition": { "field_key": "consulta_agendada_em", "op": "empty" } }
```

Vale só se o campo estiver confiável — ele é **apagado** ao entrar em *Consulta
finalizada* (wipe do `pipelineMove`), então em *Finalizada* ele está sempre vazio e
a condição não muda nada ali. Em *Paciente Ativo* ele deveria estar vazio por
construção. **Sugestão:** medir antes quantos cards em cada coluna têm o campo
preenchido; se for zero, a guarda é decorativa e pode ficar de fora.

---

## 11. Ordem final e verificação

| # | Fase | Onde | Reversível |
|---|---|---|---|
| 1 | **F0** medir | SQL Editor | — |
| 2 | **F1** corrigir idempotência | edge (Lovable) | sim, é código |
| 3 | **F2** prazos → 2880h, ainda off | UI ou SQL | sim |
| 4 | **F3** limpar a coluna | SQL em transação | sim, via `_bkp_20260820_paciente_inativo` |
| 5 | **F4** ligar *Finalizada 120d* | UI | sim, desligar |
| 6 | **F4** ligar *Paciente Ativo 120d* | UI | sim, desligar |
| 7 | **F5** guarda opcional | UI | sim |

**Rollback da F3:**

```sql
update public.leads l
   set stage_id = b.stage_id
  from public._bkp_20260820_paciente_inativo b
 where b.id = l.id and l.stage_id <> b.stage_id;
```

**Invariante para conferir depois de tudo** — tem de voltar zero:

```sql
select count(*) as violacoes
  from leads l
 where l.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
   and l.stage_id = '7fea97d7-c2af-4e6f-8f39-af8375bb4468'
   and l.archived_at is null
   and exists (select 1 from appointments ap
                where ap.lead_id = l.id
                  and ap.kind in ('consulta','procedimento')
                  and ap.scheduled_at > now() - interval '120 days');
```

---

## 12. Quando ligar (decidido em 20/08)

Com 2880h **não existe candidato nenhum hoje**: os 26 devolvidos pela F3 vencem em
meados de dezembro e as colunas de finalizadas estão zeradas nesse critério. Ligar
agora ou em novembro dá no mesmo — **mas a F1 tem de estar no ar antes do primeiro
movimento**, ou o paciente movido queima a chave de idempotência para sempre.

**Ordem escolhida:** F1 (edge, via Lovable) → F4 (ligar as duas pela tela).

Enquanto isso, *Paciente Inativo* só esvazia: quem responde sai, ninguém entra.

---

## 13. Pendências que sobraram

**3 cards não-pacientes em *Paciente Inativo*** — `Help Elevadores`,
`Ana Paula MK ART` e `Ivan`. Violam os 120 dias mas não são pacientes: o destino é
*Administrativo* ou `is_internal_contact`.

**Nomes das automações** — renomeadas em 20/08 para refletir 120 dias e o rótulo
*Paciente Ativo*; os nomes antigos diziam "7d"/"60d" e "Reagendamento".

**`ÓR — Sem Resposta 7d → Nutrição Inativa`** — ligada e nunca disparou

`ÓR — Sem Resposta 7d → Nutrição Inativa` está **ligada** no funil de Vendas e
**nunca disparou** — não tem uma linha em `automation_runs`, enquanto os follow-ups
#1 e #2, que rodam na mesma coluna, somam 35 execuções. Ou nenhum lead completa 7
dias em *Sem resposta*, ou a regra está barrada por algum motivo ainda não medido.
Fora do escopo dos 120 dias; anotado para a próxima rodada.

---

## 14. Riscos

**O toggle `automation.ui_rule_move.enabled`.** Nunca foi lido. Se estiver `false`,
tudo acima roda e nada move — e o sintoma é silêncio, igual ao filtro de pipeline de
hoje de manhã. É a primeira coisa que a F0 mede.

**Volume em *Paciente Ativo*.** A F3 devolve para a fila de trabalho todo mundo que
agendou nos últimos 120 dias. Se o número da F0 for alto, é decisão do cliente: ou a
secretária trabalha a fila, ou o critério de limpeza aperta (por exemplo, 60 dias em
vez de 120 só para a limpeza inicial).

**Tags que não se limpam.** Quem sai de *Paciente Inativo* continua com
`paciente_antigo` e dentro do segmento de e-mail. Não afeta o Kanban; afeta campanha.

**`pg_net` perdendo chamada.** Vale para os gatilhos por mensagem, não para o tick —
o `automations-tick` chama `pipelineMove` no próprio processo. A F3 é `UPDATE`
direto. Nenhuma das duas depende de entrega assíncrona.
