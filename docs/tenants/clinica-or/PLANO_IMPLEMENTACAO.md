---
title: "Plano de implementação do fluxo alvo — Clínica ÓR"
topic: kanban
kind: roadmap
audience: both
status: planejado
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
updated: 2026-08-12
summary: "Plano em 7 etapas para implementar o fluxo de dois pipelines, com dependências, ordem obrigatória e riscos. Baseado em levantamento de banco de 12/08/2026: 1914 leads, 70% em geladeira, dois sweeps mensais ativos no mesmo horário, sequências prontas mas desligadas."
related_docs:
  - docs/tenants/clinica-or/FLUXO_ALVO.md
  - docs/tenants/clinica-or/FLUXO_REAL.md
  - docs/_audit/MAPA_CODIGO_PIPELINE.md
code_refs:
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/pipeline-classify/apply.ts
---

# Plano de implementação — Clínica ÓR

**Alvo:** [FLUXO_ALVO.md](FLUXO_ALVO.md) · **Levantamento de banco:** 12/08/2026

---

## 1. O que o levantamento mudou

### 1.1 ✅ Multi-pipeline já está em uso

A clínica **já tem 3 pipelines**, não um:

| Pipeline | Colunas | Default |
|---|---|---|
| Clínica ÓR | 12 | ✅ |
| Medicos Parceiros | 5 | |
| Formulário Site | 1 | `is_system` |

Criar o P2 não é território novo. **Mas atenção:** `is_default` está na ÓR, e é para
o pipeline default que lead novo vai. **O P1 (Vendas) precisa herdar o default.**

### 1.2 A cadência do P1 está pronta; a do P2 não existe

Levantamento de 12/08 — três sequências, três vínculos, **todos os vínculos com
`enabled = false`**:

| Sequência | Passos | `enabled` | Vínculo | Serve para |
|---|---|---|---|---|
| **ÓR — Nutrição Leads** | **4** | ✅ true | Nutrição Inativa | **P1 · pronta** |
| ÓR — Reativação Paciente Antigo | **1** | false | Paciente antigo | P2 · incompleta |
| ÓR — Nutrição Antigos | **0** | false | Nutrição Antigos | P2 · vazia |

Todas com `stop_on_reply = true` e `cooldown_days = 30` — comportamento correto.

**P1:** a cadência de *Nutrição Inativa* está escrita, com 4 passos, e a sequência
já está ligada. **Falta apenas ligar o vínculo.** Um booleano.

**P2:** as duas sequências de paciente somam **1 passo**. Como as colunas
*Paciente antigo* e *Nutrição Antigos* fundem em *Paciente Inativo*, as duas
sequências também precisam fundir — e o conteúdo precisa ser escrito. Ver §5 item 7.

### 1.2b Quando o lead é inscrito — importa para a migração

`trg_enroll_on_stage_change` dispara em **`AFTER INSERT OR UPDATE OF stage_id`**.
Inscrição acontece só na **mudança** de coluna.

| Situação | Efeito |
|---|---|
| Ligar o vínculo hoje | Os **931 leads** já parados em Nutrição Inativa **não** são inscritos — só quem entrar depois ✅ |
| Migrar 415 leads → Paciente Inativo | **Todos os 415 seriam inscritos de uma vez** 🔴 |

Confirma a ordem: **migrar com os vínculos desligados**, ligar depois.

> ⚠️ Existem **duas** vias de inscrição: o trigger SQL e o hook `applyStageBindings`
> dentro do `pipelineMove`. O hook confere se já existe inscrição ativa antes de
> inserir, mas **não há restrição de unicidade no banco** — mesmo padrão de
> duplicação de `lead_stage_history`. Vale unificar.

### 1.3 ✅ Os DOIS sweeps mensais estão ativos, no mesmo minuto — RESOLVIDO 13/08

```
pipeline-monthly-cycle-or-day1          0 3 1 * *   ATIVO    → não existe mais
pipeline-monthly-sweep-paciente-antigo  0 3 1 * *   ATIVO    → não existe mais
```

Ambos moviam para *Paciente antigo* no dia 1º às 03:00. O primeiro estava gateado
por `automation.or_monthly_cycle.enabled`, que **não existia no banco** — rodava e
não fazia nada, mas continuava agendado.

Estado em 13/08 18:51: o inventário de `cron.job` não traz nenhum dos dois. Ver
Etapa 7, item 29.

### 1.4 A distribuição real dos 1914 leads

