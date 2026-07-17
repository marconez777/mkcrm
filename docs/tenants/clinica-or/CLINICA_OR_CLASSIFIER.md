# 🧠 Classifier Config & Fluxo de Pipeline - Clínica ÓR

Este documento mapeia o fluxo completo de um lead dentro da Clínica ÓR, detalhando cada inteligência embutida, regras de movimentação, triggers de banco de dados e automações ativas.

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

## 2. Fluxo da Vida de um Lead (Mapa do Funil)

```mermaid
graph TD
    A[WhatsApp - Lead envia msg] --> B{Gatilho: trg_lead_needs_extraction}
    B -->|Grava mensagem| C(Marca needs_ai_review = true)
    C --> D[Edge Function: pipeline-classify]
    
    subgraph Inteligência Artificial V6 (Maestro)
        D --> D1(Agente 1: Summarizer)
        D --> D2(Agente 2: Agendador)
        D --> D3(Agente 3: Typifier)
        D --> D4(Agente 4: Movimentador)
        D1 & D2 & D3 & D4 --> D5{Agente 5: Maestro - Juiz Final}
    end
    
    D5 -->|Ação| E{Sugestão de Estágio / Tag}
    E --> F[Atualiza Lead no Kanban]
    E --> G[Automações Tick Monitoram o Lead]
```

---

## 3. Comportamento da Inteligência Artificial V6

O pipeline da Clínica ÓR conta com o **Classifier V6**. Quando uma mensagem chega, 5 Agentes Especializados atuam simultaneamente, guiados por *prompts* estritos. Abaixo as regras de negócio de cada um:

### 3.1 Agente 1: Summarizer (Resumo Factual)
- Lê o histórico recente e separa em PASSADO e PRESENTE.
- **Regra de Ouro:** A palavra da secretária é a que vale. O robô só afirma que algo foi pago ou agendado se a secretária confirmar, ignorando falsas afirmações de pacientes.
- Extrai as datas com precisão.
- Se for a primeira mensagem pré-fabricada de botão de rede social, ele a ignora para intenção e pega apenas a "Origem".

### 3.2 Agente 2: Agendador (Intenção de Agenda)
Tenta extrair uma destas 5 intenções puras de agenda baseada no resumo:
`novo_agendamento`, `reagendamento`, `cancelamento`, `duvida_agenda`, `nenhum`.

### 3.3 Agente 3: Typifier (Preenchedor de Campos e Tags)
Pega informações do lead e preenche campos do banco de dados (ex: `risco_clinico`, `procedimento_interesse`, etc).
- **Proibição Exata:** Ele **NUNCA** preenche campos como `consulta_agendada_em`. Essa responsabilidade pertence unicamente à secretária humana.
- Preserva o campo `Origem` se ele já tiver sido setado por um humano anteriormente.

### 3.4 Agente 4: Movimentador (Intenção de Funil)
Ele define a fase oficial para onde o lead deve pular. As lógicas:
- **Novo:** Primeira interação.
- **Qualificação:** Secretária em diálogo para converter.
- **Sem resposta:** Parou de responder durante a qualificação.
- **Nutrição inativa:** Resfriou, achou caro, não fechou.
- **Paciente Antigo:** Regra especial! Se o lead pedir **renovação de receita** ou citar que "o Dr. X já atendeu", ele vai direto para Paciente Antigo e NÃO para qualificação.
- **B2B / Stakeholders:** Fornecedores, representantes comerciais, laboratórios. Médicos procurando tratamento para eles mesmos **não são B2B**, vão para o funil normal de paciente.

### 3.5 Agente 5: Maestro (Juiz Final)
Resolve conflitos entre os outros 4 robôs:
- **Trava Estrita de Agendamento Humano:** A IA está **TERMINANTEMENTE PROIBIDA** de mover um lead sozinha para as colunas: `Consulta agendada`, `Tratamento agendado`, `Consulta finalizada` e `1ª Sessão Finalizada`. Se algum Agente tentar fazer isso, o Maestro barra o movimento e deixa em Qualificação.
- Se a confiança for baixa (menor que 60%), ele não move o card.
- Se houver `manual_lock_until` (alguém ativou a trava), ele não move o card.

---

## 4. Regras e Filtros de Banco de Dados (Gatilhos SQL)

Abaixo do capô, os gatilhos no PostgreSQL atuam detectando *palavras de emergência* instantaneamente antes mesmo da IA analisar:

- **Risco Clínico Absoluto:**
Se o lead disser palavras como *"me matar", "suicídio", "não aguento mais viver", "vontade de morrer"*, o sistema tagueia **instantaneamente** `risco_clinico = true`.
- **Desqualificação Automática (Procedimento Não Atendido):**
A Clínica ÓR não atende pacientes buscando **EMDR** (Dessensibilização e Reprocessamento). Se citado, o lead recebe o selo `desqualificado` automaticamente, economizando tempo do humano e da IA.
- **Filtros Iniciais (Procedimentos):**
Citações a "cetamina", "EMT", "psicoterapia", geram auto-preenchimento no campo `procedimento_interesse`.

---

## 5. Automações Ativas (`automations-tick`)

O sistema tem um motor em background que roda a cada 5 minutos (Edge Function `automations-tick`). Ele procura por leads caídos em "limbo" nas regras de Estágio Parado.

### 5.1 Sem Resposta (`no_reply_after`)
**O que faz:** Monitora leads que a secretária tentou contato e o cliente sumiu.
- **Tempo:** Aguarda 72 horas (configurável no Painel de Automações).
- **Como funciona:** O script olha para a última mensagem da conversa. Se a última mensagem for `from_me = true` (ou seja, foi enviada pela Clínica) e já passou o tempo sem o cliente responder, ele roda o robô.
- **Ação:** O lead é movido da "Qualificação" para a coluna "Sem resposta".
- *(Nota de Auditoria 17/07: Esta regra foi consertada. Antes rodava ao contrário, ignorando a clínica e prendendo leads)*.

### 5.2 Estágio Parado (`stage_idle`)
**O que faz:** Varre o CRM inteiro procurando cards mofando na mesma coluna há muito tempo.
- **Ação:** Se o lead fica parado na "Qualificação" (ou outra fase de entrada) por mais dias do que o SLA permite, ele sofre um `move_stage` automático. Para leads não-convertidos, geralmente vão para a Geladeira (Nutrição inativa).

### 5.3 Cooldown de Segurança
Todas as automações acima operam debaixo de um sistema de segurança:
- Quando o robô executa ação sobre um lead (com sucesso ou falha na tentativa), ele injeta um tempo de espera no banco de dados (`recentlyRan`). O lead não pode ser atacado novamente por robôs por várias horas.
- *(Nota de Auditoria 17/07: Esta regra foi consertada. Antes ignorava erros, causando loop infinito)*.

---

Este ecossistema inteiro opera perfeitamente integrado no Lovable Cloud, requerendo apenas um deploy nas `Edge Functions` e atualizações de banco pelo `SQL Editor` (mantendo migrations `supabase/migrations/` seguras na base do projeto) toda vez que uma alteração crítica é feita.
