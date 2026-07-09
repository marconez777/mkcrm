# Manual de Criação de Agentes de Pipeline (MKCRM)

**Objetivo:** Padronizar a construção e o deploy de novos Agentes de Pipeline para diferentes contas/clientes (tenants) dentro do CRM, assegurando coerência arquitetural, segurança e facilidade de manutenção.

---

## 1. Princípios Arquiteturais (A Regra de Ouro)

Antes de escrever qualquer linha de código, todo Agente de Pipeline no MKCRM deve obedecer a estes 4 pilares:

1. **Observador Silencioso:** O Agente de Pipeline **NUNCA** responde ao lead. Ele não gera texto para o usuário final. Sua função é estritamente de *leitura e orquestração*. Ele escuta as mensagens (da secretária ou do Agente de Atendimento), processa o contexto e move o card de coluna no Kanban.
2. **Treinamento Hardcoded:** O cliente/usuário do CRM **NÃO** tem acesso para editar o *System Prompt* ou as regras do classificador de pipeline. Toda a engenharia de prompt, esquemas de validação e restrições (ex: RAG) ficam isolados e protegidos dentro do código-fonte (backend/edge functions).
3. **Configuração Restrita na UI:** O que o cliente consegue fazer pela interface (em *Configurações > IA do Pipeline*) é apenas ativar/desativar a automação do funil e fornecer sua própria chave de API (OpenAI/Gemini).
4. **Hibridismo (Rule Engine vs LLM):** Nunca use IA para resolver o que um simples `if/else` pode fazer. Aproxime gatilhos transacionais (como pagamentos de Stripe) de Webhooks determinísticos. Deixe a IA (Classificador) apenas com a tarefa de detectar intenções e extrair parâmetros textuais.

---

## 2. Roadmap: Guia Passo a Passo de Criação

Sempre que precisar plugar o pipeline de uma nova conta, siga o fluxo abaixo:

### Passo 1: Mapeamento de Regras de Negócio e Estágios
*Entenda o processo do cliente (ex: Clínica OR vs Febracis).*
- Desenhe as colunas do Kanban (Estágios).
- Separe o que é **Gatilho Sistêmico** (ex: Webhook de pagamento, Cron de 48h sem resposta).
- Separe o que é **Gatilho de IA** (ex: Identificar falta de dinheiro, identificar intenção de reembolso).
- Crie um arquivo `docs/<cliente>-pipeline.md` documentando esse rascunho.

### Passo 2: Estrutura e Banco de Dados (Seed)
- Insira as colunas na tabela `pipeline_stages` atreladas ao `pipeline_id` correto.
- Defina as *Tags Automáticas* (`auto_tag_on_enter`) que serão aplicadas sempre que um card entrar em determinada coluna.
- Se a conta exigir Contexto extra (RAG, tabela de serviços, regras de agenda), mapeie e preencha as tabelas base para que o LLM tenha de onde puxar informação no futuro.

### Passo 3: Configuração do Rule Engine (Regras Determinísticas)
*A IA só deve entrar depois que as regras burras e exatas estiverem rodando.*
- Configure as *Cron Jobs* necessárias para aquela conta (ex: `pipeline-inactivity-tick` para arrastar leads frios para a Geladeira).
- Plugue os endpoints transacionais. Exemplo: Webhook da Stripe bate em uma edge function que atualiza o `status` financeiro do Lead, disparando a trigger de PostgreSQL que move o card instantaneamente para a coluna "Comprou".

### Passo 4: Implementação do Agente Classificador (LLM)
*Aqui é onde o cérebro silencioso entra (geralmente em `supabase/functions/pipeline-classify/`).*
1. **System Prompt & Role:** Defina como a IA deve ler o histórico. Instrua que o papel dela é emitir a intenção e sugerir o novo estágio.
   * **Best Practice (Custo O(1)):** Utilize o padrão de **Resumo Incremental** (Rolling Summary). Em vez de injetar o histórico inteiro do lead, injete o resumo atualizado (`ai_summary`) e as mensagens recebidas *após* a última leitura (via watermark `last_processed_message_id`).
2. **Output Schema (Zod):** Formate a saída de forma estruturada. A IA não devolve texto livre. Ela deve devolver JSONs rigorosos contendo `intent`, `suggested_stage_id`, `confidence`, etc.
3. **Restrições Fortes:** Escreva no prompt os portões de segurança (*Gates*). Ex: "Você está terminantemente proibido de mover o card se a tag X estiver presente".
4. **Pipeline Paralelo (Opcional):** Se o fluxo for denso (como o da Clínica ÓR), considere usar a "Linha de Montagem de Múltiplos Agentes", onde um LLM resume, outro extrai datas, outro sugere tags, e um "Maestro" consolida a decisão.
5. **Telemetria e Custos (Obrigatório):** Todo agente de pipeline **deve** registrar o seu consumo na tabela `ai_usage` (ex: `classifier:maestro`, `classifier:agendador`). É crucial que as requisições gerem essas entradas para que o consumo apareça corretamente na tela de **Custos de IA** do painel do cliente, permitindo auditoria e cobrança adequadas.

### Passo 5: Aplicação e Auditoria (Post-Move)
- A saída do Classificador LLM deve passar pela validação em código (`apply.ts`) e enfim cair na função `_shared/pipeline-move.ts` para que o movimento seja registrado no histórico (`lead_stage_history`).
- (Recomendado) Acople os **Agentes Auditores**: Pequenos processos baratos que rodam de madrugada (Position Auditor) ou logo após o movimento (Post-Move Verifier) só para dar uma segunda opinião em caso de falsos positivos do classificador principal, lançando tarefas para humanos em vez de reverter o card sozinhos.
