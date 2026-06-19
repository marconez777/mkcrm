# Arquitetura e Automação do Pipeline de Agentes V3

Este documento detalha o funcionamento técnico e de negócios da automação de classificação e movimentação de leads no CRM (Pipeline V3), garantindo segurança, precisão e economia.

## 🧠 Arquitetura de 3 Agentes

O processo de classificação foi dividido em uma "linha de montagem" de 3 Agentes de Inteligência Artificial para isolar as responsabilidades e evitar que um único modelo se confunda com o excesso de informações ("sobrecarga cognitiva").

### 1. Agente 1: O Resumidor (Modelo Principal: `gpt-4o`)
- **Papel:** É o cérebro que lê toda a bagunça do histórico de mensagens cruas, limpa o ruído e extrai o que importa.
- **Como funciona:** 
  - Executa primeiro de forma isolada.
  - Separa estritamente o **PASSADO** (o que o lead já fez, procedimentos que já pagou, consultas anteriores) do **PRESENTE** (o que ele está pedindo ou dizendo na última mensagem).
  - Produz um resumo conciso de 3 a 4 linhas.
  - Extrai proativamente datas brutas citadas ("quinta às 15h", "24/06") e identifica modalidades de atendimento (presencial/online).

### 2. Agente 2: O Tipificador (Modelo Rápido: `gpt-5-mini`)
- **Papel:** Responsável apenas pelo preenchimento da ficha médica/cadastral do lead.
- **Como funciona:**
  - Roda em **PARALELO** com o Agente 3.
  - Não lê o histórico cru, lê **apenas** o resumo perfeito do Agente 1.
  - Deduz e aplica as **Tags** (ex: `risco_clinico`, `emt`, `ketamina`).
  - Sugere os dados para preencher os **Campos Personalizados** (ex: profissão, motivo da consulta).

### 3. Agente 3: O Maestro (Modelo Rápido: `gpt-5-mini`)
- **Papel:** Responsável pelo destino do lead no funil de vendas (Kanban) e pela detecção da intenção do lead.
- **Como funciona:**
  - Roda em **PARALELO** com o Agente 2.
  - Lê o resumo do Agente 1 somado a **sinais determinísticos** (como: quanto tempo o lead está em silêncio, se já foi paciente antes, etc).
  - Sugere a **Coluna (Stage)** exata para onde o card deve ir.
  - Define o **Intent** (Intenção da conversa: ex: `agendamento`, `objecao`, `duvida_geral`, `desistencia`).
  - Emite um Nível de Confiança (`confidence` de 0.0 a 1.0) para sua decisão.

---

## 🔒 Travas de Segurança e Condições Determinísticas

Mesmo que a Inteligência Artificial tome uma decisão, o código de orquestração (`apply.ts`) avalia a sugestão da IA contra regras rígidas do negócio. Se a IA violar uma regra, a sugestão é descartada.

### 1. Trava de Movimentação (General Move Guard)
Para que o Maestro consiga mover fisicamente um card de coluna, ele precisa passar por duas condições rigorosas:
- **Confiança Mínima:** A IA deve ter `confidence >= 0.8` (80% de certeza). Se ela estiver em dúvida, o card não se move automaticamente para evitar estragar o funil.
- **Anti-Conflito Humano (24h):** Se um **humano** arrastou o card daquele lead para qualquer coluna nas últimas 24 horas, a automação fica estritamente **proibida** de mover o lead de novo. O humano sempre tem prioridade.

### 2. Trava de Paciente Antigo vs Retorno
Muitas vezes a IA se confundia ao ver que um lead já fez tratamento no passado e jogava ele para a coluna "Paciente Antigo", mesmo quando o paciente estava tentando marcar uma nova consulta.
- **A Regra:** Se o sistema sabe que ele já foi tratado (`treated_before=true`), mas o lead está tentando agendar um acompanhamento, a intenção é fixada em `agendamento_retorno` e a IA é **obrigada** a jogá-lo em **"Consulta agendada"**, proibindo o envio para "Paciente antigo". O status "Paciente antigo" é reservado apenas para inatividade prolongada (> 6 meses) ou alta clínica.

### 3. Trava de Nutrição Inativa (Interesse sem fechamento)
Lida com aquele paciente que "some" depois de ouvir o preço.
- **A Regra:** Se o lead tem uma objeção, pede desconto recusado ou diz que "vai pensar", e o histórico revela que ele **parou de responder a secretária ou a IA por mais de 4 horas** (`hours_since_last_message > 4`), a IA é orientada a forçar a intenção para `objecao` e a coluna para **"Nutrição inativa"**. O lead não tem permissão para ficar eternamente esquecido na coluna "Qualificação".

