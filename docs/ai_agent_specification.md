# Especificação da Arquitetura do Agente de IA

Este documento descreve como o agente assistente de IA (atualmente conhecido sob a identidade técnica de **Antigravity**) opera dentro do ambiente do desenvolvedor, seus recursos computacionais, sua base de conhecimento e sua capacidade de comunicação com o projeto.

## 1. Identidade e Modelo Base

O assistente operando neste ambiente é alimentado pelo modelo **Gemini 3.1 Pro (High)** da Google DeepMind.
Ele atua primariamente via Pair Programming avançado (Agentic Coding), possuindo não apenas a capacidade de responder a perguntas, mas de interagir ativamente com o sistema operacional local, ler, criar e modificar arquivos reais, rodar comandos em terminais (PowerShell no caso de ambientes Windows), e propor mudanças estruturais em arquiteturas complexas antes de atuar através de "Modos de Planejamento".

## 2. Memória e Consciência de Estado

A "memória" do Agente difere de um modelo de chat convencional, baseando-se em um modelo contínuo acoplado ao ambiente local:

### Contexto Dinâmico (Metadados da IDE)
A cada interação do usuário, o agente recebe dados invisíveis do estado atual do desenvolvedor. Isso inclui dados sobre onde o cursor do usuário está, quais arquivos ele está vendo na IDE (ex: Cursor, VS Code) e sobre os diretórios de "Workspace" nos quais a conversa atua.

### Memória Histórica de Longo Prazo e Logs JSONL
Todo o histórico da conversa e os fluxos de pensamentos lógicos são guardados de forma contínua em formato `.jsonl` em:
`<appDataDir>\brain\<conversation-id>\.system_generated\logs\transcript.jsonl`

Isso funciona como uma fonte perene de **memória da sessão**. Se a conversa for muito longa (saindo da Context Window), o agente não "esquece" as coisas definitivamente; ele pode ativamente usar ferramentas (`grep`, etc) para ler seus próprios transcritos completos e relembrar passos executados horas ou dias atrás, ferramentas passadas, e detalhes que haviam saído do contexto imediato.

### Memória Organizada (Artifacts)
O agente organiza conhecimento técnico, relatórios e planos através de **Artifacts** (documentos estruturados em Markdown). Em vez de poluir a janela de chat, ele cria artefatos vivos (ex: `.md` de Planos de Implementação `implementation_plan.md`, listas de verificação `task.md` e tutoriais passo a passo `walkthrough.md`) no diretório temporário/persistente `brain`, que evoluem interativamente.

## 3. Base de Conhecimento e Customização

O comportamento, preferências e a base de conhecimento técnica do Agente são controlados pelas **Customizations** dinâmicas, carregadas das pastas de workspace local. Existem duas vertentes principais:

### 3.1. Skills (Habilidades Customizadas e Rotinas)
Armazenadas nos diretórios locais `.agents/skills/` (no projeto) ou no diretório Global do Sistema. 
Cada Skill atua como uma expansão do cérebro do agente para uma tarefa específica. Uma "Skill" é uma pasta composta obrigatoriamente por um `SKILL.md` contendo instruções restritas e diretas.
*Exemplo prático no ambiente atual:* O diretório `.agents/skills/docs-maintainer/SKILL.md` obriga o agente a manter todos os mais de 146 arquivos da pasta de documentações `docs/` sincronizados automaticamente quando ele edita arquivos fonte de código (como rotas, ou Edge Functions). Quando acionado pelo contexto, o agente acopla esse conhecimento sem que o usuário precise pedir tudo do zero.

### 3.2. Rules (Regras Comportamentais)
Registradas no arquivo `AGENTS.md` (Global ou `.agents/AGENTS.md` do projeto).
Configuram constraints técnicas, restrições e guias arquiteturais, por exemplo: estilos de documentação, tecnologias padrão e proibições arquiteturais.

## 4. Comunicação, Subagentes e Assincronicidade

A arquitetura do Agente é orientada a eventos (**Event-Driven Reactive Messaging**), o que o torna um trabalhador autônomo.

### Trabalhadores Virtuais (Subagentes)
O agente central principal pode delegar o trabalho "spawnando" (invocando) subagentes secundários simultâneos (ex: o subagente `research` usado exclusivamente para rastrear e ler grandes blocos do projeto enquanto o agente original continua executando outras tarefas).
Agentes e Subagentes possuem IDs de conversação únicos e não poluem o chat com o humano. Eles se comunicam apenas via rede local da IA, trocando mensagens entre si de forma isolada, organizando resultados massivos de informação para só então o Agente-Chefe resumir para o humano.

### Wakeup Reativo e Tasks (Cron Jobs)
A IA nunca precisa ficar ociosa processando loops de espera ou travando a tela caso rode uma compilação de código grande.
Quando um script demorado é jogado no background, ou quando agentes secundários são ativados, a execução principal encerra o turno. Uma notificação no nível do sistema "acorda" a IA instantaneamente e de forma reativa tão logo essas tarefas longas sejam concluídas ou resultem em erros — permitindo um workflow assíncrono.
O agente até mesmo possui a capacidade de criar Cron Jobs internos e Timers para atuar em projetos ou rodar scripts periodicamente em nome do usuário sem que ele precise dar "Enter".
