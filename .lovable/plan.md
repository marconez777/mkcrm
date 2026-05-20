## Objetivo

Adicionar um botão **Relatório** em cada automação de e-mail (tanto receitas prontas quanto personalizadas) que abre um modal com as métricas por passo, no mesmo estilo do print enviado. Cada métrica é clicável e abre uma lista lateral com os leads correspondentes.

## Onde

- `src/pages/email/EmailAutomations.tsx` — adicionar botão "Relatório" nos cards (presets + custom) e os 2 novos componentes abaixo.
- Novo componente: `AutomationReportDialog` (no mesmo arquivo ou em `src/components/email/AutomationReportDialog.tsx`).
- Novo componente: `AutomationLeadsSheet` (drawer lateral com lista de leads).

## Conteúdo do modal de relatório

Cabeçalho:
- Título: `Relatório · {nome da automação}`
- Subtítulo: tipo de gatilho + `trigger_config` (filtros) em JSON compacto.

Card destacado no topo:
- **LEADS NA AUTOMAÇÃO** — total de `email_automation_enrollments` da automação. Clicável → abre sheet com a lista completa de leads inscritos.

Tabela de passos:
```
#  Dia    Template                Na fila  Enviados  Abertos     Clicados    Falharam
1  +0d    welcome                    25       14      2 (14%)     1 (7%)        0
2  +3d    warmup-2                   34        5      1 (20%)     0 (0%)        0
3  +7d    warmup-3                   38        1      1 (100%)    1 (100%)      0
```

Cada célula numérica é um botão que abre o sheet lateral filtrado para aquele bucket.

Rodapé:
- "Percentuais de Abertos e Clicados são calculados sobre o total de Enviados de cada passo."
- Botões: **Atualizar** (refetch) e **Fechar**.

## Fontes de dados

Tudo filtrado por `clinic_id` + `related_lead_table = 'automation_${automation.id}'` + `template_slug = step.template_slug`.

| Métrica | Tabela | Filtro |
|---|---|---|
| Leads na automação | `email_automation_enrollments` | `automation_id = X` |
| Na fila | `email_queue` | `status = 'pending'` |
| Enviados | `email_logs` | qualquer status (linha existe = foi enviado) |
| Abertos | `email_logs` | `opened_at IS NOT NULL` |
| Clicados | `email_logs` | `clicked_at IS NOT NULL` |
| Falharam | `email_queue` `status='failed'` + `email_logs` `status IN ('bounced','complained','failed')` |

Estratégia: 1 query por passo (ou 1 query agrupando por `template_slug`) — `select status, opened_at, clicked_at, bounced_at, related_lead_id, recipient_email` em `email_logs` filtrado por automação, e `select status, template_slug` em `email_queue`. Agregar no cliente.

## Sheet lateral "AutomationLeadsSheet"

Props: `automationId`, `bucket` (`enrolled` | `queued` | `sent` | `opened` | `clicked` | `failed`), `stepSlug` (quando aplicável), `title`.

Conteúdo:
- Total: "N leads"
- Campo de busca por nome ou e-mail
- Lista com: nome do lead, e-mail, timestamp do evento (ex.: "Aberto em 19/05/2026, 22:00") e link **Ver lead →** que abre `/leads/:id` (mesmo padrão usado nos drawers existentes).

Fonte por bucket:
- `enrolled` → `email_automation_enrollments` join `leads` por `lead_id`
- `queued` → `email_queue` (pending) join `leads` por `related_lead_id`
- `sent`/`opened`/`clicked`/`failed` → `email_logs` join `leads` por `related_lead_id` com filtro de coluna correspondente

## Detalhes de UI

- Botão "Relatório" pequeno (`variant="outline" size="sm"`) ao lado de "Editar"/"Trash".
- Badges coloridos como no print: verde (enviados), azul (abertos), roxo (clicados), cinza (na fila), vermelho se falharam>0.
- Coluna "Dia" mostra `+Nd` calculado de `step.delay_minutes` (já temos `toDays`).
- Modal `max-w-3xl`, tabela rolável em telas estreitas.
- Sheet usa `@/components/ui/sheet` (`side="right"`).

## Sem alterações de backend/DB

Todos os dados já existem nas tabelas atuais (`email_logs`, `email_queue`, `email_automation_enrollments`). Apenas frontend.
