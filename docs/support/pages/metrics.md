---
title: Módulo de Métricas — Documentação de Suporte (PT-BR)
topic: ai
kind: support
audience: user
updated: 2026-06-07
summary: O módulo de Métricas está **embutido dentro do hub de IA** (`AiHub`). Toda a navegação passa pela barra de abas horizontais no topo da seção `/ai`.
---
# Módulo de Métricas — Documentação de Suporte (PT-BR)

> **Versão analisada:** código-fonte em `src/pages/` e `src/pages/ai/AiHub.tsx`

---

## 1. Visão geral e como acessar

O módulo de Métricas está **embutido dentro do hub de IA** (`AiHub`). Toda a navegação passa pela barra de abas horizontais no topo da seção `/ai`.

| Aba | Rota principal | Rota alternativa | Feature flag |
|-----|---------------|-----------------|--------------|
| **Custos de IA** | `/ai/usage` | `/metrics/ai-usage` | `metrics_ai_usage` |
| **Relatórios Agendados** | `/ai/reports` | — | nenhuma (livre) |

> **Atenção:** As páginas `MetricsEngagement` (`src/pages/MetricsEngagement.tsx`) e `MetricsOps` (`src/pages/MetricsOps.tsx`) existem no código-fonte mas **não estão conectadas a nenhuma rota nem importadas pelo roteador atual** — são páginas órfãs. A aba de Engajamento (`/metrics/engagement`) redireciona para o AiHub sem exibir esse componente. O conteúdo dessas páginas está documentado nas seções 4 e 5 como **referência para implementação futura**.

---

## 2. Quem pode usar

### Aba Custos de IA (`MetricsAiUsage`)
- Restrita a **administradores e proprietários** da clínica (`role === "owner" || role === "admin"`) **ou** super-admins.
- Requer a feature flag **`metrics_ai_usage`** habilitada no plano.
- Usuários sem permissão são redirecionados para `/` (página inicial).
- Fonte: `src/pages/MetricsAiUsage.tsx:44–46`, `src/App.tsx:82,99`.

### Aba Relatórios Agendados (`ScheduledReports`)
- Sem restrição de papel explícita no código — qualquer usuário autenticado com acesso ao hub de IA pode acessar.
- Fonte: `src/pages/ai/AiHub.tsx:51–60`.

---

## 3. Aba: Custos de IA (`/ai/usage`)

**Componente:** `src/pages/MetricsAiUsage.tsx`  
**Título na tela:** "Custos de IA"  
**Subtítulo:** "Histórico detalhado de chamadas para a API de IA. Visível somente para administradores."

### 3.1 Filtros disponíveis

| Filtro | Tipo | Descrição |
|--------|------|-----------|
| **De** (data início) | Seletor de data | Padrão: 30 dias atrás |
| **Até** (data fim) | Seletor de data | Padrão: hoje |
| **Todos modelos** | Select | Filtra por modelo de IA (ex: gpt-4o) |
| **Todos agentes** | Select | Filtra por agente de IA configurado |
| **Todas operações** | Select | Filtra pelo tipo de operação executada |
| **Só erros** | Checkbox | Exibe apenas chamadas com status diferente de `success` |
| **Buscar…** | Campo de texto | Busca livre por modelo, operação, status, erro, agente ou lead |

Fonte: `src/pages/MetricsAiUsage.tsx:54–58, 373–389`.

### 3.2 Cards de resumo (KPIs)

| Card | O que significa para o usuário |
|------|-------------------------------|
| **Custo total** | Soma em dólares (USD) de todas as chamadas de IA no período filtrado |
| **Chamadas** | Quantidade total de vezes que a IA foi acionada |
| **Tokens (in/out)** | Palavras/fragmentos enviados para a IA (entrada) e recebidos (saída), em milhares |
| **Custo médio** | Custo médio por chamada de IA |
| **Erros** | Número de chamadas que falharam |

Fonte: `src/pages/MetricsAiUsage.tsx:311–317`.

### 3.3 Limite diário de IA (card `AiSpendLimitCard`)

Exibido no topo apenas para administradores com `clinic_id`. Mostra:
- Gasto do dia vs. limite configurado (barra de progresso colorida: verde < 50 %, âmbar 50–89 %, vermelho ≥ 90 %).
- Badges de status: **Não configurado**, **Bloqueado** (vermelho) ou **Ativo** (verde).
- Botão **Reativar agora** quando bloqueado (reativa por 15 minutos).
- Botão **Configurar** abre modal com:
  - Limite diário em USD
  - Toggle "Bloquear chamadas ao atingir 100%"
  - Thresholds de aviso: 50 %, 90 %, 100 %
  - E-mails de aviso (adicionar/remover)
