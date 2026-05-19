## Diagnóstico real

Investiguei o caso da Ana Paula (lead `31d99872-d3ab-426a-920a-e0cff074eb3b`, visitor `v_202bca19eab5…`) direto no banco:

- `tracking_identity_links`: ✅ existe, `link_source = whatsapp_tracking_code`
- `whatsapp_intents`: ✅ `status = matched`, `lead_id` preenchido
- `tracking_events`: ✅ todos os eventos do visitante (page_view, session_start, whatsapp_redirect) com `lead_id` preenchido pelo backfill
- `tracking_lead_sources`: ✅ first/last/conversion touch congelados
- Evento `lead_identified`: ✅ criado pelo `tracking-identify`

**O vínculo está funcionando.** O que está errado é só o relatório em `src/pages/Tracking.tsx`. A tela mostra "—" na coluna de evento de conversão e nenhum sinal claro de "virou lead via WhatsApp", então parece que nada converteu — mas os dados estão lá.

## Causa raiz da exibição enganosa

Em `src/pages/Tracking.tsx`, linha 339, a aba "Leads com origem" calcula o evento de conversão assim:

```ts
const conversion = events.find((e) =>
  e.visitor_id === l.visitor_id &&
  (e.event_name === "form_submit_attempt" || e.event_name === "whatsapp_click")
);
```

Problemas:
1. Não considera `whatsapp_redirect`, que é o evento real disparado pelo site da Clínica Ór.
2. Não considera `partial_form_capture` (lead parcial via `external-lead-capture`).
3. Ignora a fonte autoritativa do vínculo: `tracking_identity_links.source_event` (= `link_source`), que já diz `whatsapp_tracking_code` para a Ana Paula.

Resultado: leads vinculados via WhatsApp aparecem como se não tivessem conversão.

## Plano

### 1. Corrigir a coluna "Evento de conversão" em `leadsWithOrigin`
Trocar a heurística por:
1. Se `link.source_event` existir, usar ele (ex.: `whatsapp_tracking_code`, `phone_hash_existing`, `ctwa_clid`, `partial_form_capture`, `manual`).
2. Como complemento ou fallback, procurar entre os eventos do visitante por `whatsapp_redirect`, `whatsapp_click`, `partial_form_capture`, `form_submit_attempt`, `form_submit` — pegando o evento mais próximo do `link.created_at`.
3. Renderizar um rótulo amigável em português: "WhatsApp (código)", "WhatsApp (clique)", "Anúncio WhatsApp (ctwa_clid)", "Formulário (parcial)", "Formulário (envio)", "Telefone conhecido", "Manual".

### 2. Mostrar `conversionPage` correta
Mesma lógica do item 1: pegar `page_url` do evento que de fato originou a conversão, não do primeiro `whatsapp_click` que existir.

### 3. Card "Viraram lead" no relatório de WhatsApp
Hoje `turnedLead` em `whatsappReport` (linha 326) já considera `whatsapp_click | whatsapp_redirect` para o conjunto inicial — então a Ana Paula deve cair lá. Validar visualmente após o ajuste e, se necessário, ajustar o label para deixar claro que "Viraram lead" = visitantes com clique/redirect que possuem `tracking_identity_links`.

### 4. Pequena melhoria: badge "Lead via WhatsApp" na lista de visitantes
Na tabela de visitantes (já existente), quando o visitante tem link cujo `source_event` começa com `whatsapp_`, mostrar um badge "Lead via WhatsApp" ao lado do nome do lead. Visualmente resolve a queixa "nenhum lead está discriminado como convertido no WhatsApp, apenas clique".

### 5. Validação
Após as mudanças:
- abrir `/tracking` no período "Últimos 7 dias",
- aba "Leads com origem" → a linha da Ana Paula deve mostrar "WhatsApp (código)" como evento de conversão e a página de origem real,
- aba "WhatsApp" → "Viraram lead" deve mostrar ≥ 1,
- tabela de visitantes → visitor `v_202bca19eab5…` deve ter o badge "Lead via WhatsApp".

## Arquivos afetados

- `src/pages/Tracking.tsx` (apenas exibição; nada de schema, edge function ou RLS).

## Fora do escopo

- Mudar a lógica de match no `evolution-webhook` (não é o problema aqui — já casou corretamente para os leads que tinham rastro).
- Backfill de leads antigos sem nenhum rastro do site (esses não têm como ser vinculados sem inferência ambígua).
- Atribuição UTM no card de lead (já há `tracking_lead_sources`; podemos tratar em outra rodada se quiser ver UTM no perfil do lead).