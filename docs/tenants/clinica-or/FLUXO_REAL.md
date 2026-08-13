---
title: "Fluxo real do pipeline — Clínica ÓR"
topic: kanban
kind: flow
audience: both
status: vigente
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
updated: 2026-08-11
summary: "Como o pipeline da Clínica ÓR funciona HOJE, coluna a coluna, verificado contra banco e código em 11/08/2026 — não contra documentação. Cada regra marcada como funcionando, com ressalva, defeituosa ou não verificada. Contém 14 defeitos numerados (D1–D14) para referência direta."
related_docs:
  - docs/tenants/clinica-or/auditoria-11-08-2026.md
  - docs/_audit/MAPA_CODIGO_PIPELINE.md
  - docs/roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md
code_refs:
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/pipeline-classify/apply.ts
---

# Fluxo real do pipeline — Clínica ÓR

> # ⚠️ ESTE FLUXO É EXCLUSIVO DA CLÍNICA ÓR
> **Não existe fluxo padrão.** Nada aqui vale para outro cliente. Cada cliente terá
> um fluxo completamente diferente. Ver `docs/roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md`.

**Pipeline:** `17c27f4d-8256-4ea7-b5b9-ed706494f686` · **Verificado:** 11/08/2026,
contra banco e código.

## Como ler

| Marca | Significado |
|---|---|
| ✅ | Funciona e foi verificado |
| ⚠️ | Funciona, mas com comportamento inesperado |
| 🔴 | **Defeito** — numerado como `D#` para você referenciar |
| ❓ | Não verificado — trate como suposição |

---

## 1. O ciclo de vida em uma página

O paciente **não sai do funil**. Entra como lead, vira paciente, vira paciente
antigo — e pode voltar. É um ciclo, não uma linha. É daí que vem a complexidade.

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
   Leads de entrada │                                          │
          │         │                                          │
   secretária       │                                          │
   responde ↓       │                                          │
    Qualificação ───┼──── 7d sem resposta ──→ Nutrição Inativa │
          │         │                              │           │
   preenche data    │                         paciente         │
          ↓         │                         responde ────────┘
   Consulta agendada│                        (volta p/ Qualificação)
          │         │
   move manual      │
          ↓         │
   Consulta finalizada ──┐
                         │  dia 1º do mês
   Tratamento agendado   ├──────────────→ Paciente antigo
          ↓              │                     │
   Tratamento Ativo ─────┘              60d sem contato
                                              ↓
                                        Nutrição Antigos
                                              │
                                     paciente responde
                                              ↓
                                     (ver D9 — destino em conflito)
