## Objetivo

Tornar a criação de segmentos prática (sem editar JSON), introduzir o conceito de "origem de formulário" no lead, permitir múltiplos gatilhos OR por segmento e suportar segmentos estáticos com contatos adicionados manualmente.

## Mudanças de dados

### 1. `leads.form_source` (novo)
- Coluna `form_source text` nos `leads`, indexada.
- Valor livre identificando o formulário de origem (ex.: `teste-depressao`, `teste-ansiedade`, `landing-cetamina`).
- Preenchido por:
  - Webhook/integração de formulário (passa a aceitar `form_source` no payload).
  - Edição manual no detalhe do lead (campo simples).
  - Migração inicial opcional: copiar de `custom_fields.interesse` quando existir.

### 2. `email_segments` — novo modelo de filtros
Sem alterar a tabela, evoluímos o JSON em `filters` para o formato:
```json
{
  "match": "any",                  // sempre OR por enquanto
  "rules": [
    { "type": "form_source", "values": ["teste-depressao", "teste-ansiedade"] },
    { "type": "tag", "values": ["lead-quente"] },
    { "type": "stage", "stage_id": "..." },
    { "type": "has_email" },
    { "type": "utm_campaign", "values": ["black-friday"] }
  ],
  "kind": "dynamic"                // "dynamic" | "static"
}
```
- Segmento **dynamic**: avaliado por filtros sobre `leads`.
- Segmento **static**: ignora `rules`; público vem da nova tabela `email_segment_contacts`.
- Migração leve converte segmentos antigos (`{tags:[...]}` etc.) para o novo formato sem perda.

### 3. `email_segment_contacts` (nova tabela, para segmentos estáticos e contatos avulsos)
Colunas-chave: `segment_id`, `clinic_id`, `email`, `name`, `lead_id` (opcional), `added_by`, `created_at`. UNIQUE `(segment_id, email)`. RLS por clínica + feature `email_marketing`.

- Permite adicionar e-mails que **não** são leads (contatos avulsos importados/manuais).
- Para segmentos `dynamic`, esta tabela funciona como "inclusões extras".

### 4. Resolver destinatários
Função RPC `resolve_email_segment(segment_id uuid)` que devolve `(email, name, lead_id)`:
- `dynamic`: aplica `rules` sobre `leads` (OR) + união com `email_segment_contacts`.
- `static`: somente `email_segment_contacts`.

Edge function `dispatch-campaign` e `email-automations-tick` passam a usar este RPC em vez da query atual sobre `leads`.

## Mudanças de UI

### `EmailSegments.tsx` — builder visual
- Substitui o `<Textarea>` JSON por um **rule builder**:
  - Toggle no topo: **Dinâmico** (por regras) vs **Estático** (lista manual).
  - Para Dinâmico: botão "Adicionar gatilho" abre menu com tipos: *Origem do formulário*, *Tag*, *Etapa do pipeline*, *Tem e-mail*, *Campanha UTM*.
    - Cada regra é um chip/linha com seletor de valores (multi-select para form_source/tag/utm).
    - Texto fixo "Lead entra se atender **qualquer** uma das regras" (OR).
  - Para Estático: card com lista de contatos + botão "Adicionar contato" (form: nome, e-mail) e "Importar CSV" (etapa simples; podemos cortar CSV nesta primeira leva se preferir).
- Botão "Pré-visualizar" passa a chamar `resolve_email_segment` e mostra contagem + amostra dos 5 primeiros e-mails.
- Cards da lista exibem badge `Dinâmico`/`Estático` e a contagem de destinatários atual.

### Detalhe do lead
- Campo "Origem do formulário" (`form_source`) editável, com autocomplete dos valores já usados na clínica.

### Webhook de formulários
- `dispatch-campaign` não muda. O endpoint público que recebe leads (a confirmar onde está — provavelmente `public-lead-intake` ou similar) passa a aceitar e gravar `form_source`. Se a função não existir hoje, documentamos a chave esperada no payload e gravamos via integração existente (Zapier/Webhook).

## Compatibilidade

- Segmentos antigos continuam funcionando: leitor entende tanto `{tags:[...]}` quanto `{rules:[...]}`.
- `dispatch-campaign` migra para usar `resolve_email_segment` (uma única fonte de verdade).

## Detalhes técnicos

```text
email_segments.filters (JSON novo)
├── kind: "dynamic" | "static"
├── match: "any"
└── rules[]
     ├── form_source  → leads.form_source IN values
     ├── tag          → leads.tags && values
     ├── stage        → leads.stage_id = stage_id
     ├── has_email    → leads.email IS NOT NULL
     └── utm_campaign → leads.utm_campaign IN values

email_segment_contacts
└── usados como união (dynamic) ou fonte única (static)
```

Arquivos previstos:
- Migration: add `leads.form_source` + index; create `email_segment_contacts` + RLS; create `resolve_email_segment` RPC.
- `src/pages/email/EmailSegments.tsx`: builder visual + modo estático + lista de contatos.
- `src/components/email/SegmentRuleBuilder.tsx` (novo): UI dos chips de regras.
- `src/components/email/SegmentContactsManager.tsx` (novo): lista + adicionar contato.
- `src/pages/Conversations`/detalhe do lead: input `form_source` (mínimo).
- `supabase/functions/dispatch-campaign/index.ts`: trocar query por RPC `resolve_email_segment`.

## Fora de escopo (proponho deixar para depois)
- Importação CSV em massa para segmentos estáticos (posso incluir se quiser).
- Operador AND/NOT entre regras (hoje só OR, como você definiu).
- Página dedicada de "Contatos" global desvinculada de segmentos.
