# Matriz de Responsabilidades: UI, Banco de Dados e IA (Clínica ÓR)

Este documento esclarece exatamente onde cada regra de negócio vive no sistema da Clínica ÓR. Isso é vital para saber **onde** procurar e **onde** consertar quando o sistema apresentar um comportamento inesperado (ou quando for necessário criar uma regra nova).

---

## 1. Responsabilidades da Interface de Usuário (UI)
As configurações feitas na tela do sistema (Frontend) ditam regras que rodam baseadas em tempo ou ações humanas diretas.

* **Ligar/Desligar Automações de Tempo:** A limpeza de pipeline (ex: empurrar leads parados há 48h para "Sem Resposta", ou enviar inativos para a "Geladeira" após 7 dias) é 100% controlada pelos "switches" na UI de Automações. A IA não faz isso sozinha.
* **Sobrescrita Humana (Lock de 7 dias):** Toda vez que um humano altera manualmente um Campo Personalizado (Custom Field) ou Tag pela UI, o sistema cria uma trava (Gate 10). Pelos próximos 7 dias, a IA fica proibida de modificar esse campo.
* **Lock Vitalício de Origem:** Se a secretária preencher a "Origem" do lead pela UI, a IA nunca mais poderá tocar nesse campo.
* **Movimentação Proibida (Conflito 24h):** Se a secretária mover o card de coluna, a IA fica proibida de sugerir novas colunas nas próximas 24 horas.

---

## 2. Responsabilidades do Banco de Dados (PostgreSQL / Triggers)
O banco de dados é o "Guarda-Costas" hiper-reativo. Ele age instantaneamente, muito antes da Inteligência Artificial ser chamada. Se algo precisa acontecer no milissegundo em que uma mensagem chega, está aqui.

* **Reativação Automática (Wakeup Inbound):** Quando um lead que está na "Nutrição Inativa" ou "Sem Resposta" envia qualquer mensagem (um simples "oi"), é o banco de dados quem o puxa instantaneamente de volta para a coluna "Qualificação".
* **Filtros de Risco (Palavras-chave emergenciais):** Se o paciente enviar palavras como "suicídio" ou "me matar", o banco de dados intercepta e aplica a tag `risco_clinico = true` imediatamente.
* **Desqualificação Rápida:** Filtros como "EMDR" (procedimento não atendido) aplicam a desqualificação direto no banco.
* **Fila de Espera da IA:** É o banco quem avisa a IA que tem trabalho a fazer. Ele marca `needs_ai_review = true` assim que uma nova mensagem entra.
* **Congelamento B2B:** Se a secretária move um card para "B2B / Stakeholders", o banco marca `is_b2b: true`, o que bloqueia a IA de gastar dinheiro/tokens lendo mensagens desse número para sempre.

---

## 3. Responsabilidades da Inteligência Artificial (LLMs / Edge Functions)
A IA age como um "Copiloto de Triagem". Ela tem a missão de ler contextos longos e interpretar textos não estruturados, mas **não tem o poder de forçar ações críticas sem supervisão.**

* **Resumo e Fatos:** Lê o bolo das últimas 30 mensagens e sumariza o que é "Passado" e o que é o "Pedido Presente", extraindo as datas mencionadas.
* **Interpretação de Intenção:** Detecta se a mensagem é um pedido de reagendamento, cancelamento, dúvida técnica, objeção ou desistência.
* **Preenchimento Cauteloso:** Preenche dados como "procedimento de interesse" e aplica tags da whitelist, desde que o campo não esteja bloqueado pelo humano (Gate 10).
* **Movimentação de Triagem:** Pode sugerir que o lead vá da fase "Novo" para "Qualificação", ou sugerir que ele está com objeções.
* **OBEDIÊNCIA CEGA:** A IA é restrita e tem conhecimento do seu limite. **Ela não tem permissão para agendar pacientes**. Ela nunca move leads para colunas como "Consulta Agendada" ou "Consulta Finalizada". O robô ("Maestro") é instruído a jogar essa responsabilidade 100% para a secretária.

---

### Resumo (Onde eu mexo se...?)
* O lead não sai do estágio parado? → **Vá na UI (Automações)** e veja se o switch está Ativo.
* O lead mandou mensagem e não saiu da Nutrição Inativa? → **Vá no Banco de Dados** e cheque os Logs de Trigger de erro.
* A IA sugeriu uma intenção bizarra (ex: achou que era novo agendamento, mas era reclamação)? → **O problema é no LLM / Prompt da IA**.
