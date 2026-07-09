# Visão Geral do Pipeline — Clínica ÓR

## Introdução
O Pipeline da **Clínica ÓR** (`clinic_id = cf038458-457d-4c1a-9ac4-c88c3c8353a1`, pipeline `17c27f4d-8256-4ea7-b5b9-ed706494f686`) é um fluxo de atendimento kanban altamente automatizado. Ele integra um **Motor de Regras Determinísticas** (Rule Engine) com um **Classificador LLM V6** (linha de montagem de agentes de IA) para orquestrar o lead desde a entrada até o pós-atendimento.

## Arquitetura de Decisão
1. **Rule Engine (Código Puro):** Gerencia gatilhos de tempo, ações da secretária (Reator Humano), agendamentos de sistema e portões de segurança (Gates).
2. **Classificador LLM:** Uma esteira de 5 agentes que extraem contexto (Resumidor), analisam intenções e datas em paralelo (Agendador, Tipificador, Movimentador), e emitem um veredito (Maestro).

## Fases do Pipeline (Stages)
O funil possui estágios renomeados e ajustados para o ciclo de vida do paciente psiquiátrico/terapêutico:

1. **Leads de entrada:** Triagem inicial.
2. **Qualificação:** Momento de nutrição quente.
3. **Sem Resposta:** Para onde o lead vai após 2 tentativas automáticas de contato sem sucesso.
4. **Nutrição Inativa (Geladeira de Leads):** Congelamento após 7 dias no estágio "Sem Resposta".
5. **Consulta agendada:** Paciente com horário marcado.
6. **Consulta finalizada:** Paciente atendido.
7. **Tratamento agendado:** Migrado do antigo "Procedimento agendado".
8. **1ª Sessão Finalizada:** Quando o paciente inicia o ciclo de tratamento.
9. **Paciente Antigo:** Estágio fixo onde o paciente permanece para novos agendamentos sem retroceder (possui um "Lock D3" contra IA).
10. **Nutrição Antigos (>60d):** Geladeira para pacientes antigos sem contato há mais de 2 meses.

## Regras Temporais de Fluxo (Ciclo de Vida)
- **Qualificação → IA Follow-up #1:** Disparado após 24h sem resposta.
- **Qualificação → IA Follow-up #2:** Disparado após 48h sem resposta.
- **Qualificação → Sem Resposta:** Se não houver retorno após o Follow-up #2.
- **Sem Resposta → Nutrição Inativa:** Após 7 dias estacionado.
- **1ª Sessão Finalizada → Paciente Antigo:** Todo dia 1º do mês via cronjob (`pipeline-monthly-cycle-or`).
- **Paciente Antigo → Nutrição Antigos (>60d):** Após 60 dias sem interações inbound.
- **Qualquer Geladeira → Qualificação:** Ao receber uma mensagem inbound (webhook Evolution).

## Segurança (Lock D3 e G10)
A IA obedece a regras de bloqueio (Gates). O mais notável na Clínica ÓR é o **Guard D3 (Paciente Antigo)**: A IA e o Motor Automático nunca tiram o paciente deste estágio ao fazerem novos agendamentos; eles apenas anexam tags. Além disso, o **Gate G10** impede que a IA sobrescreva campos customizados (ex: datas de consulta) editados manualmente por humanos nos últimos 7 dias.