```

**A coluna "Sem resposta" está fora desse desenho de propósito** — hoje quase nada
entra nela. Ver **D6**.

---

## 2. As 12 colunas

| # | Nome na tela | UUID | Nome canônico | Terminal |
|---|---|---|---|---|
| 0 | Leads de entrada | `b1aa2fc9` | `Novo` | não |
| 1 | Qualificação | `c6eb67f3` | `Qualificação` | não |
| 2 | Paciente antigo | `7fea97d7` | `Paciente antigo` | não |
| 3 | Consulta agendada | `e12f004a` | `Consulta agendada` | não |
| 4 | Consulta finalizada | `7584241f` | `Consulta finalizada` | não |
| 5 | Tratamento agendado | `98320189` | `Tratamento agendado` | não |
| 6 | **Tratamento Ativo** | `2a352661` | `1ª Sessão Finalizada` · `em_tratamento` | não |
| 7 | Sem resposta | `9f408ae6` | `Sem resposta` | não |
| 8 | Nutrição Inativa (Geladeira de Leads) | `64356dbe` | `Nutrição inativa` | não |
| 9 | Nutrição Antigos | `9de8e54e` | `Nutrição Antigos` | não |
| 10 | B2B / Stakeholders | `23a7bfd7` | `B2B / Stakeholders` | **sim** |
| 11 | Desqualificado / Fora de escopo | `35670cad` | **nenhum** | **sim** |

> ⚠️ **O nome na tela e o nome canônico são coisas diferentes.** O código deve usar
> o canônico (via `stage_canonical_aliases`), que sobrevive a rename. Onde ele
> compara pelo nome da tela, quebra — é a causa de **D3** e **D8**.

🔴 **D1 — A coluna "Desqualificado / Fora de escopo" não tem nome canônico.**
Nenhuma automação consegue mandar lead para lá; só move manual. Se a intenção é
que a IA ou uma regra desqualifique automaticamente, hoje não acontece.

> ⚠️ Nenhuma coluna tem `lock_auto_move = true`. O gate G2, que existe para
> proteger colunas de automação, não protege nada hoje.

---

## 3. Coluna a coluna

### 0 · Leads de entrada

**Entra:**
- ✅ Lead criado por qualquer origem → `auto:novo-lead` (**82 moves/30d**)

**Sai:**
- ✅ Secretária manda a 1ª mensagem → **Qualificação** (`auto:secretary-replied`, **81/30d**).
  Saudação automática do WhatsApp **não** conta.
- 🔴 **D2 — A IA move daqui para Qualificação por conta própria.** 72 movimentações
  por `auto:classifier-general`, a última em **11/08 12:47**. Faz o mesmo que a
  regra determinística, mas sem gate e sem critério humano.
- ✅ 7 dias sem resposta do paciente → **Nutrição Inativa**

---

### 1 · Qualificação

O coração do funil. É onde a secretária trabalha.

**Entra:**
- ✅ 1ª resposta da secretária (vindo de Leads de entrada)
- ✅ Consulta **cancelada** → volta pra cá + tag `reagendamento_pendente`
- ✅ Paciente na geladeira volta a responder (wake-up)
- 🔴 A IA traz de volta de colunas terminais — ver **D10**

**Sai:**
- ✅ **Secretária preenche a data da consulta** → **Consulta agendada** (**18/30d**)
- ✅ **Secretária preenche a data do procedimento** → **Tratamento agendado** (**11/30d**)
- ✅ **7 dias sem mensagem do paciente** → **Nutrição Inativa** (**157/30d — a regra automática mais ativa do funil**)
- ✅ `ciclo_concluido = true` → **Paciente antigo**
- ✅ `eh_paciente_antigo = true` → **Paciente antigo**
- ⚠️ IA com intenção de objeção/desistência → **Nutrição Inativa** (2 moves, último 23/07)

**Efeito colateral ao sair:**
- ⚠️ **Sair de Qualificação apaga o campo `interesse`**, sempre, para qualquer
  destino ([`pipeline-move.ts:206`](../../../supabase/functions/_shared/pipeline-move.ts)).
  É por isso que a linha do tempo mostra `Interesse: … → —` logo depois de um move.

🔴 **D3 — O relógio de inatividade ignora o esforço da clínica.** O contador usa
`last_inbound_at` (só mensagem do paciente). A secretária pode mandar 5 follow-ups
em 6 dias que, no 7º dia sem resposta, o lead cai na geladeira do mesmo jeito.

---

### 2 · Paciente antigo

**Entra:**
- ✅ `ciclo_concluido = true` ou `eh_paciente_antigo = true`
- ✅ **Dia 1º de cada mês:** todo card em *Consulta finalizada* ou *Tratamento Ativo*
  do mês anterior vem para cá (`auto:monthly-sweep`, **5/30d**) e recebe
  `eh_paciente_antigo = true`

**Sai:**
- ✅ **60 dias sem mensagem do paciente** → **Nutrição Antigos** (**37/30d**)

**Proteções:**
- ✅ **Guard D3:** automação não tira lead daqui, exceto para as geladeiras
- ✅ O classificador **nem tenta** sugerir movimentação quando o lead está aqui, e
  também **não grava tags nem campos**

🔴 **D4 — A exceção do guard para "Nutrição Inativa" está morta.** O código compara
com `"Nutrição inativa"`, mas a coluna se chama `Nutrição Inativa (Geladeira de
Leads)`. Sem efeito hoje (nada move Paciente antigo → Nutrição Inativa), mas é
armadilha para qualquer regra futura.

---

### 3 · Consulta agendada

**Entra:**
- ✅ Secretária preenche `consulta_agendada_em`
- ✅ Compromisso de tipo `consulta` ou `retorno` marcado como `agendado`
- ✅ **Reagendar também dispara** — mudar a data move o card de novo

**Sai:**
- ✅ Compromisso `realizado` → **Consulta finalizada** + `status_consulta = realizada`
- ✅ Compromisso `faltou` → **Sem resposta** + tag `reagendamento_pendente`
- ✅ Compromisso `cancelado` → **Qualificação** + tag `reagendamento_pendente`
- ✅ **Move manual da secretária** → Consulta finalizada *(o caminho normal)*
- ✅ 7 dias sem resposta → Nutrição Inativa ⚠️ **mesmo com consulta marcada**

**Proteção:**
- ✅ A IA está **proibida** de entrar nesta coluna. Verificado: nenhum move de IA
  para colunas de agendamento desde 25/06.

🔴 **D5 — Card com consulta marcada pode cair na geladeira.** Esta coluna está na
lista de "colunas ativas" do contador de inatividade. Paciente que marcou consulta
para daqui a 10 dias e não escreve mais nada vai para Nutrição Inativa antes da
consulta acontecer.

---

### 4 · Consulta finalizada

**Entra:**
- ✅ Compromisso `consulta` marcado como `realizado`
- ✅ **Move manual da secretária** *(caminho principal)*

**Sai:**
- ✅ Sweep do dia 1º → **Paciente antigo**

**Efeito colateral ao entrar:**
- ⚠️ **Apaga 4 campos** (`consulta_agendada_em`, `procedimento_agendado_em`,
  `consulta_confirmada`, `procedimento_confirmado`) e **liga `aguardando = true`**

> A regra automática que fecharia o card sozinho quando a data passou existe no
> código mas está **desligada** de propósito — com consulta e tratamento em
> paralelo ela finalizava cards ativos cedo demais. Fechar é manual.

---

### 5 · Tratamento agendado

**Entra:**
- ✅ Secretária preenche `procedimento_agendado_em`
- ✅ Compromisso `procedimento` marcado como `agendado`

**Sai:**
- ✅ Compromisso `procedimento` `realizado` → **Tratamento Ativo**, e
  **`sessoes_realizadas` +1**
- ✅ Move manual
- ✅ 7 dias sem resposta → Nutrição Inativa *(mesmo problema do **D5**)*

---

### 6 · Tratamento Ativo

**Entra:**
- ✅ Compromisso `procedimento` realizado
- ✅ Move manual

**Sai:**
- ✅ Sweep do dia 1º → **Paciente antigo**

🔴 **D6 — A IA tira paciente em tratamento e joga em Qualificação.** 5 movimentações,
a última em **11/08 às 14:42**.

**Causa raiz:** a coluna foi renomeada de `1ª Sessão Finalizada` para
`Tratamento Ativo`, mas o código que detecta "esse paciente já foi tratado" compara
pelo **nome antigo**. Resultado: a IA não reconhece o paciente como tratado e o
trata como lead frio. *(Correção já preparada, não aplicada.)*

---

### 7 · Sem resposta

🔴 **D7 — Esta coluna está praticamente fora do fluxo automático.**

**Entra:**
- ✅ Compromisso marcado como `faltou` — **e só isso**

A regra que deveria mandar lead de Qualificação para cá após 48h **não existe em
produção**. Ela está em migração no repositório, mas não está no banco. O último
move por regra da UI foi em **28/07** — provavelmente quando as regras foram
apagadas.

**O que acontece de verdade:** o lead pula "Sem resposta" e vai direto de
Qualificação para Nutrição Inativa aos 7 dias.

**Sai:**
- ✅ Paciente responde → **Qualificação** + tag `reativacao`

---

### 8 · Nutrição Inativa (Geladeira de Leads)

**Entra:**
- ✅ 7 dias sem mensagem do paciente, vindo das colunas ativas (**157/30d**)
- ✅ Recebe tag `precisa_atencao_humana`

**Sai:**
- ✅ Paciente responde → **Qualificação** + tag `reativacao` *(instantâneo, via trigger)*

**Sem mover:**
- ✅ Cron diário: lead parado há +30 dias **com `interesse_tratamento = true`**
  ganha a tag `reativacao`

---

### 9 · Nutrição Antigos

**Entra:**
- ✅ 60 dias sem mensagem, vindo de Paciente antigo (**37/30d**)

**Sai:**
- 🔴 **D8 — Dois caminhos brigam e mandam para lugares diferentes.**

| Caminho | Destino |
|---|---|
| Trigger SQL `trg_clinica_or_wakeup_inbound` | **Qualificação** |
| Regra `auto:reactivation-inbound` | **Paciente antigo** |

O trigger SQL é síncrono e vence quase sempre. **Na prática, um paciente antigo que
volta a falar é tratado como lead novo**, contrariando a proteção que existe
justamente para não rebaixar paciente antigo.

🔴 **D9 — O wake-up é invisível no histórico.** Como o trigger faz a atualização e o
registro na mesma transação, o registro com a origem real (`auto:wakeup-trigger`) é
descartado e sobra só um genérico `system`. **Zero ocorrências** em 30 dias, apesar
da regra rodar.

---

### 10 · B2B / Stakeholders `terminal`

**Entra:**
- ✅ Classificador com `is_b2b`, confiança ≥ 0,95, tag `b2b` e sem histórico de tratamento
- ✅ Move manual
- 🔴 **D10 — A IA entra aqui por uma porta lateral.** O caminho genérico chega na
  mesma coluna com confiança **0,8** e **nenhuma** das checagens acima (5 leads).

**Ao entrar:** ✅ o sistema carimba `is_b2b = true`

**Sai:**
- 🔴 **D11 — É terminal, mas a IA ressuscita.** 12 leads devolvidos a Qualificação
  (último 24/07) e 2 para Paciente antigo (28/07).

---

### 11 · Desqualificado / Fora de escopo `terminal`

**Entra:**
- ✅ Move manual — **é o único caminho** (ver **D1**)
- ✅ Automático quando o paciente menciona **EMDR**: o sistema marca
  `qualificacao = desqualificado` *(marca o campo, mas **não move o card**)*

**Sai:**
- 🔴 **D12 — 5 leads desqualificados foram devolvidos a Qualificação pela IA**,
  o último em **06/08**.

⚠️ **Dois efeitos colaterais pouco óbvios:**

1. **Entrar aqui marca o lead como `is_b2b = true`** — o mesmo gatilho cobre B2B e
   Desqualificado. Um paciente desqualificado fica registrado como contato comercial.
2. **Isso desliga os chips para sempre.** O motor de chips tem uma blindagem que
   ignora leads com `is_b2b = true`. Uma vez desqualificado, o lead nunca mais
   recebe chip nem tem campo preenchido automaticamente.

---

## 4. O que a secretária faz e o que acontece

| Ação da secretária | Consequência automática |
|---|---|
| Manda a 1ª mensagem | Card vai de *Leads de entrada* → *Qualificação* |
| **Preenche a data da consulta** | Card vai para *Consulta agendada*. Dispara lembretes de 1 dia e 1 hora antes |
| **Preenche a data do procedimento** | Card vai para *Tratamento agendado* |
| **Muda a data** | O card move de novo |
| Marca compromisso como *realizado* | Card avança + `status_consulta` ou `sessoes_realizadas` |
| Marca como *faltou* | Card vai para *Sem resposta* + tag de reagendamento |
| Marca como *cancelado* | Card volta para *Qualificação* + tag de reagendamento |
| Move o card à mão | Aceito — **mas a IA pode desfazer** (ver **D13**) |
| Edita um campo à mão | A IA fica proibida de sobrescrever por **7 dias** ✅ |
| Preenche a **Origem** | A IA nunca mais toca nesse campo ✅ |
| Marca `ciclo_concluido` | Card vai para *Paciente antigo* |

🔴 **D13 — A IA sobrescreve a decisão manual da secretária.** Existe uma trava para
impedir isso nas 24h seguintes, mas ela é **código morto** — a verificação é feita e
o resultado é descartado. **6 casos medidos**, o último em 07/08.

---

## 5. Campos

### Campos que MOVEM o card

| Campo | Preenchido → vai para |
|---|---|
| `consulta_agendada_em` | Consulta agendada |
| `procedimento_agendado_em` | Tratamento agendado |
| `ciclo_concluido` = sim | Paciente antigo |
| `eh_paciente_antigo` = sim | Paciente antigo |

⚠️ As duas datas **não existem** na tabela de campos personalizados — são geradas a
partir dos tipos de compromisso cadastrados. É por isso que aparecem com nome cru
(`consulta_agendada_em`) na linha do tempo em vez do rótulo.

### Campos invisíveis

**13 campos** são escritos automaticamente e **não aparecem no painel de campos**,
porque nunca foram cadastrados:

`procedimento_interesse` · `demonstrou_interesse` · `tentou_pagamento` ·
`tentou_agendar` · `qualificacao` · `desqualificacao_motivo` ·
`desqualificacao_em` · `risco_clinico` · `risco_clinico_detectado_em` · `is_b2b` ·
`tipo_contato` · `interesse` · `aguardando`

🔴 **D14 — `modalidade_preferida` foi apagado mas a IA ainda tenta preencher.**
Gera recusa e ruído no log a cada tentativa.

---

## 6. Chips

**Os chips não vêm da IA.** Vêm de uma busca por palavras-chave feita no banco, no
instante em que a mensagem chega.

| Chip | Palavras que disparam | Campo que preenche |
|---|---|---|
| Cetamina | cetamina, ketamina, infusão | `procedimento_interesse` |
| EMT | emt, estimulação magnética transcraniana | idem |
| 1ª consulta | primeira consulta, avaliação inicial | idem |
| Retorno | retorno, reavaliação | idem |
| Seguimento | seguimento, acompanhamento | idem |
| Terapia | psicoterapia, terapia | idem |
| Interesse | quero, gostaria, quanto custa, qual o valor… | `demonstrou_interesse` |
| Pagamento | pix, comprovante, pagar, boleto, cartão | `tentou_pagamento` |
| Agendamento | agendar, marcar, horário, dias da semana, datas | `tentou_agendar` *(só com confirmação)* |
| Risco clínico | expressões de ideação suicida | `risco_clinico` |
| EMDR (não oferecido) | emdr | **marca como desqualificado** |
| Pitch comercial | "secretária virtual", "chatbot para clínica"… | `is_b2b` |
| nova mensagem | **nenhuma palavra bateu** | — |

⚠️ **Desde 11/08 esse motor roda apenas para a Clínica ÓR** — antes rodava em todas
as clínicas do sistema.

🔴 **Os chips nunca são apagados.** A lista só cresce. Medido: **209 leads** carregam
o chip inútil "nova mensagem" e **16 leads** mostram um procedimento no chip e outro
no campo — porque o campo só é preenchido na primeira vez, e o chip é somado toda vez.

---

## 7. A IA — o que ela realmente faz

**Configuração no banco diz:** 2 agentes, sem mover cards, 4 colunas travadas.

**O que acontece:** rodam **5 agentes** e a IA **move cards** — 64 movimentações em
30 dias, a última em 11/08 às 14:42.

**Por quê:** as quatro configurações que deveriam limitá-la (`active_agents`,
`locked_stages`, `stage_move.enabled`, `stage_move_min_confidence`) **não são lidas
por nenhuma linha do código ativo**.

| O que a IA faz | Estado |
|---|---|
| Resumo da conversa | ✅ funciona |
| Sugerir tags (lista de 44 permitidas) | ✅ funciona |
| Preencher campos | ✅ com trava de 7 dias para edição humana |
| **Preencher datas de agendamento** | ✅ **proibida** |
| **Entrar em colunas de agendamento** | ✅ **proibida** (nada desde 25/06) |
| **Mover para as outras colunas** | 🔴 **faz, sem toggle que desligue** (D2, D10, D11, D12) |
| Respeitar move manual recente | 🔴 **não** (D13) |

**Correção preparada e não aplicada:** reativar a trava de 24h, devolver o toggle,
bloquear colunas terminais e corrigir a detecção de "já tratado".

---

## 8. Automações de mensagem

Seis regras ativas — **todas de comunicação, nenhuma move card**:

| Regra | Quando |
|---|---|
| 1 dia antes da consulta (presencial) | 24h antes de `consulta_agendada_em` |
| 1 dia antes da consulta (online) | idem, para teleconsulta |
| 1 hora antes (presencial) | 60min antes |
| 1 hora antes (online) | idem |
| Pesquisa de satisfação (consulta) | 2h em *Consulta finalizada* |
| Pesquisa de satisfação (procedimento) | **desativada** |

---

## 9. Defeitos — índice

| # | Defeito | Gravidade |
|---|---|---|
| **D1** | Coluna *Desqualificado* sem nome canônico — inalcançável por automação | 🟡 |
| **D2** | IA move de *Leads de entrada* para *Qualificação* sem gate | 🟠 |
| **D3** | Relógio de inatividade ignora follow-up da clínica | 🟠 |
| **D4** | Exceção do guard para *Nutrição Inativa* morta por rename | 🟡 |
| **D5** | Card com consulta marcada cai na geladeira aos 7 dias | 🔴 |
| **D6** | IA rebaixa paciente em *Tratamento Ativo* para *Qualificação* | 🔴 |
| **D7** | Coluna *Sem resposta* fora do fluxo — regra de 48h não existe | 🔴 |
| **D8** | Wake-up de *Nutrição Antigos* com dois destinos em conflito | 🟠 |
| **D9** | Wake-up invisível no histórico (registrado como `system`) | 🟡 |
| **D10** | IA entra em *B2B* por porta lateral, sem os guards | 🟠 |
| **D11** | IA ressuscita leads de *B2B* (coluna terminal) | 🟠 |
| **D12** | IA ressuscita leads de *Desqualificado* (coluna terminal) | 🟠 |
| **D13** | IA sobrescreve movimentação manual da secretária | 🔴 |
| **D14** | `modalidade_preferida` apagado mas ainda no schema da IA | 🟡 |

**Fora do fluxo, mas afetando a leitura:** duplicação de 18% no histórico,
47% do histórico apontando para colunas apagadas, chips que nunca são limpos.
Ver [auditoria de 11/08](auditoria-11-08-2026.md).

---

## 10. O que NÃO foi verificado

| Item | Por quê |
|---|---|
| Crons ativos e horários | Sem acesso a `cron.job` |
| Código publicado nas Edge Functions | Roda na infra da Supabase |
| Entrega das chamadas internas (`pg_net`) | Sem acesso a `net._http_response` |
| Conteúdo dos prompts por tenant | Não consultado |

**Tudo o mais neste documento foi verificado contra banco ou código em 11/08/2026.**
