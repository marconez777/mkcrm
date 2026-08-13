---
title: "Fluxo alvo — dois pipelines — Clínica ÓR"
topic: kanban
kind: flow
audience: both
status: planejado
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
updated: 2026-08-11
summary: "Desenho alvo do pipeline da Clínica ÓR: separação em dois funis (Vendas e Pacientes), com todas as colunas, gatilhos e automações decididos pelo cliente em 11/08/2026. Inclui o mapa de migração das 12 colunas atuais, as travessias entre funis e o que precisa ser construído no motor. Substitui a versão anterior deste arquivo."
related_docs:
  - docs/tenants/clinica-or/FLUXO_REAL.md
  - docs/_audit/MAPA_CODIGO_PIPELINE.md
  - docs/roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md
code_refs:
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
---

# Fluxo alvo — dois pipelines — Clínica ÓR

> # ⚠️ EXCLUSIVO DA CLÍNICA ÓR — não existe fluxo padrão

**Companion de [FLUXO_REAL.md](FLUXO_REAL.md)** (o que é hoje). Este é o alvo,
decidido pelo cliente em 11/08/2026.

**Princípio:** movimentação **100% por gatilho**. A IA não move card — o código que
faz isso será **removido**, não desligado.

---

## 1. Visão geral

```
╔═══════════ PIPELINE 1 · VENDAS ═══════════╗   ╔══════ PIPELINE 2 · PACIENTES ══════╗
║                                           ║   ║                                    ║
║  Leads de Entrada                         ║   ║   Consulta Agendada ◄──┐           ║
║        │ secretária responde              ║   ║         │ manual       │           ║
║        ▼                                  ║   ║         ▼              │ preenche  ║
║   Qualificação ──── preenche data ────────╫───╫──► Consulta Finalizada │ data      ║
║        │  │                               ║   ║         │              │           ║
║   24h  │  └── manual ──► Desqualificado   ║   ║  paciente escreve      │           ║
║        ▼                                  ║   ║         ▼              │           ║
║   Sem Resposta  (FU#1 + FU#2)             ║   ║   Reagendamento ───────┘           ║
║        │ 7 dias                           ║   ║         │ 7 dias                   ║
║        ▼                                  ║   ║         ▼                          ║
║   Nutrição Inativa  (sequência)           ║   ║   Paciente Inativo  (sequência)    ║
║                                           ║   ║      ▲        │                    ║
║   Administrativo                          ║   ║      └─ 60d ──┘ paciente escreve   ║
╚═══════════════════════════════════════════╝   ╚════════════════════════════════════╝
```

*(Tratamento Agendado / Tratamento Finalizado espelham Consulta nos mesmos caminhos.)*

---

## 2. Pipeline 1 · Vendas

### 1.1 Leads de Entrada
- **Entra:** lead criado por qualquer origem
- **Automação:** mensagem de recepção imediata. O conteúdo da 1ª mensagem do lead
  (template de anúncio) é ignorado pelo CRM
- **Sai:** ✅ **secretária responde** → *Qualificação* — mantém o gatilho de hoje
  (`auto:secretary-replied`), não o lead respondendo

### 1.2 Qualificação
Onde a secretária vende consulta ou tratamento.

| Saída | Gatilho |
|---|---|
| → **P2 · Consulta Agendada** | secretária preenche `consulta_agendada_em` + marca tracking **Converteu** 🔀 |
| → **P2 · Tratamento Agendado** | secretária preenche `procedimento_agendado_em` + **Converteu** 🔀 |
| → Desqualificado | manual |
| → Sem Resposta | **24h** sem mensagem do paciente |

🔀 = travessia entre funis, ver §4

### 1.3 Sem Resposta
- **Entra:** 24h de silêncio em Qualificação
- **Automação:** **FU#1** ao entrar · **FU#2** 48h depois
  > ⚠️ **Uma vez por lead, para sempre.** Lead que responde, volta e some de novo
  > **não** recebe os follow-ups outra vez.
- **Sai:** paciente responde → *Qualificação* · **7 dias** na coluna → *Nutrição Inativa*

### 1.4 Nutrição Inativa
- **Entra:** 7 dias em Sem Resposta
- **Automação:** sequência de mensagens de reengajamento
- **Sai:** paciente responde a qualquer mensagem → *Qualificação*

### 1.5 Desqualificado `terminal`
Manual. Sem automação.

### 1.6 Administrativo
Coluna de apoio. **Sem automação e fora do contador de inatividade.**

> Reaproveita a coluna **B2B / Stakeholders** (`23a7bfd7`) — só renomeia, mantendo o
> `stage_id`, para não gerar histórico órfão.

---

## 3. Pipeline 2 · Pacientes

### 2.1 Consulta Agendada · 2.2 Tratamento Agendado
- **Entra:** travessia do P1 (data preenchida) · retorno de *Reagendamento* · retorno
  de *Finalizada* (nova data)