| Coluna | Leads | % |
|---|---|---|
| Nutrição Inativa | **931** | 48,6% |
| Nutrição Antigos | **415** | 21,7% |
| **B2B / Stakeholders** | **280** | **14,6%** |
| Paciente antigo | 195 | 10,2% |
| Sem resposta | 29 | 1,5% |
| Qualificação | 23 | 1,2% |
| Desqualificado | 16 | 0,8% |
| Consulta agendada | 10 | |
| Tratamento agendado · Tratamento Ativo | 6 · 6 | |
| Consulta finalizada | 3 | |
| Leads de entrada | **0** | |

**70% do funil está em geladeira.** O funil ativo — Qualificação até finalizados —
tem **48 cards de 1914 (2,5%)**.

Divisão da migração: **635 leads vão para o P2**, 1279 ficam no P1.

---

## 2. 🔴 Achado novo — D15: o campo de retorno não move nada

A clínica tem **3 tipos de compromisso ativos**: `consulta`, `procedimento` e
**`retorno`**.

Pela convenção de campo virtual ([`ContextRail.tsx:100`](../../../src/components/inbox/ContextRail.tsx)),
isso gera três campos de data na tela — incluindo **`retorno_agendado_em`**.

**Nenhuma linha de código conhece esse campo.** Busca em `supabase/functions/` e
`src/`: zero ocorrências.

Consequência: **a secretária preenche a data de retorno e nada acontece.** O card
não move. Só funciona se ela criar o compromisso pela agenda, porque aí
`ruleAppointmentSync` mapeia `kind='retorno'` → *Consulta agendada*.

### ✅ Decidido: desativar o tipo — e é trivial

Levantamento de 12/08:

| Medida | Valor |
|---|---|
| Compromissos com `kind = 'retorno'` | **0** |
| Retornos futuros agendados | **0** |
| Leads com o campo `retorno_agendado_em` | **2** |

**Nenhum compromisso de retorno existe.** Desativar o tipo não afeta nada — não há
migração a fazer. Os 2 leads têm o campo com valor nulo, escrito pelo laço do
`recompute_lead_appointment_summary`, que grava a chave mesmo sem compromisso.

Execução: `UPDATE clinic_appointment_types SET is_active = false WHERE kind_name =
'retorno'` + limpar a chave dos 2 leads. Risco zero.

---

## 2b. Execução — o que já foi feito

### ✅ 12/08/2026 — Etapa 1 (código)

`apply.ts` · `context.ts` — **245 linhas removidas**

- Os três caminhos de movimentação por IA (`auto:classifier-general`, `-nurture`,
  `-b2b`) e tudo que existia só para servi-los: `pipelineMove`, `resolveStageId`,
  `isTerminalStage`, `HUMAN_SCHEDULING_STAGES`, tipo `Canon`
- A trava `lockedInPacienteAntigo`, que impedia a IA de gravar tags e campos em
  *Paciente antigo*. Comparava por nome de coluna e teria quebrado sozinha no
  rename — decisão registrada em §5 item 8
- `hasBeenTreatedBefore` passou a resolver por **alias canônico**, imune a rename

**`apply.ts` está sem nenhuma comparação por nome de coluna.** A IA continua
resumindo, marcando tags e preenchendo campos — só não toca mais no board.

> ⏳ Não commitado, não deployado. Typecheck não executado (ambiente sem Deno).

### ✅ 12/08/2026 — Bloco A (banco)

| Ação | Resultado |
|---|---|
| Desligar `automation.ai_chat_move.enabled` | ⏳ a confirmar |
| Desativar tipo de compromisso `retorno` | ⏳ a confirmar |
| Limpar `retorno_agendado_em` de 2 leads | ⏳ a confirmar |
| `B2B / Stakeholders` → **Administrativo** | ✅ `is_terminal` false |
| `Tratamento Ativo` → **Tratamento Finalizado** | ✅ |
| Criar pipeline **Clínica ÓR — Pacientes** | ✅ com coluna *Reagendamento* (pos. 4) |

Os `stage_id` foram preservados nos dois renames — nenhum histórico quebrou,
nenhum lead se moveu.

> ⚠️ **Alias pendente:** o canônico `B2B / Stakeholders` ainda aponta para a coluna
> que virou *Administrativo*. Hoje nada o resolve (o caminho b2b foi removido), mas
> precisa ser acertado na limpeza de aliases da Etapa 4.