- Fonte: `src/components/admin/AiSpendLimitCard.tsx`.

### 3.4 Gráfico: Custo por dia (top 6 modelos)

Gráfico de barras empilhadas mostrando o custo diário dividido pelos 6 modelos de IA mais usados no período. Cada cor representa um modelo. O eixo X exibe datas no formato `MM-DD`.  
Fonte: `src/pages/MetricsAiUsage.tsx:196–347`.

### 3.5 Cards de ranking (4 painéis)

| Painel | O que mostra |
|--------|-------------|
| **Por modelo** | Custo, número de chamadas, tokens de entrada/saída por modelo de IA |
| **Por agente** | Custo, chamadas e tokens por agente de IA configurado |
| **Top 20 leads** | Os 20 contatos/leads que mais geraram custo de IA; clicável para abrir o inbox do lead |
| **Por operação** | Custo e chamadas por tipo de operação (ex: chat, automação) |

Fonte: `src/pages/MetricsAiUsage.tsx:349–366`.

### 3.6 Tabela de detalhe de chamadas

Lista paginada (50 por página) com colunas: **Quando · Modelo · Op. · Agente · Lead · Tokens In · Tokens Out · Latência · Custo · Status**.

- Clicar em uma linha abre um painel lateral (**Sheet**) com todos os detalhes da chamada: ID, modelo, operação, agente, lead, thread, automação, tokens, latência, ferramentas chamadas, se respondeu, custo e erro completo.
- Fonte: `src/pages/MetricsAiUsage.tsx:393–479`.

### 3.7 Ações disponíveis

| Ação | Como acionar | Resultado |
|------|-------------|-----------|
| **Atualizar dados** | Botão com ícone de seta circular | Recarrega todas as chamadas do período selecionado |
| **Exportar CSV** | Botão "CSV" com ícone de download | Baixa arquivo `.csv` com todas as colunas filtradas (nome: `ai-usage-{de}_{até}-{timestamp}.csv`) |

Fonte: `src/pages/MetricsAiUsage.tsx:231–260, 293–299`.

### 3.8 Alerta de modelos sem preço

Quando existem chamadas de modelos desconhecidos (sem tabela de preço cadastrada), aparece um banner âmbar informando quantas chamadas aparecem com custo $0.  
Fonte: `src/pages/MetricsAiUsage.tsx:302–309`.

### 3.9 Estados vazios e loading

| Situação | Mensagem exibida |
|----------|-----------------|
| Carregando dados | `"Carregando…"` (texto na tela enquanto verifica autenticação) |
| Tabela sem resultados | `"Sem chamadas no período / filtro."` |
| Ranking sem dados | `"Sem dados."` |
| Usuário sem permissão | Redireciona para `/` silenciosamente |

Fonte: `src/pages/MetricsAiUsage.tsx:262–263, 430–432, 503`.

### 3.10 Dados técnicos

- **Tabela principal:** `ai_usage` (até 50.000 registros por consulta, paginada em lotes de 1.000)
- **Tabelas auxiliares:** `ai_agents` (nomes dos agentes), `leads` (nome/telefone do lead)
- **RPC:** `check_ai_spend_status`, `reactivate_ai_spend`
- **Tabela de limites:** `ai_spend_limits`

---

## 4. Aba: Relatórios Agendados (`/ai/reports`)

**Componente:** `src/pages/ScheduledReports.tsx`  
**Título na tela:** "Relatórios" (barra lateral) / sem título de página explícito

### 4.1 Layout

Layout de duas colunas:
- **Barra lateral esquerda (272 px):** lista de relatórios cadastrados, botão `+` para criar novo.
- **Área principal (direita):** formulário de configuração do relatório selecionado.

### 4.2 Como criar um relatório agendado

1. Clique no botão **`+`** no topo da barra lateral.
2. Um novo relatório chamado `"Relatório diário"` é criado automaticamente usando a instância de WhatsApp padrão.
3. Configure os campos no painel direito e clique em **Salvar**.

> **Pré-requisito:** pelo menos uma instância de WhatsApp deve estar cadastrada. Caso contrário, aparece o toast: `"Cadastre uma instância de WhatsApp primeiro"`.

Fonte: `src/pages/ScheduledReports.tsx:78–93`.

### 4.3 Campos de configuração

