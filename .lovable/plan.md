## Objetivo

Hoje "Origem" é um campo personalizado (`custom_fields.origem`) que só existe na Clínica ÓR, é preenchido na mão (383 de 1.882 leads) ou "chutado" pela IA a partir do texto da mensagem. Ao mesmo tempo o sistema já tem tracking completo e confiável (191 registros de atribuição só na ÓR: Google orgânico, Google Ads, YouTube, redes sociais, indicação/referral, direto).

A proposta: transformar Origem em **campo nativo do lead, igual para todas as clínicas**, preenchido automaticamente a partir do tracking, e aposentar o campo personalizado.

## Como a origem será decidida (regra única, no código)

Ordem de prioridade, sempre que o lead ganha ou atualiza atribuição:

1. **Tracking (fonte da verdade)** — usa o toque de conversão já gravado em `tracking_lead_sources` (`channel_group` + `source` + `campaign`). É o que resolve o caso do `(ref=...)`: quando a mensagem chega com o código, o sistema já casa o lead com o visitante e sabe se ele veio de Google, Instagram, YouTube, e-mail, indicação, etc. O `ref` deixa de virar "origem WhatsApp" genérica — ele é só a ponte para a origem real.
2. **Formulário do site** — se o lead nasceu de um formulário e não há tracking, origem = "Formulário do site" + nome do formulário.
3. **E-mail marketing** — quando o toque de conversão tem meio "email" (ou o lead veio de segmento/campanha de e-mail), origem = "E-mail marketing" + campanha.
4. **WhatsApp direto** — mensagem sem `ref`, sem visitante casado: "WhatsApp direto".
5. **Teste / interno** — mensagens marcadas como teste ou instância de teste: "Teste".
6. **Indeterminado** — nada disso.

Origem editada manualmente pela equipe nunca é sobrescrita pela automação (trava humana), igual ao comportamento atual.

## Fases

**Fase 1 — Campo nativo + backfill**
- Adicionar em `leads`: `origin_channel` (valor canônico: `google_organic`, `google_ads`, `meta_ads`, `instagram`, `facebook`, `youtube`, `email`, `referral`, `form`, `whatsapp_direct`, `test`, `other`, `unknown`), `origin_label` (texto exibido), `origin_detail` (campanha/formulário/fonte), `origin_source_type` (de onde veio a dedução), `origin_locked_by_user` e `origin_updated_at`.
- Backfill: preencher todos os leads existentes a partir de `tracking_lead_sources`; onde não houver tracking, migrar o valor atual de `custom_fields.origem` (Google - Orgânico, Google - Ads, YouTube, Redes Sociais, Indicação de paciente/Médico/Psicóloga, Indeterminado) para o novo campo, marcando como travado (foi humano quem preencheu).

**Fase 2 — Preenchimento automático**
- Criar `supabase/functions/_shared/lead-origin.ts` com o resolvedor único (regra acima) e a normalização de rótulos.
- Chamar esse resolvedor em: `tracking-identify` (logo após gravar a atribuição — cobre o caso do `ref=`), `evolution-webhook` (fallback WhatsApp direto/teste), `forms-ingest` e `external-lead-capture`.
- Tirar "origem" do escopo do classificador de IA (`pipeline-classify`): a IA para de adivinhar origem pelo texto.

**Fase 3 — Interface**
- Mostrar a Origem como campo fixo na ficha do lead e como chip opcional no Kanban, com o detalhe (campanha/formulário) em tooltip.
- Permitir edição manual (dropdown com os valores canônicos) — editar marca o lead como travado.
- Adicionar filtro por origem na lista/Kanban e usar o campo nativo nos relatórios.
- Remover o campo personalizado "Origem" da ÓR depois do backfill validado (o histórico já terá sido migrado).

**Fase 4 — Cobertura de lacunas do tracking**
- `forms-ingest` e `external-lead-capture` hoje não gravam UTMs nem vinculam visitante: passar a repassar `visitor_id`/`session_id`/UTMs do formulário para o tracking, para que formulário também produza atribuição real (Instagram → formulário → lead).
- Marcar leads originados de campanha de e-mail com o toque de e-mail correspondente.

## Detalhes técnicos

- Fonte primária: `tracking_lead_sources` (`source_type = 'conversion_touch'`, fallback `last_non_direct` e `first_touch`), com `channel_group` já normalizado por `traffic_source_rules`.
- O código `(ref=xxxxxxxxxx)` continua sendo tratado como mensagem padrão (não gera intenção); ele serve apenas para casar `whatsapp_intents` → visitante → atribuição.
- As colunas legadas `leads.utm_source/utm_medium/utm_campaign/gclid/fbclid/form_source` ficam como estão (sem writer hoje); o novo campo é a fonte oficial de exibição.
- Nada de novo campo personalizado por clínica: a lista de origens é fixa no código e vale para todos os tenants.

## Pontos a confirmar durante a implementação

- Rótulos exibidos em português para cada canal (ex.: "Google — Orgânico", "Google Ads", "Instagram", "Indicação", "E-mail marketing", "Formulário do site", "WhatsApp direto", "Teste", "Indeterminado").
- Se "Indicação de paciente/médico/psicóloga" deve continuar como três opções manuais separadas ou uma só "Indicação" com detalhe.