- **Automação:** lembretes **24h antes** e **1h antes**
  > ⚠️ Hoje só existem para consulta. Os de tratamento serão criados depois.
- **Sai:**
  - manual → *Finalizada*
  - **secretária apaga a data** (falta ou cancelamento) → ***Reagendamento***

### 2.3 Consulta Finalizada · 2.4 Tratamento Finalizado
- **Entra:** ação manual da secretária
- **Automação:** pesquisa de satisfação (link de formulário Google) · **limpa o
  campo de data**
  > **Uma vez por lead, para sempre** — só na primeira entrada na coluna. Um
  > formulário de consulta e um de tratamento por paciente, no total. Não move card
  > nem espera resposta no WhatsApp (§6)
- **Sai:**
  - paciente escreve → *Reagendamento* **(automático)**
  - **60 dias** na coluna → *Paciente Inativo*

### 2.5 Reagendamento *(nova)*
A coluna de trabalho do P2 — equivalente de Qualificação.

- **Entra:** data apagada em Agendada · paciente escreve estando em Finalizada ·
  paciente responde estando em Paciente Inativo
- **Sai:** secretária preenche a data → *Agendada* · **7 dias** na coluna →
  *Paciente Inativo*

### 2.6 Paciente Inativo
- **Entra:** **60 dias** em Finalizada · **7 dias** em Reagendamento
  > Contagem a partir da **entrada na coluna** (`stage_changed_at`)
- **Automação:** sequência de reengajamento de longo prazo
- **Sai:** paciente responde → *Reagendamento* **(automático)**

---

## 4. Travessias entre funis

Só estas três. **Qualquer outra é recusada.**

| De | Para | Quem |
|---|---|---|
| P1 Qualificação | P2 Consulta Agendada | gatilho de data |
| P1 Qualificação | P2 Tratamento Agendado | gatilho de data |
| P2 qualquer | P1 Desqualificado | **só humano** |

### O que precisa ser construído

Hoje **nenhuma automação atravessa funil**: `resolveStageId` filtra por
`lead.pipeline_id`, então buscar coluna de outro funil devolve `null` e a regra
desiste em silêncio. Sem isso, a conversão — o evento mais importante — para de
funcionar no dia da separação.

1. **Resolver coluna por clínica**, não por funil. Seguro aqui porque nenhum nome de
   coluna se repete entre P1 e P2. Onde houver ambiguidade, a regra declara o funil
2. **Tabela de travessias permitidas.** O `pipelineMove` detecta origem e destino em
   funis diferentes e recusa o que não estiver declarado
3. **Histórico registra o funil** de origem e destino — sem isso não há como medir
   conversão, que é o motivo de separar

---

## 5. Migração das 12 colunas

| Hoje | Vai para | Nota |
|---|---|---|
| Leads de entrada | P1 Leads de Entrada | |
| Qualificação | P1 Qualificação | |
| Sem resposta | P1 Sem Resposta | |
| Nutrição Inativa (Geladeira de Leads) | P1 Nutrição Inativa | |
| Desqualificado / Fora de escopo | P1 Desqualificado | |
| **B2B / Stakeholders** | **P1 Administrativo** | renomeia, mantém `stage_id` |
| Consulta agendada | P2 Consulta Agendada | |
| Tratamento agendado | P2 Tratamento Agendado | |
| Consulta finalizada | P2 Consulta Finalizada | |
| **Tratamento Ativo** | **P2 Tratamento Finalizado** | renomeia |
| **Paciente antigo** (189 leads) | **P2 Paciente Inativo** | ⚠️ funde com a de baixo |
| **Nutrição Antigos** | **P2 Paciente Inativo** | ⚠️ fusão a confirmar |
| — | **P2 Reagendamento** | **nova** |

### O que morre

- **Sweep do dia 1º** (`auto:monthly-sweep`) — substituído pelos 60 dias
- Campos `ciclo_concluido` e `eh_paciente_antigo` como gatilhos de movimentação
- **Todo o código de movimentação por IA** (`auto:classifier-general`,
  `-nurture`, `-b2b`)
- Guard D3 — deixa de fazer sentido: Paciente Inativo passa a viver no P2
- O degrau de 3 dias do contador de inatividade
- `ruleConsultaPassou` (já era código morto)

---

## 6. Pesquisa de satisfação — não interfere no fluxo

A pesquisa é o envio de um **link de formulário Google**. O paciente responde fora
do sistema; **nenhuma mensagem volta para o WhatsApp** e nenhum card é movido por
causa dela.

Não é preciso nenhum tratamento especial. A regra de entrada em Reagendamento vale
normalmente: paciente escreve estando em Finalizada → Reagendamento.