> 🔍 **Descoberto na execução:** `CREATE UNIQUE INDEX uniq_pipeline_default ON
> pipelines(is_default) WHERE is_default` é **global, não por clínica** — só um
> pipeline em todo o banco pode ser default, e hoje é o da ÓR. As demais clínicas
> não têm default. Passar o default para o P1 exige desmarcar e marcar na mesma
> transação.

---

### ✅ 12/08/2026 — Etapa 2 (travessia entre pipelines)

| Peça | O que faz |
|---|---|
| Migração `20260812230000_pipeline_crossings` | Tabela `pipeline_crossings` (`from_stage_id` → `to_stage_id`, `trigger_key`, `allow_auto`, `enabled`) + colunas `from_pipeline_id`/`to_pipeline_id` no histórico |
| `pipeline-move.ts` · **gate G9** | Detecta funil diferente e **recusa** travessia não declarada. `manual`, `ui` e `system:*` passam direto |
| `pipeline-deterministic` · `resolveDestination()` | Tenta a coluna no funil do lead; se não achar, procura travessia declarada. Prefere `trigger_key` exato, coringa `*` só se único, **ambíguo recusa** |

Aplicado no gatilho de data e no `ruleAppointmentSync` — os dois que vão cruzar.

**A tabela nasce vazia de propósito.** Nenhuma coluna foi para o P2 ainda, então
não há travessia. As linhas são semeadas na Etapa 4, junto com a mudança de
colunas. **O G9 fica inerte até lá** — verificado: nenhuma automação atual
atravessa funil.

### ✅ 12/08/2026 — Etapa 3 (higiene do histórico)

Migração `20260812234500_historico_higiene`:

1. **Instante canônico.** `moved_at` deixa de ser `DEFAULT now()` e passa a ser
   `NEW.stage_changed_at` — gravado pelo trigger BEFORE `leads_stage_changed`.
   O `pipelineMove` lê esse valor de volta do `UPDATE` e usa o mesmo.
2. **`pipelineMove` faz UPSERT, não INSERT.** Com `moved_at` idêntico, o índice
   único colide e o helper **enriquece** a linha que o trigger criou, com o source
   real, o motivo e o metadata — em vez de criar uma segunda. **É a correção da
   duplicação de 18%.**
3. **Nome da coluna no registro** (`from_stage_name`/`to_stage_name`), com backfill
   de tudo que ainda é recuperável. Log de auditoria não pode depender de FK viva.
4. **Limpeza das ~1094 duplicatas** existentes, mantendo a linha mais informativa
   de cada grupo. ⚠️ Irreversível — a migração traz a query de conferência.

> 🔍 **Armadilha evitada:** trocar o índice único por `date_trunc('second',
> moved_at)` parecia mais robusto, mas quebraria o `ON CONFLICT (lead_id,
> to_stage_id, moved_at)` do trigger `fn_clinica_or_wakeup_inbound` — a inferência
> ficaria sem índice correspondente, o INSERT levantaria exceção e **a ingestão de
> mensagens inbound da clínica pararia**. O índice foi mantido; com o instante
> canônico ele já basta.

> ⏳ **Pendente (1 linha, junto da Etapa 5):** `fn_clinica_or_wakeup_inbound` ainda
> usa `ON CONFLICT ... DO NOTHING`, então sua linha é descartada e o wake-up
> aparece como `system` no histórico (defeito D9). Trocar por `DO UPDATE SET
> source = EXCLUDED.source` resolve — mas exige reescrever a função inteira, e ela
> vai ser substituída na Etapa 5 de qualquer forma.

---

### ✅ 12/08/2026 — Etapa 4 (topologia) — CONCLUÍDA

Deploy do código verificado em produção **antes** de rodar: às 21:45 uma
movimentação `auto:followup-7d` ainda gerava duas linhas (`system` + origem real,
separadas por 79 ms); às 23:45 o `auto:inactivity-tick` gerou **uma linha só, com
a origem real**. Assinatura do upsert funcionando.

Bloco B executado. **Nenhum lead perdido: 1914 antes, 1914 depois.**

| Clínica ÓR — Vendas | leads | Clínica ÓR — Pacientes | leads |
|---|---|---|---|
| Leads de entrada | 0 | Consulta agendada | 9 |
| Qualificação | 23 | Tratamento agendado | 6 |
| Sem resposta | 29 | Consulta finalizada | 3 |
| Nutrição Inativa | 932 | Tratamento Finalizado | 6 |
| Desqualificado | 16 | **Reagendamento** | 0 |
| Administrativo | 278 | **Paciente Inativo** | 612 |
| Nutrição Antigos (migrada) | 0 | | |
| **subtotal** | **1278** | **subtotal** | **636** |

