# Glossário do Pipeline e Runtime V6

Este documento define os termos-chave utilizados na arquitetura do Pipeline V6.

## Conceitos de Arquitetura e IA
*   **Classifier (Classificador V6):** O sistema de inteligência artificial principal responsável por ler o histórico do lead e determinar a próxima ação. Na V6, opera como uma "Linha de Montagem de 5 Agentes".
*   **Resumidor (Agente 1):** Agente responsável por extrair um resumo factual do histórico do paciente e identificar datas mencionadas.
*   **Agendador (Agente 2a):** Agente especializado em identificar sinais de agendamento, reagendamento ou cancelamento.
*   **Tipificador / Preenchedor (Agente 2b):** Agente focado em aplicar tags e preencher custom fields (dados dinâmicos do lead).
*   **Movimentador (Agente 2c):** Agente focado exclusivamente em deduzir o estágio correto e a intenção principal do lead.
*   **Maestro (Agente 3):** O agente consolidador final. Recebe as saídas dos agentes 2a, 2b e 2c e resolve eventuais contradições.
*   **Fallback:** O mecanismo de contingência do sistema. Exemplo: se o provedor Lovable (Gemini) falhar ou sofrer rate limit, o sistema realiza um fallback para OpenAI BYOK.
*   **Token / Usage:** A contabilidade de uso do LLM. Registrado de forma granular por cada sub-agente na tabela `ai_usage`.

## Conceitos de Domínio
*   **Lead:** Um paciente em potencial ou existente que interage com a clínica.
*   **Stage (Estágio):** A coluna atual do lead no Kanban do CRM (ex: "Novo", "Qualificação", "Consulta agendada").
*   **Pipeline:** O funil completo contendo a progressão dos stages de um lead.
*   **Tags:** Marcadores aplicados aos leads (ex: `urgencia_clinica`, `precisa_atencao_humana`). O Classifier V6 segue uma whitelist restrita para sugerir tags.
*   **Custom Fields:** Campos personalizados de formulário atrelados a um lead (ex: `status_financeiro`, `interesse_consulta`).
*   **Canon (Nome Canônico):** O nome padronizado de um stage no código (ex: "Paciente antigo"), usado pelo sistema para resolver IDs de stage no banco de forma resiliente.
*   **B2B:** Contato comercial (parceiros, laboratórios, fornecedores) que não segue o fluxo normal de paciente.

## Regras e Mecanismos
*   **Watermark:** O ID da última mensagem processada com sucesso pelo Classifier (`last_processed_message_id_classifier`). Evita que o sistema reprocesse as mesmas mensagens várias vezes.
*   **General Move:** O mecanismo automatizado que move um lead no funil com base em sugestões da IA com alta confiança (≥ 0.8) quando validado contra histórico recente.
*   **Gate / Guardrails:** Regras de segurança absolutas que impedem a IA de realizar ações destrutivas (ex: o Guard D3 bloqueia saídas automáticas do stage "Paciente antigo").
*   **G10:** Um mecanismo de proteção (Gate 10) garantido pelo banco de dados que impede a IA de sobrescrever edições em campos feitas por humanos nos últimos 7 dias.
*   **Reator Humano:** A lógica no código que escuta ações humanas manuais e reage atualizando o estado do pipeline ou inserindo tasks apropriadas, diminuindo a carga de dedução da IA.
*   **Regras Determinísticas:** Ações baseadas puramente em lógica de código e gatilhos (sem LLM), processadas via `pipeline-deterministic` (ex: Lembretes, regra de 1ª consulta).
