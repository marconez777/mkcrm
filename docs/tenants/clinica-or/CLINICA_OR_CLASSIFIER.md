# 🧠 Classifier Config & Fluxo de Pipeline - Clínica ÓR

Este documento mapeia o fluxo completo de um lead dentro da Clínica ÓR, detalhando cada inteligência embutida, regras de movimentação, triggers de banco de dados e automações ativas.

> **⚠️ IMPORTANTE (V7 Determinístico):** Este documento foi atualizado para refletir o **isolamento** da Clínica ÓR. A arquitetura anterior (V6) que usava IA para mover cards foi **depreciada** aqui. A movimentação é 100% determinística.

---

## 1. Mapeamento Oficial de IDs (Pipeline ÓR)
*(ID da Clínica: `cf038458-457d-4c1a-9ac4-c88c3c8353a1`)*

| Nome da Coluna | ID (`stage_id`) |
| :--- | :--- |
| **Leads de entrada** | `b1aa2fc9-d221-4d4f-b53a-7303ec4b75b0` |
| **Qualificação** | `c6eb67f3-cba9-41e5-949c-aa12d34d962d` |
| **Sem resposta** | `9f408ae6-649e-44b2-bc56-f93d138c87ed` |
| **Consulta agendada** | `e12f004a-6445-4815-8d6b-22f928507a9a` |
| **Consulta finalizada** | `7584241f-6e4b-4824-aaea-e271e865227d` |
| **Tratamento agendado** | `98320189-6002-4f75-b99d-0b407189efe8` |
| **1ª Sessão Finalizada** | `2a352661-01e2-41f8-be10-032f803e2387` |
| **Paciente antigo** | `7fea97d7-c2af-4e6f-8f39-af8375bb4468` |
| **Nutrição Antigos** | `9de8e54e-7edb-47dd-b613-de22276d8ea1` |
| **Nutrição Inativa** | `64356dbe-3889-4b49-9429-260501cdb3d8` |
| **B2B / Stakeholders** | `23a7bfd7-2baf-4d0f-8ed1-2b59b719020d` |
| **Desqualificado / Fora de escopo** | `35670cad-3f95-4e11-8f73-e8b27b865f89` |

---

## 2. Fluxo da Vida de um Lead (Mapa do Funil V7)

```mermaid
graph TD
    A[WhatsApp - Lead envia msg] --> B{Gatilho: trg_lead_needs_extraction}
    B -->|Grava mensagem| C(Marca needs_ai_review = true)
    C --> D[Edge Function: pipeline-classify]
    
    subgraph Inteligência Artificial V7 (Apenas Leitura)
        D --> D1(Agente 1: Summarizer)
        D --> D2(Agente 2: Typifier)
    end
    
    D1 & D2 --> E[Atualiza Resumo e Tags no Lead]
    
    subgraph Motor Determinístico (Rule Engine)
        E -. Secretária lê e agenda .-> F(Move: Agendado)
        E -. Inatividade Temporal .-> G(Move: Geladeira)
        E -. Tag B2B Aplicada .-> H(Move: Desqualificado/B2B)
    end
```

---

## 3. Comportamento da Inteligência Artificial V7

O pipeline da Clínica ÓR teve seus agentes de tomada de decisão (Agendador, Movimentador e Maestro) desativados por hardcode (Bypass de `clinic_id` em `agent-core.ts`). 
Hoje, apenas 2 Agentes atuam para acelerar a leitura humana:

### 3.1 Agente 1: Summarizer (Resumo Factual)
- Lê o histórico recente e separa em PASSADO e PRESENTE.
- **Regra de Ouro:** A palavra da secretária é a que vale. O robô só afirma que algo foi pago ou agendado se a secretária confirmar.
- Não converte datas, apenas devolve a string crua e o ISO da mensagem.

### 3.2 Agente 2: Typifier (Preenchedor de Campos e Tags)
Pega informações do lead e sugere **Tags** (`tags_suggested`).
- **Gatilho Indireto de B2B:** Embora a IA não mova o card, se ela identificar fornecedores/vendedores e sugerir a tag `b2b`, um gatilho de sistema joga o card imediatamente para a coluna "Desqualificado / B2B".
- **Proibição Exata:** Ele **NUNCA** preenche campos de data de consulta. Isso é feito unicamente pela secretária.

---

## 4. Regras e Filtros de Banco de Dados (Gatilhos SQL)

Abaixo do capô, gatilhos no PostgreSQL atuam detectando palavras ou tags instantaneamente:

- **Risco Clínico Absoluto:**
Se o lead disser palavras como *"me matar"*, o sistema tagueia **instantaneamente** `risco_clinico = true`.
- **Desqualificação Automática (B2B/Procedimentos):**
A Clínica ÓR não atende pacientes buscando **EMDR**. Se citado, o lead recebe o selo `desqualificado`. Se for vendedor, a tag `b2b` o envia para a coluna de desqualificados.
- **Filtros Iniciais (Procedimentos):**
Citações a "cetamina", "EMT", geram auto-preenchimento no campo `procedimento_interesse`.

---

## 5. Automações Ativas (`automations-tick` e SLAs Determinísticos)

O sistema tem um motor em background que roda a cada 5 minutos (Edge Function `automations-tick`). Tudo aqui é temporal e exato (Rule Engine).

### 5.1 Sem Resposta (`no_reply_after`)
- **Tempo:** Aguarda 48 horas (configurável) na fase de Qualificação.
- **Como funciona:** Se a última mensagem for da Clínica (`from_me = true`) e estourou o tempo, o robô atua.
- **Ação:** O lead é movido da "Qualificação" para "Sem resposta".

### 5.2 Estágio Parado (`stage_idle` - Geladeiras)
Varre o CRM procurando cards inativos:
- **Nutrição Inativa (Geladeira Curta):** Se o lead ficar 7 dias parado em "Sem Resposta", ele desce automaticamente para a "Nutrição inativa".
- **Nutrição Antigos (Geladeira Longa):** Se um "Paciente Antigo" ficar mais de 60 dias sem interagir com a clínica, ele é movido para "Nutrição Antigos" para campanhas.

### 5.3 Cooldown de Segurança
- Ao atuar, a automação aplica um tempo de espera (`recentlyRan`). O lead não pode ser engatilhado repetidas vezes pela mesma automação em loop.

### 5.4 Virada de Mês (Limpeza Mensal)
- **Ação:** Disparada todo dia 1º, o cron `pipeline-monthly-cycle-or` move todos os leads das fases "Consulta Finalizada" e "1ª Sessão Finalizada" silenciosamente para a gaveta de "Paciente Antigo".