Conferência: `leads_incoerentes = 0` · `travessias = 16` · 418 linhas de histórico
geradas pela fusão dos 417 leads de *Nutrição Antigos* com os 195 de *Paciente
antigo*.

> ⚠️ *Nutrição Antigos (migrada)* continua visível no funil de Vendas, vazia, na
> posição 9. Foi mantida de propósito — apagar geraria 528 linhas de histórico
> órfãs. Decidir depois da estabilização.

---

### ✅ 12-13/08/2026 — Etapa 5 (regras do fluxo novo)

**Código** — `pipeline-deterministic` caiu de 1190 para 825 linhas.

| Mudança | Efeito |
|---|---|
| `ruleInactivityTick` reescrita (220 → 95 linhas) | Faz uma coisa só: **24h sem mensagem do paciente em Qualificação → Sem Resposta**. O resto virou automação de coluna |
| `faltou` e `cancelado` | Iam para *Sem resposta* e *Qualificação*, ambas no funil de Vendas — rebaixavam paciente a lead. Agora vão para **Reagendamento** |
| Reativação por funil | Paciente que reaparece em Finalizada ou Paciente Inativo → **Reagendamento**. Em Nutrição Inativa → Qualificação |
| Data apagada → Reagendamento | Vale **só** em Consulta/Tratamento Agendado. Sem isso haveria laço: entrar em Finalizada limpa a data e o card saltaria de volta |
| `run_once` em `automations` | Uma vez por lead, para sempre. Conta só `success`, teto de **3 tentativas** |
| Telemetria | `pipeline_tick_stats` lia `inactivity.pa40` e a função devolvia `pa60` — gravava zero desde sempre |

**Removidos:** `ruleConsultaPassou`, `ruleMonthlySweep`, os gatilhos
`ciclo_concluido` e `eh_paciente_antigo` *(cliente confirmou que a secretária não
usa)*, o degrau de 3 dias e a regra de 60d *Paciente antigo → Nutrição Antigos*.

**Migrações aplicadas:** `20260813020000` (canônico de Reagendamento + travessias
de borda) e `20260813030000` (`run_once`).

> 🔍 O `npm run docs:verify` — criado na `main` em paralelo — **detectou a coluna
> Reagendamento faltando no registry**. Primeira vez na reforma que uma ferramenta
> encontrou drift antes de nós. O registry de stages foi atualizado para os dois
> funis; das 3 divergências originais restou 1, a do cron que morre na Etapa 7.

### ✅ 13/08/2026 — Etapa 5 no ar, confirmada por comportamento

O **Publish do Lovable não faz deploy das edge functions** — a tela
Cloud → Edge functions mostrava "Last updated: 2 days ago" em todas, com os
commits das Etapas 1–5 já na `main`. Foi preciso pedir ao agente do Lovable para
publicar `pipeline-deterministic`, `pipeline-classify` e `automations-tick`.

**Prova do deploy, em `pipeline_tick_stats`:**

```
15:15:04   candidates=25   moved=13   ← código novo
15:00:07   candidates=0    moved=0
14:45:04   candidates=0    moved=0
```

Todo tick anterior gravava `candidates=0` — era o bug `pa40`/`pa60`. Às 15:15 a
regra nova contou 25 candidatos e **moveu 13** de *Qualificação* para
*Sem Resposta*. Qualificação foi de 23 para 10; os números fecham.

> 🔍 **Correção de método.** Em 12/08 eu tratei "uma linha em vez de duas" às
> 23:45 como prova de deploy. Não era: a limpeza de duplicatas da migração 3
> agrupa por segundo, e aquele par caiu no mesmo segundo — foi ela que o
> colapsou. O par das 21:45 sobreviveu por estar em segundos diferentes
> (`05.928` / `06.007`). **O sinal escolhido podia ser produzido pela própria
> migração.** A lição: verificar deploy por um comportamento que só o código
> novo produz — aqui, `candidates > 0` e o movimento para *Sem Resposta*, que a
> versão antiga nunca fazia.

**Consequência de ter rodado o Bloco B antes do deploy:** entre 23:20 de 12/08 e
15:15 de 13/08 o código antigo rodou contra a topologia nova. Nesse intervalo,
preencher a data **não convertia** — `resolveStageId` filtrava pelo funil do lead
e devolvia `null` em silêncio.