| Campo | Descrição |
|-------|-----------|
| **Nome** | Título identificador do relatório (editável inline) |
| **Ativo** | Toggle para habilitar/pausar o envio automático |
| **Instância WhatsApp** | Qual conexão de WhatsApp usará para enviar |
| **Horário (HH:MM)** | Hora do envio diário (formato 24 h) |
| **Grupo de destino** | JID do grupo WhatsApp destino (formato `numero@g.us`). Pode ser preenchido manualmente ou selecionado via botão "Buscar grupos" |
| **Dias da semana** | Seleção múltipla: Dom · Seg · Ter · Qua · Qui · Sex · Sáb |
| **Fuso horário** | Padrão: `America/Sao_Paulo` |
| **Métricas incluídas** | Checkboxes (ver seção 4.4) |

Fonte: `src/pages/ScheduledReports.tsx:222–327`.

### 4.4 Métricas disponíveis no relatório

| Chave interna | Label exibida |
|--------------|---------------|
| `unique_visitors` | Visitantes únicos |
| `whatsapp_clicks` | Cliques no WhatsApp |
| `form_leads` | Leads (formulário) |
| `whatsapp_leads` | Leads (WhatsApp) |

Fonte: `src/pages/ScheduledReports.tsx:37–42`.

### 4.5 Ações disponíveis

| Ação | Botão | Resultado |
|------|-------|-----------|
| **Salvar** | "Salvar" | Persiste configurações na tabela `scheduled_reports` |
| **Enviar agora** | "Enviar agora" (ícone de avião) | Dispara imediatamente via edge function `scheduled-report-tick` |
| **Excluir** | Ícone de lixeira | Exibe confirmação ("Excluir relatório? Esta ação não pode ser desfeita.") antes de remover |
| **Buscar grupos** | Botão com ícone de atualização | Chama edge function `evolution-fetch-groups` para listar grupos da instância selecionada |

Fonte: `src/pages/ScheduledReports.tsx:119–152`.

### 4.6 Histórico de execuções

O painel inferior do formulário exibe as **últimas 15 execuções** do relatório selecionado, com:
- Badge de status: **success** (azul) ou **error** (vermelho)
- Data/hora no formato pt-BR
- Prévia da mensagem enviada
- Mensagem de erro (quando houver)

Fonte: `src/pages/ScheduledReports.tsx:329–351`.

### 4.7 Validações e mensagens de erro/toast

| Situação | Mensagem |
|----------|----------|
| Grupo inválido (não termina em `@g.us`) | `"Selecione um grupo (JID precisa terminar com @g.us)"` |
| Horário em formato errado | `"Horário deve estar no formato HH:MM"` |
| Salvo com sucesso | `"Salvo"` (toast verde) |
| Relatório enviado | `"Relatório enviado"` (toast verde) |
| Falha no envio | `"Falha ao enviar"` ou mensagem de erro retornada |
| Nenhum grupo encontrado | `"Nenhum grupo encontrado nesta instância"` (toast info) |
| Sem instâncias cadastradas | `"Cadastre uma instância de WhatsApp primeiro"` |

Fonte: `src/pages/ScheduledReports.tsx:81–151`.

### 4.8 Estados vazios

| Situação | Mensagem |
|----------|----------|
| Nenhum relatório criado | `"Nenhum relatório. Crie o primeiro — envia automaticamente todo dia no horário escolhido."` |
| Nenhuma execução ainda | `"Sem execuções ainda."` |
| Nenhum relatório selecionado | `"Selecione ou crie um relatório agendado."` |

Fonte: `src/pages/ScheduledReports.tsx:189–193, 331–332, 198–200`.

### 4.9 Dados técnicos

- **Tabelas:** `scheduled_reports`, `scheduled_report_runs`, `whatsapp_instances`
- **Edge functions:** `evolution-fetch-groups` (buscar grupos), `scheduled-report-tick` (envio imediato/agendado)

---

## 5. Páginas de referência (não roteadas atualmente)

As páginas abaixo existem no código mas **não possuem rota ativa**. Estão documentadas para orientar suporte em casos de acesso direto por URL ou futura ativação.

### 5.1 Métricas de IA — Overview (`src/pages/Metrics.tsx`)

Rota histórica: sem rota ativa. Exibe resumo rápido de chamadas de IA sem controle de acesso.

**Filtro de período:** `24h` · `7 dias` · `30 dias` (padrão: 7 dias)

**Cards:**

| Card | Significado |
|------|------------|
| Chamadas | Total de chamadas de IA no período |
| Respondeu | Quantas resultaram em resposta enviada + percentual |
| Tokens | Total de tokens consumidos |
| Latência média | Tempo médio de resposta da IA em milissegundos |
| Tools usadas | Quantidade total de ferramentas (tools) acionadas pela IA |
| Erros | Chamadas com status diferente de `success` |