> ℹ️ A pesquisa continua sendo **uma vez por lead, para sempre** (§6b) — decisão de
> negócio, não de fluxo: um formulário de consulta e um de tratamento por paciente.
>
> Consequência a ter em mente: as respostas ficam no Google Forms, fora do CRM.
> Nenhuma automação depende delas.

---

## 6b. "Uma vez por lead, para sempre"

Quatro automações precisam disparar **uma única vez na vida do lead**:

| Automação | Onde |
|---|---|
| Follow-up #1 | Sem Resposta, na entrada |
| Follow-up #2 | Sem Resposta, +48h |
| Pesquisa de satisfação (consulta) | Consulta Finalizada |
| Pesquisa de satisfação (tratamento) | Tratamento Finalizado |

**O mecanismo já existe pela metade.** Cada execução é registrada em
`automation_runs` por lead, e `recentlyRan()` bloqueia repetição dentro de
`cooldown_hours`. A pesquisa de satisfação da ÓR já está com **8760h (1 ano)** —
falta transformar em "para sempre".

**Solução:** campo `run_once` em `automations`. Quando marcado, a checagem ignora a
janela de tempo e pergunta apenas *"já rodou alguma vez para este lead?"*.
~5 linhas + 1 coluna, e resolve as quatro de uma vez.

✅ **Falha de envio — decidido.** `run_once` conta apenas runs com status
`success`, com **limite de 3 tentativas** por lead. Mantém a proteção contra o loop
infinito de julho (um lead chegou a 813 tentativas) sem condenar o paciente a nunca
receber a mensagem por causa de uma instabilidade momentânea.

> Contexto: hoje `recentlyRan` conta `success` **e** `error`. Com "uma vez para
> sempre", isso significaria que uma única falha de envio bloquearia o lead
> permanentemente, em silêncio.

### Nota sobre os relógios

A escada de follow-up **funciona com o mecanismo que já existe**, porque os
follow-ups estão ancorados na coluna *Sem Resposta*, não em Qualificação:

| Regra | Relógio | Mecanismo |
|---|---|---|
| Qualificação → Sem Resposta (24h) | silêncio do **paciente** | precisa de regra determinística |
| FU#1 (na entrada) · FU#2 (+48h) · → Nutrição (7d) | tempo **na coluna** (`stage_changed_at`) | `stage_idle` — já existe |
| Reagendamento → Paciente Inativo (7d) | tempo na coluna | `stage_idle` |
| Finalizada → Paciente Inativo (60d) | tempo na coluna | `stage_idle` |

`stage_changed_at` **não muda** quando a clínica envia mensagem — então o envio do
FU#1 não adia o FU#2. Só a transição de 24h precisa do relógio de silêncio do
paciente, porque ali o lead pode estar conversando ativamente.

---

## 7. Ordem de execução

| # | Etapa | Depende de |
|---|---|---|
| 1 | **Remover o código de movimentação por IA** | nada — pode começar já |
| 2 | Travessia entre funis no motor (§4) | — |
| 3 | Escada de follow-up com relógio único (`last_inbound_at`) e controle de "uma vez por lead" | — |
| 4 | Criar P2, coluna Reagendamento, renomear as duas colunas | 2 |
| 5 | Migrar os 1889 leads | 4 |
| 6 | Sequências e templates de mensagem | 4 |
| 7 | Lembretes de tratamento | cliente |

> A etapa 1 é pré-requisito de tudo: enquanto a IA move 64 cards por mês, qualquer
> teste da topologia nova fica contaminado.

---

## 8. Registro das decisões (11/08/2026)

| Tema | Decisão |
|---|---|
| Falta / cancelamento | Secretária apaga a data → Reagendamento |
| Gatilho "data apagada" | **Só vale** em Consulta Agendada e Tratamento Agendado |
| IA | **Deletar** o legado de movimentação. Fluxo só por gatilho |
| Paciente em conversa | Coluna Reagendamento |
| B2B | Vira Administrativo, reaproveitando a coluna |
| Lembretes de tratamento | Cliente cria depois |
| Risco clínico | Mantém como está — detecta e marca, sem ação |
| Administrativo | Fora do contador de inatividade |
| Paciente Inativo | 60 dias da entrada na coluna |
| Follow-up 24h/48h | **Uma vez por lead, para sempre** |
| Escada | 24h → Sem Resposta → FU#1 na entrada → FU#2 +48h → 7d → Nutrição |
| Entrada em Qualificação | Mantém o gatilho atual: **secretária** responde |
| Entrada em Reagendamento vinda de Finalizada | Automática |
| Prazo em Reagendamento | 7 dias → Paciente Inativo |
| Pesquisa de satisfação | Link de formulário Google · **uma vez por lead, para sempre** — 1 de consulta + 1 de tratamento · não move card |
| Contagem de "uma vez" | Só runs com `success`, **limite de 3 tentativas** |

**Desenho fechado.** Nenhum ponto em aberto.