> 💡 `failure_reasons: {"clinic_not_allowlisted": 2}` no tick — a regra varre o
> canônico `Qualificação` em **toda a base**, e outras clínicas também têm essa
> coluna. O gate de allowlist barrou as 2 corretamente, mas confirma o padrão: o
> que protege os outros tenants é um gate, não o escopo da regra.

### ✅ 13/08/2026 — Etapa 7 no ar, e o gatilho de wake-up removido

Deploy pedido ao agente do Lovable (o botão *Publish* republica só o site — as
edge functions ficam para trás). `Last updated` das três em **13/08 18:31 UTC**:
`pipeline-deterministic`, `pipeline-classify`, `outreach-recovery-tick`.
`pipeline-monthly-cycle-or` saiu do backend.

**Confirmação por comportamento, não por relato.** O sinal específico desta leva é
`ruleReactivationInbound` passando a atender *Sem Resposta* — antes esse movimento
só existia no trigger SQL e era gravado como `system`:

```
Sem resposta → Qualificação   18:37:02   source = auto:reactivation-inbound
```

Seis minutos depois do deploy, e **nenhuma linha `system`** no período. Só então o
gatilho antigo foi removido:

```sql
DROP TRIGGER IF EXISTS trg_clinica_or_wakeup_inbound ON public.messages;
DROP FUNCTION IF EXISTS public.fn_clinica_or_wakeup_inbound();
```

Teste refeito depois do `DROP` — o lead voltou para *Qualificação* pelo caminho do
código. A ordem importava: os dois conviviam sem problema, mas remover o antigo
antes de provar o novo deixaria lead respondido parado na geladeira, invisível.

**Também em 13/08:** `automation.followup_7d_nutricao.enabled` apagado de
`app_settings` (botão sem código atrás). O inventário de `cron.job` mostrou que o
`app_settings` tem só **5 chaves** — as outras 15 da lista de descarte nunca
existiram no banco, eram default no código.

> **Inventário de `cron.job` (13/08 18:51) — 30 jobs ativos.** Os três que chamam
> `pipeline-deterministic` apontam para ações que **continuam existindo** depois da
> reescrita: `inactivity-tick` (*/15), `reactivation-tick` (0 7) e
> `human-reactor-tick` (0 8). Nenhum cron órfão.

---

### Estado operacional em 13/08

**Todas as automações e sequências estão desligadas** — decisão do cliente durante
a cirurgia. *Sem Resposta* foi esvaziada (29 leads → Nutrição Inativa, hoje com
963) para que as duas regras de follow-up possam ser ligadas juntas, sem disparar
em massa para o backlog.

Ordem de religamento acordada:

| Onda | O quê | Motivo |
|---|---|---|
| 1ª | 4 lembretes de consulta | Custo real parado: paciente sem aviso |
| 2ª | 2 pesquisas de satisfação | Só enviam link, não movem card |
| 3ª | Follow-up #1 e #2 | Sem backlog, podem ir juntas |
| 4ª | 3 regras de prazo | Movem card — depois de um dia observando |
| 5ª | 3 sequências | Cadência longa, por último |

**Pendências conhecidas:**

- A cadência de *Paciente Inativo* tem **1 passo** e a de *Nutrição Antigos*, **0**
- *ÓR — Nutrição Antigos* está vinculada à coluna morta — apagar ou repontar
  *(resolvido: a sequência não existe mais no levantamento de 14/08)*
- Pesquisa de procedimento disparava da coluna de **consulta**; corrigida por `UPDATE`
- Lembretes 24h/1h **não existem** para tratamento, só para consulta

---

### 🔴 14/08/2026 — `ÓR — Reativação Paciente Antigo` dispararia para todo lead novo

A sequência está com `trigger_type = 'pipeline_enter'` e
`trigger_config = {stage_id: 7fea97d7…, pipeline_id: 17c27f4d…}`. Parece apontar
para *Paciente Inativo*. Não aponta — e por dois motivos que se somam.

**1. O gatilho ignora o `stage_id`.** A função de matrícula
(`20260528182916_…sql`) compara só o pipeline:

```sql
(trigger_type = 'pipeline_enter' AND pipeline_changed
 AND (trigger_config->>'pipeline_id')::uuid = new_pipeline_id)
```

**2. E em INSERT tudo é considerado mudança:**

```sql
IF TG_OP = 'INSERT' THEN
  stage_changed := true;
  pipeline_changed := true;
```

