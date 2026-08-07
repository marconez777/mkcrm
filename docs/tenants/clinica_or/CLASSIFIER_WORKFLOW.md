# Clínica ÓR: Documentação do Workflow de Classificação (Classify)

Este documento descreve detalhadamente como o `pipeline-classifier` está configurado exclusivamente para a **Clínica ÓR**. Por ser a primeira clínica ou um caso de uso mais avançado, o pipeline da Clínica ÓR difere dos modelos simplificados (que usam apenas um tipificador) e roda um modelo complexo baseado em um **comitê de 5 agentes IA**.

## 1. Fluxo de Classificação: O Comitê de 5 Agentes

Quando um lead entra na fila de revisão da IA (`needs_ai_review`), o `pipeline-classify` invoca 5 agentes especialistas encadeados para a Clínica ÓR. Cada agente possui uma responsabilidade estrita:

1. **Summarizer (Extrator/Resumidor)**:
   - **Papel**: Lê o histórico recente do paciente e cria um resumo factual em PT-BR.
   - **Regras Críticas**: Separa PASSADO (tratamentos, pagamentos, consultas realizadas) de PRESENTE (o que o lead quer agora). Apenas afirma "pagamento recebido" ou "agendamento" se a secretária confirmar explicitamente (autoridade humana). Registra também as datas mencionadas (`mentioned_dates`).

2. **Agendador**:
   - **Papel**: Analisa apenas o resumo do Summarizer para definir a intenção da mensagem focada em agenda.
   - **Regras**: Define `scheduling_intent` (novo_agendamento, reagendamento, cancelamento, etc.).

3. **Typifier (Preenchedor)**:
   - **Papel**: Deduz e preenche os campos personalizados (custom fields) e tags baseando-se no resumo e campos atuais.
   - **Regras Críticas**: Só usa tags e campos da "whitelist". Nunca mexe em datas de consultas (são de controle estrito). Se for a 1ª mensagem do lead via template (anúncio), só preenche a "origem" e ignora interesses profundos até que o paciente responda de verdade.

4. **Movimentador**:
   - **Papel**: Define o estágio sugerido (`stage_suggestion`) no funil e a intenção geral (`intent`).
   - **Regras Críticas**: Conhece o funil completo da Clínica ÓR (Novo, Qualificação, Nutrição Inativa, Paciente Antigo, etc.). Tem uma trava estrita de Junho/2026: **não pode sugerir Consulta Agendada ou Consulta Finalizada**. Apenas a secretária tem esse poder. É treinado para ignorar "profissionais de saúde" comprando para si mesmos na hora de categorizar como "B2B".

5. **Maestro (O Juiz Final)**:
   - **Papel**: Recebe os inputs dos 3 agentes do meio (Agendador, Typifier, Movimentador) e cruza com os sinais determinísticos do banco de dados (ex: `manual_lock_until`).
   - **Regras Críticas**: Resolve conflitos. Exemplo: se o lead quer reagendar (Agendador) mas o Movimentador sugeriu o estágio "Novo", o Maestro corrige para "Qualificação". Além disso, aplica a trava de agendamento humano: se qualquer agente tentar mover para "Consulta agendada", o Maestro ignora a mudança de estágio e prioriza o controle humano.

---

## 2. Automações e Sequências

A Clínica ÓR possui automações de funil estritas (as quais são monitoradas e trigadas tanto por banco de dados quanto por agentes).

### Principais Automações (Configuradas via Banco e Edge Functions)
1. **Wakeup Inbound (Reativação Automática)**:
   - **Gatilho**: Quando o lead responde e ele está em estágios de geladeira ("Nutrição Inativa", "Sem Resposta", "Nutrição Antigos").
   - **Ação**: O gatilho de banco (agora corrigido) move o paciente instantaneamente de volta para o estágio de "Qualificação", injetando o motivo no histórico: *Paciente voltou a responder*.
   
2. **Follow-up e Geladeira Automática** (Planejados / Via `automations`):
   - Qualificação sem resposta por 48h → movido para "Sem resposta".
   - Sem resposta por 7 dias → movido para "Nutrição inativa".
   - Lembrar o paciente 24h antes da consulta baseando-se na data preenchida pela secretária.

---

## 3. Gestão de Custos e Consumo de IA

Como o modelo da Clínica ÓR utiliza um **comitê de 5 agentes por ciclo**, a volumetria de tokens e requisições à OpenAI (ou outro LLM) é consideravelmente maior do que em tenants simplificados (que usarão 1 agente ou o fallback Lovable AI).

### Mensuração de Custos:
- **Tabela `lead_ai_extraction_runs`**: Cada execução de IA (texto, visão, áudio) gera um registro nesta tabela. 
- **Tokens In / Out**: O consumo de tokens é medido separadamente para cada agente do comitê (Summarizer, Maestro, etc.).
- **Calculo de Custo**: A coluna `cost_usd` é atualizada a cada chamada. O dashboard de métricas da Clínica ÓR fará a soma (rollup) agrupando por `clinic_id`.
- **Limites de Orçamento (Spend Limits)**: 
  A configuração (`classifier_config`) da clínica impõe os limites diários:
  - `daily_budget_extractions`: Máximo de mensagens extraídas por dia (evita loops).
  - `max_extractions_per_lead_per_day`: Máximo que a IA gasta com um único lead por dia (evita exaustão por spam).
  - Configurado atualmente para: 10 extrações/dia por lead; 30 mensagens máximas no contexto para resumo.

### Faturamento (BYOK vs Plataforma):
- Se a clínica estiver no modelo **BYOK (Bring Your Own Key)** (chaves seguras na `clinic_secrets`), o custo não impacta o gateway principal da plataforma, e os limites de consumo são gerenciados pela chave do próprio cliente, embora as restrições diárias ainda protejam o volume de chamadas.
- Sendo 5 agentes, é estimado que o custo por "revisão de lead" seja cerca de 3 a 5 vezes maior na Clínica ÓR do que em novas clínicas que entrem pelo modelo unificado de 1 tipificador.
