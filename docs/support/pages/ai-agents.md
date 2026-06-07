---
title: Agentes IA — `/ai/agents` e Wizard `/ai/agents/new`
topic: ai
kind: support
audience: user
updated: 2026-06-07
summary: "Vazio: *\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"Nenhum agente. Crie o primeiro.\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"*"
---
# 🤖 Agentes IA — `/ai/agents` e Wizard `/ai/agents/new`

## Para que serve
Central onde a clínica **cria, configura e mantém seus agentes de IA**: SDR, classificador, suporte, agendador etc. Cada agente tem prompt, chave do provedor (OpenAI/Anthropic/Google/xAI), base de conhecimento e ferramentas que pode executar.

## Quem acessa
- **Ver:** todos os membros (recurso `agents` no plano).
- **Criar / editar / excluir:** apenas **Owner**, **Admin** e **Super admin**.

---

## A) Listagem e edição — `/ai/agents`

### Layout
- **Sidebar esquerda** (~288px): card do **Construtor (Builder)** + lista de agentes.
- **Área principal**: edição do agente selecionado, em seções acordeão.

### Sidebar
- **Card do Construtor** (Builder) — agente do sistema usado pelo wizard. Mostra status e permite configurar a chave de API do Construtor.
- Cabeçalho **Agentes** com botões:
  - **✦ Assistente** → vai para o wizard (`/ai/agents/new`).
  - **＋** → cria agente em branco.
- Lista: ícone + nome · badge **padrão** (sistema, não excluível) · badge **off** (inativo).

Vazio: *"Nenhum agente. Crie o primeiro."*

### Cabeçalho do agente
- Nome editável inline.
- Badge de saúde.
- Badge **Rascunho / Produção** (clicável; rascunho só roda no Test Lab).
- **Modo: Simples / Modo: Avançado** (mostra campos técnicos).
- **Rodar em todos** (▶) — enfileira para todos os leads ativos.
- **Excluir** (🗑) — desabilitado em agentes padrão.
- **Salvar**.

**Alerta de inativo:** *"Este agente está inativo — Ele não responde leads enquanto estiver inativo. Ative para começar a usar."* + **Ativar agente**.

### Seções acordeão

| Seção | Conteúdo |
|---|---|
| **⚙️ Geral** | Toggle **Ativo** · **Nicho** (Genérico, Clínica/Saúde, Odontologia, Imobiliária, Restaurante/Food, E-commerce, SaaS, Advocacia, Educação, Estética/Beleza, Agência, Serviços locais, Outro) + **Aplicar KB do nicho** · **Descrição** · **Prompt do sistema** (8 linhas) |
| **🔑 Provedor & API key** | Provedor (OpenAI · Anthropic · Google · xAI · Manus) · Modelo (slider Econômico/Balanceado/Avançado no modo Simples, texto livre no Avançado) · API key · Base URL · Temperatura · Embedding (modelo + key) quando o provedor precisa |
| **🔧 Avançado (RAG & Comportamento)** | Top-K (1-20) · Iterações máx. (1-12) · Debounce s (1-120) · Reranker (Nenhum/Cohere/Jina/Voyage) + API key · Toggles **Busca híbrida · HyDE · Memória entre conversas · Modo Planning** |
| **🔌 Servidores MCP** | Nome + URL + **Adicionar** · lista com excluir |
| **🧪 Evals** | Pergunta de teste · Termos esperados (vírgulas) · **Adicionar caso** · **Rodar todos** · badges **passou / falhou** |
| **🛠️ Ferramentas** | Toggles por ferramenta, agrupadas: **Pipeline & Lead** (Mover estágio · Atualizar campo · Atualizar custom · Atribuir atendente) · **Conversa & Histórico** (Anotar · Ler histórico · Transferir para humano) · **Conhecimento & Memória** (Buscar na base · Memorizar fato) · **Agendamentos & Tarefas** (Criar tarefa · Agendar mensagem) |
| **📄 Base de conhecimento** | Sub-seções: **Texto manual** · **Importar URL** · **Importar lote de URLs** · **Importar PDF** · **Documentos (N)** (lista com ✏️ / 🗑) — modal de edição com **Salvar sem re-indexar / Salvar e re-indexar** |
| **💬 Co-piloto do agente** | Pedidos em linguagem natural → patches sugeridos para aplicar |
| **👥 Personas para teste** | Perfis sintéticos de clientes |
| **🌿 Estágios da conversa (beta)** | Etapas do diálogo |
| **🎓 Aprender com produção** | Padrões reais → sugestões |
| **🧪 Testar agente (Test Lab)** | Conversa simulada com o agente; pode gerar patch do prompt |
| **💰 Custos & limites** | Orçamento, gasto e teto mensal |
| **📋 Auditoria de mudanças** | Log de alterações |
| **💡 Insights & recomendações** | Sugestões automáticas com botão para aplicar |
| **🕑 Histórico de versões** | Versões anteriores do prompt + **Restaurar** |

