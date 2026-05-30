# Múltiplos segmentos por campanha de email

Hoje cada campanha (`email_campaigns.segment_id`) aceita só **um** segmento. Vou expandir para **N segmentos** (união dos leads, deduplicados por email).

## Mudanças

### 1. Banco — migration
- Adicionar coluna `segment_ids uuid[] NOT NULL DEFAULT '{}'` em `email_campaigns`.
- Backfill: `UPDATE email_campaigns SET segment_ids = ARRAY[segment_id] WHERE segment_id IS NOT NULL`.
- Manter `segment_id` por compatibilidade (deprecado — sempre sincronizado com `segment_ids[1]` se houver 1, ou `NULL` se 0/>1).

### 2. Edge function `dispatch-campaign`
- Quando `segment_ids` tem itens, iterar cada um chamando `resolve_email_segment` e unir resultados na mesma `Map` de dedup já existente.
- Se `segment_ids` vazio → mantém comportamento atual ("todos os leads").
- Modo teste pega o 1º lead do 1º segmento (igual hoje).

### 3. Frontend — `src/pages/email/EmailCampaigns.tsx`
- Trocar o `Select` único por um seletor **multi** de segmentos (lista com checkboxes em Popover, mostra chips dos selecionados; vazio = "Todos os leads").
- Coluna da tabela "Segmento" passa a mostrar:
  - 0 segmentos → "Todos"
  - 1 → nome
  - N → "Nome1 +N"
- Estado `editing.segment_ids: string[]` substitui `segment_id`. Save grava `segment_ids` (e `segment_id` sincronizado para compat).

### 4. `CampaignRecipientsPreview`
- Aceitar `segmentIds: string[]` em vez de `segmentId`. Para cada id, chamar `resolve_email_segment` e unir/deduplicar por email antes de mostrar a prévia e o total.

## Fora de escopo
- Operadores avançados (AND/NOT entre segmentos) — só UNION/OR.
- Mudança no fluxo de Broadcasts (WhatsApp).
- Remover a coluna `segment_id` (mantida para retro-compat).