### 4. Trava de Proteção de Campos (Janela G10)
A IA tenta preencher os campos personalizados, mas a palavra do operador humano é sagrada.
- **A Regra:** Se um humano editou um campo personalizado específico (ex: "Profissão") nos **últimos 7 dias**, a Inteligência Artificial é sumariamente ignorada para aquele campo, mesmo que ela tenha uma nova sugestão. 

### 5. Trava de Tags Protegidas
Existem tags críticas de controle financeiro ou médico que a automação **jamais pode remover**, mesmo que o Agente 2 ache que não fazem mais sentido para o contexto da conversa.
- **Lista de tags blindadas:** `risco_clinico`, `paciente_antigo`, `b2b`, `vip`, `precisa_atencao_humana`, `lock_manual`.

---

## ⚙️ Gatilhos (Triggers) e Sincronização Determinística

Para evitar que o pipeline dependa exclusivamente da IA para coisas lógicas, existe uma camada inteira de regras de banco de dados (PostgreSQL) que agem no exato milissegundo em que um dado é alterado.

Esses **Triggers** chamam uma função especial (`pipeline-deterministic`) via rede (`net.http_post`) para reordenar os leads sem passar pela OpenAI:

1. **`tg_auto_novo_lead`**: Dispara assim que um lead entra no CRM, ativando a rotina de "novo-lead".
2. **`tg_auto_secretary_replied`**: Dispara instantaneamente quando a secretária (humana ou um bot) envia uma mensagem para o lead. Ele avisa o sistema que o lead foi atendido, tirando ele do SLA de "aguardando atendimento" ou movendo-o da caixa de "sem resposta".
3. **`tg_auto_appointment_sync`**: Fica observando os agendamentos. Se um agendamento for Concluído, Cancelado ou Criado, ele muda a coluna do card no Kanban de imediato (ex: move para "Consulta finalizada").
4. **`tg_auto_field_changed`**: Observa cada dígito nos campos personalizados. Se um humano digitar a data de nascimento, o trigger registra isso e aciona a "Trava da Janela G10", impedindo a IA de sobrescrever por 7 dias.

---

## ⏱️ Cron Jobs (Rotinas de Fundo / Ticks)

O sistema conta com 4 "trabalhadores" invisíveis que rodam continuamente no servidor de tempos em tempos (Crons). Eles são a espinha dorsal da automação do funil:

1. **`pipeline-classify-tick`**: Varre o CRM de minuto em minuto procurando leads que receberam mensagens novas e invoca a "Linha de Montagem" de Agentes (Resumidor, Tipificador, Maestro) apenas para os cards que precisam de classificação.
2. **`pipeline-inactivity-tick`**: Busca leads que foram esquecidos ou que pararam de interagir há muitos dias e dispara regras de "geladeira" (ex: forçar o envio do lead para Nutrição Inativa se ele sumiu).
3. **`pipeline-reactivation-tick`**: O caçador de "ressurreições". Procura leads muito antigos (perdidos no banco) que de repente mandaram um "Oi, quero marcar" e move eles de volta ao topo do pipeline.
4. **`pipeline-human-reactor-tick`**: Audita as ações do operador humano no Kanban para ativar as "Travas Anti-Conflito" (ex: garante o bloqueio de movimentação via IA nas próximas 24h).

---

## ⚡ Tratamento de "Cold Starts" e Timeouts

Executar a LLM em nuvem pode sofrer atrasos de rede. Para garantir a confiabilidade:
- Se a requisição à OpenAI exceder limites rígidos, os agentes 2 e 3 foram arquitetados para rodarem ao mesmo tempo (Paralelização em `Promise.all`), em vez de sequencialmente.
- Isso significa que o tempo total de processamento agora é o `Tempo do Resumidor + o MAIOR tempo entre Tipificador e Maestro`, cortando de 12 a 15 segundos do tempo total da requisição e escapando completamente do limite rígido de 55 segundos de timeout do servidor (Edge Functions).
- Se a conta exceder limites do modelo primário (`gpt-4o`), o sistema tem fallback automático validado para operar com o modelo secundário (`gpt-5-mini`), com instruções estritas que previnem omissão de dados.
