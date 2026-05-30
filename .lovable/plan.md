# Métricas de Engajamento — Disparos e Sequências

## O que vai ser entregue

Uma página nova em **Métricas › Engajamento** (`/metrics/engagement`) que mostra, para cada disparo em massa e cada sequência de WhatsApp:

- Quantos leads receberam
- Quantos responderam (taxa de resposta)
- Quantos qualificaram (avançaram no pipeline ou chegaram em coluna final / "ganho")
- Para sequências: **funil por passo** — ver qual mensagem está convertendo mais

Filtros: período (últimos 7/30/90 dias, customizado), pipeline (para qualificação), e busca por nome.

## Definições

- **Resposta** = primeira mensagem inbound do lead depois do envio (lógica que já existe no `broadcast_mark_replied` e `mark_lead_replied`).
- **Qualificação** = lead que, após o envio, mudou de coluna no pipeline para uma posição maior que a coluna onde estava no momento do envio, OU chegou em uma coluna marcada como `is_terminal=true` do tipo ganho. MVP: contamos como qualificado se o `stage_id` mudou para uma posição maior depois da data do envio.

## Como vai funcionar (técnico)

### 1) Migration

**a) Tracking de resposta por passo da sequência**
- Adicionar coluna `replied_at timestamptz` em `message_sequence_runs`.
- Atualizar a função `mark_lead_replied` (já existente) para, além de parar a sequência (`status='stopped_by_reply'`), carimbar `replied_at = now()` no run mais recente (`status='sent'`) de cada enrollment ativo do lead.

**b) Snapshot da coluna no momento do envio (para medir qualificação)**
- Adicionar `stage_id_at_send uuid` e `stage_position_at_send int` em:
  - `broadcast_recipients`
  - `message_sequence_runs`
- Preencher no momento do envio (edge functions `broadcast-tick` e `sequence-tick`) com a coluna atual do lead.
- Backfill: deixar nulo para registros antigos (a página ignora qualificação quando nulo).

**c) Funções de agregação** (SQL `SECURITY DEFINER` com escopo de clinic, leem `current_clinic_id()`)
- `engagement_broadcasts_summary(from_ts, to_ts)` → lista de broadcasts com `sent, replied, qualified, reply_rate, qualify_rate`.
- `engagement_sequences_summary(from_ts, to_ts)` → lista de sequências com totais agregados.
- `engagement_sequence_steps(sequence_id, from_ts, to_ts)` → por step: `sent, replied, qualified`.
- `engagement_lead_list(kind, source_id, status, from_ts, to_ts)` → lista de leads (id, nome, telefone, respondeu_em, qualificou_em) para a tabela drill-down.

### 2) Edge functions
- `sequence-tick`: ao inserir `message_sequence_runs` com `status='sent'`, popular `stage_id_at_send` e `stage_position_at_send` lendo o lead.
- `broadcast-tick` (ou função equivalente que insere recipients/marca sent): popular as mesmas colunas.
- Nenhuma mudança no `evolution-webhook` — ele já chama `broadcast_mark_replied` e `mark_lead_replied`.

### 3) Frontend

**Nova página `src/pages/MetricsEngagement.tsx`** com:
- Filtro de período (DateRangePicker) + filtro de pipeline.
- Cards de KPI no topo: total enviado, total respondido, total qualificado, taxa de resposta global, taxa de qualificação global.
- Aba **Disparos**: tabela com nome, enviado, respondido (%), qualificado (%), data. Clique abre drawer com a lista de leads e link pro inbox.
- Aba **Sequências**: lista de sequências com totais. Ao expandir uma, mostra **funil por passo** (passo 1 → passo 2 → …) com barras horizontais de `sent / replied / qualified` por passo.

**Rota e nav**
- Adicionar `<Route path="/metrics/engagement" element={<FeatureRoute feature="metrics_engagement"><MetricsEngagement /></FeatureRoute>} />` em `src/App.tsx`.
- Adicionar entrada "Engajamento" no menu de Métricas (AppShell) e no CommandPalette.
- Feature flag opcional `metrics_engagement` (ou reutilizar `broadcasts`/`sequences`).

### 4) Fora de escopo desta entrega
- Não cria dashboard de email (já existe em `EmailReports`).
- Não muda a lógica de stop_on_reply nem a aba "Inscritos" da sequência.
- Não conta resposta em janela X dias (MVP usa "qualquer resposta depois do envio"); fácil de adicionar depois.

## Resumo do que muda

```text
DB
 ├── message_sequence_runs:  + replied_at, stage_id_at_send, stage_position_at_send
 ├── broadcast_recipients:    + stage_id_at_send, stage_position_at_send
 ├── função mark_lead_replied: também carimba replied_at no run
 └── 3 RPCs de agregação para a página

Edge
 ├── sequence-tick:  popular snapshot da coluna ao enviar
 └── broadcast-tick: popular snapshot da coluna ao enviar

Frontend
 ├── src/pages/MetricsEngagement.tsx (nova)
 ├── App.tsx: rota /metrics/engagement
 └── AppShell + CommandPalette: link "Engajamento"
```