`17c27f4d` é o **Vendas**. Logo, ligar a sequência matricularia *todo lead criado
no Vendas* — inclusive quem acabou de mandar a primeira mensagem no WhatsApp — na
cadência de "sentimos sua falta", mais todo lead que atravessasse de Pacientes
para Vendas numa conversão.

**3. E o alvo está no outro funil.** Confirmado em 14/08: *Paciente Inativo*
(`7fea97d7`) pertence a **Clínica ÓR — Pacientes**; *Nutrição Inativa*
(`64356dbe`) pertence a **Clínica ÓR — Vendas**. Mesmo que o gatilho lesse o
`stage_id`, ele está escutando o funil errado.

Nunca disparou porque está `enabled = false`. Correção: trocar para
`stage_enter` apontando para *Paciente Inativo*, pela tela de Sequências — que
lista as colunas de todos os funis, não só o de vendas padrão. Como o gatilho é
por `INSERT`/`UPDATE` de `stage_id`, os 612 leads já parados em Paciente Inativo
**não** são matriculados retroativamente; só quem entrar depois.

> `ÓR — Nutrição Leads`, em contraste, está correta: `stage_enter` em `64356dbe`,
> 4 passos com conteúdo, `stop_on_reply` ligado, cooldown de 30 dias. Faltam só a
> instância de envio e o `enabled`.

---

### 14/08/2026 — Instância de WhatsApp por automação

`evolution-send` lê só `leads.whatsapp_instance_id`. Sequência já contornava isso
(`message_sequences.whatsapp_instance_id` + patch no `sequence-tick`); automação
não tinha equivalente, e por isso a `ÓR — Pesquisa de Satisfação (Consulta)`
falhou em 14/08 15:10 com `Nenhuma instância WhatsApp configurada` — no mesmo
minuto em que um lembrete saía normalmente para outro lead.

Na ÓR são **1.488 leads sem instância**, sendo 774 em Nutrição Inativa (79% da
coluna) e 414 em Paciente Inativo. A coluna *Sem resposta* não tem nenhum.

Resolvido em `6c410a69`: coluna `automations.whatsapp_instance_id` + seletor na
tela + patch no `automations-tick` com o mesmo `.is(…, null)` do `sequence-tick`,
que nunca sobrescreve vínculo existente.

> **Não fazer `UPDATE` em massa nos 1.488.** O patch por envio resolve lead a lead,
> só para quem realmente entra numa cadência, e preserva quem já tem número.

---

### 🔴 12/08/2026 — Achado que teria quebrado a travessia em produção

`trg_leads_enforce_coherence` chama
`leads_enforce_clinic_pipeline_stage_coherence()` — função **ausente do
repositório**, obtida do banco. Ela valida e **levanta exceção**:

```sql
IF NEW.pipeline_id IS NOT NULL AND v_stage_pipeline <> NEW.pipeline_id THEN
  RAISE EXCEPTION 'stage_id % belongs to pipeline %, not lead.pipeline_id %';
```

**A ordem de disparo é o problema.** Triggers BEFORE do Postgres executam em ordem
alfabética do nome:

```
trg_leads_enforce_coherence   ← 'e'  — valida
trg_leads_sync_pipeline       ← 's'  — corrigiria o pipeline_id
```

A validação roda **antes** da sincronização. Num `UPDATE leads SET stage_id =
<coluna de outro funil>`, o `enforce` vê o stage já no funil novo e o
`pipeline_id` ainda no antigo → exceção. O `sync`, que resolveria, nunca roda.

Como o `pipelineMove` escrevia **só** `stage_id` (regra do G8, correta quando havia
um funil só), **toda travessia falharia**: o G9 liberaria e o UPDATE morreria em
seguida.

**Correção:** o G8 passa a escrever `pipeline_id` junto **apenas em travessia**.
Com os dois no mesmo statement a validação passa, e o sync só reescreve o mesmo
valor.

> Vale para o Bloco B também: a migração dos 415 leads precisa setar `stage_id`
> **e** `pipeline_id` no mesmo UPDATE.

---

## 3. Ordem de implementação

> ⚠️ **A ordem não é negociável nas etapas 1→3.** Criar o P2 antes da travessia
> funcionar quebra os gatilhos de data imediatamente.

### Etapa 1 · Parar a movimentação automática indevida
**Depende de:** nada · **Pode começar já**

