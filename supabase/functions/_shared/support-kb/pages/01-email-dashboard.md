# Email Dashboard

**Rota:** `/email`  
**Arquivo:** `src/pages/email/EmailDashboard.tsx`  
**Título da página:** `"Email — Dashboard"`

---

## Como acessar

Aba **Dashboard** no Email Hub ou navegando direto para `/email`.

## Quem pode usar

Qualquer membro com acesso ao módulo de Email Marketing (sem verificação de role adicional — herda do EmailHub).

---

## Layout da tela

### 1. Cabeçalho
- Título: **"Email Marketing"**
- Legenda com timestamp de última atualização em tempo real.
- Seletor de período (botões inline): **24h** · **7 dias** · **30 dias** · **90 dias**  
  (`EmailDashboard.tsx:70-74`)
- Botão **Atualizar** (dispara `load()` manualmente)

### 2. Cards de métricas (4 colunas)
| Card | Métrica exibida |
|---|---|
| **Entregues** | Total de envios no período |
| **Falhas** | % de falhas + contagem absoluta |
| **Abertura** | % de abertura + contagem absoluta |
| **Cliques** | % de cliques + contagem absoluta |

Fonte: `EmailDashboard.tsx:353-374`

### 3. Gráfico de atividade ao longo do tempo
- Tipo: **AreaChart** (Recharts) com 3 séries: Entregues / Abertos / Cliques
- Eixo X: hora (modo 24h) ou data (modos 7/30/90 dias)
- Fonte: `EmailDashboard.tsx:377-407`

### 4. Saúde de envio + Funil (2 colunas)
- **Coluna esquerda:** `DomainHealthCard` — taxa de bounce, taxa de reclamação, mini-sparkline 30d
- **Coluna direita:** Funil com barras de progresso (Entregues → Abertos → Clicaram)
- Fonte: `EmailDashboard.tsx:410-435`

### 5. Distribuição de status + Cota diária (2 colunas)
- **Pie chart** de status dos envios
- **Cota diária:** barra de progresso `enviados_hoje / cota`; fica vermelha quando > 90%
- **Fila:** mini-cards com Pendentes e Falhas
- Fonte: `EmailDashboard.tsx:440-500`

### 6. Top templates (BarChart horizontal)
- Exibe até 8 templates com mais envios no período
- Fonte: `EmailDashboard.tsx:502-518`

### 7. Tabela "Últimos envios"
- Exibe até 50 linhas filtradas
- Colunas: Template · Destinatário · Assunto · Status · Quando
- Estado vazio: *"Nenhum envio"*
- Fonte: `EmailDashboard.tsx:520-576`

---

## Filtros disponíveis na tabela

| Filtro | Tipo | Opções |
|---|---|---|
| Buscar destinatário | Input de texto | livre (filtra por email) |
| Status | Select | Todos status / Entregue / Aberto / Clicado / Falhou / Bounce |
| Template | Select | Lista dinâmica dos templates encontrados nos logs |

Fonte: `EmailDashboard.tsx:524-547`

---

## Labels de status (PT-BR)

| Status interno | Exibido como |
|---|---|
| `sent` | entregue |
| `delivered` | entregue |
| `opened` | aberto |
| `clicked` | clicado |
| `failed` | falhou |
| `bounced` | bounce |
| `complained` | spam |
| `queued` | na fila |

Fonte: `EmailDashboard.tsx:78-87`

---

## Dados e hooks

- **`useEmailMetrics(clinicId, days)`** — busca métricas diárias agregadas da tabela `email_daily_metrics`; usado para períodos > 24h (mais preciso que paginar `email_logs`).
- **`aggregateMetrics(rows)`** — calcula totais e percentuais a partir das linhas de métricas.
- Realtime via `supabase.channel` nas tabelas `email_logs` e `email_queue` (recarrega ao detectar mudanças).

Fonte: `EmailDashboard.tsx:50,160-176`

---

## Tabelas consultadas

| Tabela | Campos selecionados |
|---|---|
| `email_logs` | id, template_slug, recipient_email, subject, status, sent_at, opened_at, clicked_at, bounced_at, delivered_at, error |
| `email_queue` | status |
| `email_send_state` | sent_today |
| `clinics` | settings (→ settings.email.quota_daily) |

---

## Regras de negócio

- **Cota diária** lida de `clinics.settings.email.quota_daily` (padrão: 1000).
- Barra de cota fica **vermelha** quando uso > 90% (`EmailDashboard.tsx:476`).
- Para janelas > 24h, métricas são calculadas via `useEmailMetrics` (tabela agregada), não via paginação de `email_logs`, para escapar do teto de 50.000 linhas buscadas.
- Status `sent` e `delivered` são tratados como equivalentes ("Entregue") para evitar confusão (`EmailDashboard.tsx:76-77`).

---

## Estado vazio

- Cards de métricas: exibem 0
- Gráfico de atividade: exibido vazio (sem mensagem especial)
- Pie chart: exibe *"Sem dados"*
- Top templates: exibe *"Sem dados"*
- Tabela: exibe *"Nenhum envio"*