### Toasts (principais)
*"Agente salvo"* · *"Agente ativado."* · *"Agente padrão do sistema não pode ser excluído — apenas desativado."* · *"Documento ingerido (N chunks)"* · *"URL ingerida (N chunks)"* · *"Lote: N/M ingeridas"* · *"PDF ingerido (N chunks, N páginas)"* · *"Erro PDF: …"* · *"Cole uma URL por linha"* · *"Documento atualizado. Re-indexe para refletir nas buscas."* · *"Documento atualizado e re-indexado (N chunks)."* · *"Título e conteúdo são obrigatórios."* · *"Documentos padrão do nicho aplicados"* · *"Enfileirado em N leads. Rodando em background."* · *"Patch anexado ao prompt. Lembre de salvar."* · *"Texto anexado ao prompt. Lembre de salvar."*.

---

## B) Wizard — `/ai/agents/new`

Guia passo a passo onde o **Construtor de Agentes** entrevista o usuário e gera o agente.

### Pré-requisito
A chave de API do **Construtor** precisa estar configurada na clínica. Se não estiver:

> **"Configure o Construtor de Agentes primeiro"** — *"Para criar agentes, o administrador da conta precisa configurar a chave de API do Construtor. Isso é feito uma única vez."* — **Configurar agora** (Admin).

### Layout
- Ícone ✦ + título **"Criar agente com assistente"** · subtítulo *"O Construtor te guia. Você pode pausar e retomar a qualquer momento."*
- **Stepper** de 5 etapas: **1 Nicho → 2 Objetivo → 3 Conexão → 4 Entrevista → 5 Prompt**.
- Rodapé: **← Cancelar / Voltar** · indicador *"Progresso salvo / Salvando… / Criando agente…"* · **Continuar →** (ou **✦ Criar agente** no passo 5).

### Passo 1 — Nicho
Pergunta: *"Qual é o seu negócio?"* Grid com cards: 🩺 Clínica · 🏠 Imobiliária · 🍽️ Restaurante · 🛒 E-commerce · 💻 SaaS · ⚖️ Advocacia · 🎓 Educação · 💆 Estética · 🦷 Odontologia · 🧩 Agência · 🔧 Serviços locais · ✨ Outro (com campo livre).

### Passo 2 — Objetivo
*"Qual é o objetivo deste agente?"*
- **Qualificar e agendar (SDR)** — recebe lead, descobre necessidade, agenda.
- **Classificar conversas** — identifica intenção e move o lead de etapa.
- **Suporte / dúvidas** — responde com base na KB, escala quando preciso.
- **Agendador** — foco em horários, confirmação e lembrete.
- **Outro fluxo** + campo livre.

Mudar nicho/objetivo após o prompt: toast *"… O prompt será regenerado no passo 5."*

### Passo 3 — Conexão
*"Conecte seu provedor de IA — Você usa sua própria chave. Validamos antes de prosseguir."*
- **Provedor**: OpenAI (GPT) · Anthropic (Claude) · Google (Gemini) · xAI (Grok).
- **Chave de API** (placeholder varia: `sk-...` / `sk-ant-...` / `AIza...` / `xai-...`).
- **Modelo** com sugestão padrão (`gpt-4o-mini` · `claude-3-5-haiku-latest` · `gemini-2.5-flash` · `grok-2-mini`).
- Avançado ▾: **Base URL (opcional)** para proxies/Azure.
- **Testar conexão** obrigatório. Badge **✓ Conexão validada** ou **⚠ Não testado**. Toast sucesso *"Conexão validada (N ms)"*.

### Passo 4 — Entrevista
*"Conte um pouco sobre o seu negócio — Perguntas geradas pelo Construtor."* Animação carregando enquanto a IA gera as perguntas.

Cada pergunta: label (obrigatórias com *) + badge de categoria (**Oferta principal · Tom · Tabu · Qualificação · Escalação · Contexto · Customizado**) + campo + dica.

Rodapé: link **Pular tudo com padrões** (toast *"Respostas preenchidas com padrões…"*) · link **Gerar perguntas de novo**.

### Passo 5 — Prompt
*"Prompt do agente — Gerado a partir das suas respostas."* Animação até ~30s; se passar de 60s sem resposta: **"Não conseguimos gerar o prompt agora"** + **Tentar novamente**.

Depois mostra:
1. **Textarea** com o prompt completo (somente leitura, mono).
2. Cards: **TEMPERATURE · TOP-K · MAX ITER.**
3. **Ferramentas sugeridas** (badges).
4. *"Por que assim:"* justificativa.
5. **Refinar com uma instrução** (ex.: *"Mais formal"*) · **Gerar do zero** · **Aplicar refinamento**.
6. **Nome do agente** (≥2 caracteres, máx 80).

**✦ Criar agente** → modal de sucesso *"Agente criado com sucesso! Seu agente está pronto, mas ainda está inativo…"* com **Ver agente sem ativar** ou **⏻ Ativar agente agora**.

### Toasts do wizard
*"Prompt gerado."* · *"Cláusula de contexto foi reinjetada automaticamente."* · *"Agente ativado."* · *"Dê um nome ao agente (2-80 caracteres)."* · *"Conexão com o provedor está incompleta."* · *"Gere o prompt antes de concluir."* · *"Rascunho recuperado — Seu agente '[nome]' já foi criado. Redirecionando…"*

## Relacionado
- `pages/ai-hub.md` (navegação geral de IA)
- `journeys/criar-primeiro-agente-ia.md`
- `troubleshooting/ia.md`
- `00-conceitos.md` (Agente, Builder, Prompt, KB, Ferramenta)
