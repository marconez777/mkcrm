## Objetivo

Criar uma tela de **Histórico de uso da API de IA** com detalhamento por chamada (modelo, tokens, custo USD, agente, lead, ação), visível apenas para o **admin da clínica** (e super admin global). Já temos a tabela `ai_usage` populada — falta exibir com custo calculado e permitir filtragem/auditoria.

Em paralelo, investigar o pico recente nos créditos da OpenAI usando os dados que já temos.

---

## O que será entregue

### 1. Tabela de preços por modelo (frontend, estática)
Mapa `model → { input_per_1m, output_per_1m }` em `src/lib/ai-pricing.ts` cobrindo os modelos atualmente em uso (gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini, gpt-5-nano, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite, embeddings text-embedding-3-*). Cálculo: `cost = input_tokens * in/1M + output_tokens * out/1M`.

> Valores ficam em código (fáceis de atualizar) — sem tabela nova no banco.

### 2. Nova página `/metrics/ai-usage`
Acessível só para `is_clinic_admin` (e super_admin). Adicionada ao menu junto com as outras métricas.

**Layout:**
- **Cards de resumo** (período selecionado): custo total USD, tokens totais, nº de chamadas, % erro, custo médio por chamada.
- **Filtros**: período (24h / 7d / 30d / customizado), modelo, agente, operação (chat/embed/tool), status, "só com erro".
- **Gráfico** custo por dia empilhado por modelo (barras).
- **Top consumidores**:
  - Por agente (custo, chamadas, tokens)
  - Por modelo (custo, tokens in/out)
  - Por lead (top 20 leads que mais custaram — ajuda a achar loop/spam)
  - Por operação (chat vs embed vs tool)
- **Tabela detalhada** (paginada, 50/pág, ordenável):
  `data | modelo | operação | agente | lead (link) | input | output | total | latência | status | custo USD | erro`
  Linha clicável abre drawer com detalhes completos (incluindo `automation_id`, `thread_id`, mensagem de erro).
- **Export CSV** do filtro atual.

### 3. RLS / acesso
`ai_usage` já tem `clinic_scoped` (RLS por `clinic_id`). Não precisa de migração — apenas guard de rota no frontend (`is_clinic_admin` no `useAuth`). Atendentes comuns não veem.

### 4. Investigação do pico (entrego junto)
Rodo consultas em `ai_usage` para os últimos 14 dias e te mostro:
- Custo por dia × modelo (achar qual modelo disparou)
- Top 10 agentes que mais consumiram nos últimos 3 dias vs. semana anterior
- Top 10 leads que mais consumiram (loop de auto-reply?)
- Operações com `tools_called` alto (possível loop de tool-calling)
- Chamadas com `total_tokens` anormalmente grandes (RAG retornando contexto enorme?)

Resultado vai como nota no chat para você decidir se ajustamos algo (ex.: baixar `max_iterations`, trocar modelo default, limitar `rag_top_k`).

---

## Detalhes técnicos

- Arquivos novos:
  - `src/lib/ai-pricing.ts` — tabela de preços + função `calcCost(model, in, out)`.
  - `src/pages/MetricsAiUsage.tsx` — página completa.
- Arquivos editados:
  - `src/App.tsx` — rota `/metrics/ai-usage` protegida.
  - `src/components/AppShell.tsx` — item de menu "Custos IA" visível só para admin da clínica.
- Sem mudanças em edge functions, sem migração de banco.
- Query base: `supabase.from("ai_usage").select("*").gte("created_at", ...)` com paginação via `.range()`.
- Para somatórios do período inteiro (sem trazer 50k linhas pro browser), uso uma RPC simples `ai_usage_summary(since, until)` retornando agregados por modelo/agente/dia. **Essa sim precisa de migração** (uma função `SECURITY INVOKER`, respeita RLS automaticamente).

---

## Fora do escopo (posso fazer depois se quiser)

- Limites/alertas de gasto por clínica (ex.: avisar quando passar de X USD/dia).
- Tela equivalente para o super_admin global ver custo agregado de todas as clínicas.
- Armazenar `cost_usd` calculado direto na linha do `ai_usage` (hoje calculo no front).