**Tabelas:** resumo por agente + log das últimas 30 chamadas (modelo, agente, tokens, latência, horário).  
**Estado vazio:** `"Sem dados no período."` / `"Sem chamadas registradas."`  
**Tabela:** `ai_usage`

### 5.2 Métricas de Engajamento (`src/pages/MetricsEngagement.tsx`)

Rota histórica: `/metrics/engagement` (redireciona para AiHub sem exibir este componente).

**Filtros:** `7d` · `30d` · `90d` (padrão: 30 dias)

**KPIs globais:**

| Card | Significado |
|------|------------|
| Mensagens enviadas | Total de mensagens despachadas em disparos e sequências |
| Respostas | Quantos leads responderam + taxa de resposta (%) |
| Qualificados | Leads que avançaram no pipeline após o envio + taxa (%) |

**Definições importantes (exibidas na interface):**
- **Resposta:** primeira mensagem do lead após o envio.
- **Qualificação:** lead avançou para uma coluna posterior no pipeline depois do envio (snapshot da coluna registrado no momento do envio; registros antigos não contam).

**Sub-abas:**
- **Sequências:** lista expansível. Ao clicar, exibe funis por passo (barra de progresso Enviadas / Respostas / Qualificados).
- **Disparos:** lista de campanhas com enviadas, respostas e qualificados.

**Estados vazios:**
- `"Nenhuma sequência com envios no período."`
- `"Nenhum disparo no período."`
- `"Sem envios desta sequência no período."`

**RPCs:** `engagement_broadcasts_summary`, `engagement_sequences_summary`, `engagement_sequence_steps`  
**Tratamento de erro:** `toast.error(mensagem_do_banco)` automático.

### 5.3 Métricas Operacionais (`src/pages/MetricsOps.tsx`)

Sem rota ativa.

**Filtros:** `24h` · `7 dias` · `30 dias` (padrão: 7 dias)

**KPIs:**

| Card | Significado |
|------|------------|
| Recebidas | Mensagens recebidas dos leads no período |
| Enviadas | Mensagens enviadas pela equipe no período |
| Conversas ativas | Leads distintos com movimentação no período |
| Novos leads | Leads criados dentro do período selecionado |
| 1ª resposta (média) | Tempo médio em minutos entre a primeira mensagem do lead e a primeira resposta da equipe |
| SLA estourado (>1h) | Leads com mensagens não lidas há mais de 1 hora |

**Gráficos e painéis:**
- **Volume por dia:** barras empilhadas (azul = recebidas, verde = enviadas) por data.
- **Por atendente:** mensagens enviadas e número de leads atendidos por membro da equipe.
- **Leads por etapa:** distribuição atual dos leads nas etapas do pipeline (barras proporcionais coloridas por etapa).

**Estados vazios:** `"Sem dados."` / `"Sem etapas."`  
**Tabelas consultadas:** `messages`, `leads`, `attendants`, `pipeline_stages`  
**Limite:** máximo de 5.000 mensagens por consulta no gráfico de volume.

---

## 6. Regras e limites gerais

| Regra | Detalhe |
|-------|---------|
| Volume máximo de registros (Custos de IA) | Até 50.000 linhas de `ai_usage` por consulta, carregadas em lotes de 1.000 |
| Período máximo no gráfico de custo/dia | 60 dias |
| Paginação da tabela de detalhe | 50 registros por página |
| Histórico de execuções | Últimas 15 execuções por relatório |
| SLA de resposta | Definido como 1 hora de mensagens sem leitura (fixo no código) |
| Mensagens no gráfico operacional | Limite de 5.000 registros |
| Fuso padrão para relatórios | `America/Sao_Paulo` |
| Reativação de spend bloqueado | 15 minutos de janela após reativação manual |

---

## 7. Referência rápida de arquivos

| Arquivo | Função |
|---------|--------|
| `src/pages/ai/AiHub.tsx` | Hub com abas; define quais páginas são visíveis por feature flag |
| `src/pages/MetricsAiUsage.tsx` | Página completa de Custos de IA (ativa) |
| `src/pages/ScheduledReports.tsx` | Relatórios agendados via WhatsApp (ativa) |
| `src/pages/Metrics.tsx` | Overview de IA simplificado (órfã) |
| `src/pages/MetricsEngagement.tsx` | Engajamento de disparos/sequências (órfã) |
| `src/pages/MetricsOps.tsx` | Métricas operacionais de atendimento (órfã) |
| `src/components/admin/AiSpendLimitCard.tsx` | Card de limite diário de gasto em IA |
| `src/lib/ai-pricing.ts` | Tabela de preços por modelo de IA |
| `src/App.tsx:82–102` | Definição das rotas de métricas |