1. Remover os três caminhos de movimentação por IA em `apply.ts`
   (`auto:classifier-general`, `-nurture`, `-b2b`) e as constantes que só existem
   para limitá-los
2. Limpar os toggles órfãos em `app_settings`

**Critério de pronto:** 7 dias sem nenhum `auto:classifier-*` em `lead_stage_history`.

> ✅ **Decidido 12/08 — sweeps mensais saem daqui.** Devem ser removidos, mas sem
> urgência: não bloqueiam nenhuma etapa. Ver Etapa 7, item 29.

### Etapa 2 · Travessia entre pipelines
**Depende de:** nada · **paralelo à 1**

5. `resolveStageId` passa a resolver no escopo da **clínica**, com pipeline como
   desempate opcional
6. Tabela de travessias permitidas; `pipelineMove` recusa o que não estiver declarado
7. `lead_stage_history` grava pipeline de origem e destino

**Critério de pronto:** teste em lead de mesa movendo de P1 para P2 e sendo recusado
numa travessia não declarada.

### Etapa 3 · Higiene do histórico
**Depende de:** nada · **fazer antes da migração**

8. Resolver a duplicação (18% do histórico)
9. Gravar **nome** de coluna e pipeline no registro, para que deleção futura não
   cegue o passado

> Sem o item 9, apagar *Nutrição Antigos* transforma **528 linhas** em órfãs,
> subindo o total de 47% para ~56%.

### Etapa 4 · Topologia
**Depende de:** 2 e 3

10. Criar o pipeline **Pacientes** e mover para ele: Consulta Agendada, Tratamento
    Agendado, Consulta Finalizada, Tratamento Ativo→**Tratamento Finalizado**,
    Paciente antigo→**Paciente Inativo**
11. Criar a coluna **Reagendamento**
12. Renomear **B2B / Stakeholders** → **Administrativo** (mantém `stage_id`)
13. Migrar os 415 leads de *Nutrição Antigos* → *Paciente Inativo* e aposentar a coluna
14. Passar `is_default` para o P1
15. Cadastrar aliases canônicos das colunas novas

### Etapa 5 · Regras do fluxo novo
**Depende de:** 4

16. **Qualificação → Sem Resposta em 24h** — regra determinística, relógio de
    silêncio do paciente
17. Campo `run_once` em `automations` (só `success`, teto de 3 tentativas)
18. Regras `stage_idle`: FU#1 (`hours: 0`), FU#2 (`48`), →Nutrição (`168`),
    Reagendamento→Inativo (`168`), Finalizada→Inativo (`1440`)
19. Gatilho **"data apagada"** → Reagendamento, válido **só** em Consulta Agendada e
    Tratamento Agendado
20. Entrada automática em Reagendamento: paciente escreve estando em Finalizada ou
    Paciente Inativo
21. Remover *Administrativo* do contador de inatividade
22. Aposentar `ciclo_concluido` e `eh_paciente_antigo` como gatilhos

### Etapa 6 · Mensagens
**Depende de:** 5

23. Criar os templates **Follow-up #1** e **#2** — não existem
24. **P1 · Nutrição Inativa:** ligar o vínculo da sequência *ÓR — Nutrição Leads*
    (4 passos, pronta) — **um booleano**
24b. **P2 · Paciente Inativo:** fundir *Reativação Paciente Antigo* (1 passo) e
    *Nutrição Antigos* (0 passos) numa sequência só e **escrever o conteúdo** —
    hoje somam 1 passo
25. Ajustar `report-finalizados-mensal-or`: contar por **entrada na coluna no
    período** (`stage_changed_at`), não por "está na coluna agora" — sem o sweep, o
    critério atual passa a somar dois meses

### Etapa 7 · Limpeza
**Depende de:** 6

26. Corrigir `outreach-recovery-tick` — procura por nome `"Paciente antigo"` (que
    muda) e `"Nutrição de Leads Inativos"` (que não existe)
27. **D15 — desativar o tipo `retorno`** ✅ *(decidido 12/08)*
28. Remover `modalidade_preferida` do schema da IA
29. **Remover os dois sweeps mensais** ✅ *(concluído 13/08)*
    - Cron `pipeline-monthly-cycle-or-day1` + a função `pipeline-monthly-cycle-or`
    - Cron `pipeline-monthly-sweep-paciente-antigo` + `ruleMonthlySweep`
    - `cron.unschedule` retornou `could not find valid entry for job` para o
      primeiro; o `SELECT * FROM cron.job` de 13/08 18:51 confirmou que **nenhum
      dos dois existe mais**. O código dos dois já tinha saído (função deletada na
      Etapa 7, `ruleMonthlySweep` na Etapa 5). Nada a desagendar.
    - O `case "monthly-sweep-tick"` em `pipeline-deterministic` continua como stub
      inofensivo — sem cron chamando, é código morto que pode sair numa limpeza
      futura.

