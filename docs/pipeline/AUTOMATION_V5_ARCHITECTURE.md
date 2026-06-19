# Arquitetura e Automação do Pipeline de Agentes V5

Este documento é a **fonte de verdade** técnica sobre o funcionamento da classificação e movimentação de leads no CRM (Pipeline V5), projetado para operação 100% autônoma, garantindo que o sistema funcione com segurança, precisão e sem dependência humana para arrastar cards.

## 🧠 Arquitetura de 3 Agentes (`pipeline-classify/apply.ts`)

O processo de classificação funciona como uma "linha de montagem" de 3 Agentes de Inteligência Artificial para isolar responsabilidades e evitar sobrecarga cognitiva.

### 1. Agente 1: O Resumidor (Modelo Principal: `gpt-4o`)
- **Papel:** Extrai o que importa do histórico bruto do WhatsApp.
- **Como funciona:** 
  - Separa estritamente o **PASSADO** (procedimentos que já pagou, consultas anteriores) do **PRESENTE** (o que ele está pedindo agora).
  - Extrai as variáveis `mentioned_dates` com altíssima precisão (`{raw, anchor_iso, kind}`).

### 2. Agente 2: O Tipificador (Modelo Rápido: `gpt-5-mini`)
- **Papel:** Preenchimento da ficha e geração visual dos "Chips".
- **Como funciona:**
  - Roda em **PARALELO** com o Agente 3.
  - Deduz e aplica **Tags** estritamente dentro da whitelist (ex: `risco_clinico`).
  - Preenche os **Campos Personalizados** de agendamento (ex: `consulta_agendada_em`, `procedimento_agendado_em`), que renderizam os "Chips" coloridos no frontend.

### 3. Agente 3: O Maestro (Modelo Rápido: `gpt-5-mini`)
- **Papel:** Toma a decisão de negócio de para onde o card deve se mover.
- **Como funciona:**
  - Define o **Intent** (ex: `agendamento`, `objecao`, `desistencia`).
  - Emite o `stage_suggestion` baseado no fluxo da conversa (ex: "Consulta agendada").

---

## 🔒 Travas de Segurança (O Motor `pipelineMove`)

Toda movimentação *DEVE* passar pelo helper `pipelineMove` (`_shared/pipeline-move.ts`). Ferramentas isoladas como MCP (`ai-chat/index.ts`) e automações (`automations-tick/index.ts`) **não devem dar update bruto no banco**, mas sim consumir o `pipelineMove`.

### 1. Guard D3 (Trava de Paciente Antigo)
- Pacientes na coluna "Paciente Antigo" **JAMAIS** se movem via IA ou MCP tools para frente no funil.
- `if (fromStage === "Paciente antigo" && source !== "auto:inactivity-tick") return false;`
- Eles podem apenas ir para "Nutrição inativa" após 60 dias de silêncio, processados pelo cron `pipeline-deterministic`.
- Se eles agendam uma consulta, o *Tipificador* (Agente 2) altera os campos personalizados criando um chip "Consulta X", mas o card fica parado na mesma coluna.

### 2. Guard G10 Override (Override de Datas)
- Campos preenchidos por humanos ganham uma trava de edição de 7 dias (`custom_fields_last_human_edit`).
- **Exceção (V5):** Se o paciente remarca ou altera a data no WhatsApp e a IA capta (`isDateFromParser`), a IA ganha bypass explícito do G10 para registrar o novo "Chip" visual de data.

### 3. Limpeza Centralizada de Chips (Wipe)
- Chips pendurados causam confusão na secretária.
- Ao entrar em **"Consulta finalizada"** via `pipelineMove`, o sistema obrigatoriamente limpa os campos de agendamento anteriores.
- Ao sair de **"Qualificação"**, o sistema limpa o chip genérico "Interessado".

---

## ⏱️ Cron Jobs (Rotinas de Fundo e SLA)

O sistema de inatividade e lembretes opera através de uma malha de Cron Jobs (Supabase Edge Functions invocadas via pg_cron):

1. **`pipeline-deterministic/index.ts` (O Motor de Regras Fixas)**
   - **`ruleInactivityTick`**: O vigia implacável. Varre a inatividade.
   - *Regra V5*: Foca especialmente em tirar leads de "Paciente Antigo" que não falam nada há 60 dias e jogá-los para "Nutrição Inativa".
   - Executa também as amarrações do calendário formal (sync).

2. **`automations-tick/index.ts` (Automações da Interface / SLA 24h-48h)**
   - Roda a cada 5 minutos.
   - Executa as regras programadas pela clínica na Aba "Automações" (Trigger: `no_reply_after`).
   - É ele quem move o lead para "Sem Resposta" após 24 horas, ou manda follow-up de 48 horas.
   - Refatorado na V5 para usar `pipelineMove()`, respeitando idempotência e limpando os chips corretamente.

3. **`agent-followups-tick/index.ts`**
   - Roda para criar notas internas baseadas no tempo da coluna `agent_stages`. Integrado indiretamente ao Kanban.

4. **`watch-stale-leads/index.ts`**
   - Agente de retaguarda profunda. Busca estagnação extrema.

---

## 🕵️ AI Chat e MCP Tools (`ai-chat/index.ts`)

A clínica possui um Copilot/Chat onde a secretária pode pedir à IA para executar ações.
- As ações de movimentação de stage que a IA faz por trás dos panos (Tool: `move_lead_stage`) e atualizações de campos (Tool: `update_custom_field`) são validadas pelas regras de segurança centrais do `pipelineMove`.
- Se a IA tentar arrastar um Paciente Antigo para fora, ela receberá um block silencioso, protegendo o pipeline visual do médico.
