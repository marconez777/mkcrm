# Por que o visitante aparece "vazio" no relatório

Investiguei o visitante `v_202bca19eab5…` (lead **MK**, ref `829fe5b3a4`):

- `tracking_identity_links`: ✅ vinculado ao lead (`link_source=whatsapp_tracking_code`)
- `whatsapp_intents`: ✅ `status=matched`
- Eventos no banco: `page_view ×10`, `session_start ×7`, `whatsapp_redirect ×3`, `lead_identified ×1`
- **Não existe** evento `whatsapp_click` para esse visitante

O relatório em `src/pages/Tracking.tsx` (linhas 220-235 e 241-243) calcula as flags olhando **apenas**:

- WA → `event_name === "whatsapp_click"`
- Form → `event_name === "form_start"`
- Submit → `event_name === "form_submit_attempt" | "form_submit"`

Como o site da clínica usa o redirecionador (`wa-redirect`), o que chega na tabela é `whatsapp_redirect` — daí a coluna WA fica `—` mesmo o clique tendo acontecido. O novo fluxo de lead parcial (`partial_form_capture`) também não é contado em Form/Submit.

# Plano

## 1. Reconhecer eventos equivalentes na agregação por visitante (Tracking.tsx)

No bloco "compute per-visitor flags from events" e no bloco "summary":

- **WA**: marcar `true` para `whatsapp_click` **ou** `whatsapp_redirect`.
- **Form** (coluna "Form"): marcar `true` para `form_start` **ou** `partial_form_capture` (lead parcial do site externo conta como "preencheu formulário").
- **Submit**: manter `form_submit_attempt | form_submit` (sem mudança — submit real é diferente de preenchimento parcial).

Aplicar a mesma normalização nos contadores `summary.whatsapp_click` / `summary.form_start` para os cards do topo refletirem a realidade.

## 2. Mesma normalização no relatório de Páginas

Linhas ~305-315 também filtram por `whatsapp_click` puro — incluir `whatsapp_redirect` para a coluna "WA cliques" por página ficar consistente.

## 3. Tooltip/label

Renomear o cabeçalho `WA` para deixar claro que conta tanto clique no botão quanto redirecionamento rastreado (ex.: `title="Clique ou redirect rastreado para WhatsApp"`).

## Fora do escopo (não vou mexer agora)

- Atribuição UTM no card do lead (`leads.utm_source/medium/campaign` continuam `null` mesmo após match). O `tracking-identify` faz o link mas não copia UTMs para o lead. Posso tratar depois se você confirmar que precisa.
- Captura parcial no site da clínica — depende da edição no outro projeto.

## Arquivos afetados

- `src/pages/Tracking.tsx` (apenas agregação no front; sem mudança de schema, RLS ou edge function)