---

## 4. Riscos operacionais

**A migração dispara automações em massa.** Mover 635 cards aciona 6 triggers cada.
Com as sequências ligadas, isso dispararia mensagem para centenas de pacientes de
uma vez. **A migração tem de acontecer com as sequências desligadas** — por isso a
etapa 6 vem depois da 4.

**280 leads em "B2B / Stakeholders".** A decisão foi renomear a coluna para
*Administrativo*. Mas 280 cards é 14,6% da base — não parece demanda operacional da
equipe. Provável falso positivo do regex `b2b_pitch`, que marca `is_b2b = true` a
partir de expressões como *"secretária virtual"* ou *"chatbot para clínica"*.

**Precisa de decisão** (§5). E há um agravante: lead marcado `is_b2b` tem o motor de
chips **permanentemente desligado** — se forem falso positivo, são 280 leads cegos.

**`pipeline-dispatcher-tick` roda a cada minuto e a função não existe no
repositório.** Mais um caso de repositório atrás da produção. Não bloqueia, mas
ninguém sabe o que ela faz.

---

## 5. Decisões e dados que faltam

| # | Item | Bloqueia |
|---|---|---|
| 1 | ~~280 leads de B2B~~ ✅ **decidido: vão todos para Administrativo**, sem revisão prévia | — |
| 2 | ~~D15 — retorno~~ ✅ **decidido e medido: 0 compromissos, desativação trivial** | — |
| 3 | **Apagar *Nutrição Antigos* ou aposentar?** Apagar custa 528 linhas órfãs se feito antes da etapa 3 | Etapa 4 |
| 4 | ~~Conteúdo dos follow-ups~~ ✅ **cliente escreve na UI** — implementação só acopla os gatilhos | — |
| 5 | ~~As sequências têm passos?~~ ✅ **medido: P1 pronta (4), P2 tem 1** | — |
| 6 | ~~Retornos futuros?~~ ✅ **zero** | — |
| 7 | ~~Cadência de Paciente Inativo~~ ✅ **cliente escreve na UI** | — |
| 8 | **`lockedInPacienteAntigo`** — guarda que impede a IA de gravar tags/campos em *Paciente antigo*. Compara por nome; **quebra sozinha no rename da Etapa 4**. Remover ou trocar por canônico? | Etapa 4 |
| 9 | **`ai-chat` — 4º caminho de movimentação por IA.** Toggle `automation.ai_chat_move.enabled = true`. Desligar basta, ou remover a ferramenta? | — |

```sql
-- As cadências têm passos cadastrados?
SELECT s.id, s.name, s.enabled, s.stop_on_reply, s.cooldown_days,
       (SELECT count(*) FROM message_sequence_steps st WHERE st.sequence_id = s.id) AS passos
FROM message_sequences s
WHERE s.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
ORDER BY s.name;
```

Se vier `passos = 0`, as cadências precisam ser escritas do zero e a etapa 6 cresce.

```sql
-- Impacto de desativar o tipo `retorno` (item 27)
SELECT count(*) AS total_retornos,
       count(*) FILTER (WHERE status = 'agendado' AND scheduled_at > now()) AS futuros_agendados
FROM appointments
WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1' AND kind = 'retorno';

SELECT count(*) AS leads_com_campo_retorno
FROM leads
WHERE clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND custom_fields ? 'retorno_agendado_em';
```

### Como desativar o `retorno` com segurança

`recompute_lead_appointment_summary` **itera sobre os tipos ativos** e grava
`${kind}_agendado_em` para cada um — é o banco que está criando o campo órfão.

1. Se houver **retornos futuros agendados**, migrá-los para `kind = 'consulta'` primeiro
2. `UPDATE clinic_appointment_types SET is_active = false WHERE kind_name = 'retorno'`
   — o laço para de escrever o campo e novos compromissos do tipo passam a ser
   bloqueados pela validação
3. Limpar `retorno_agendado_em` dos leads que ficaram com valor obsoleto

> Compromissos de `retorno` já existentes continuam funcionando para mudança de
> status: a validação só dispara em `UPDATE OF kind, clinic_id`.
