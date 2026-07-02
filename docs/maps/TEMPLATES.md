---
title: "Mapa — Templates de mensagem"
topic: automations
kind: map
audience: agent
updated: 2026-07-01
summary: "message_templates: mensagens reutilizáveis com placeholders {{nome}}, {{primeiro_nome}}, {{telefone}}, {{email}}, {{empresa}} e {{campo.chave:modificador}}. Renderizador espelhado em src/lib/template-vars.ts e supabase/functions/_shared/template-vars.ts."
code_refs:
  - src/pages/Templates.tsx
  - src/lib/template-vars.ts
  - supabase/functions/_shared/template-vars.ts
related_docs:
  - docs/maps/AUTOMATIONS.md
  - docs/maps/SEQUENCES.md
  - docs/maps/INBOX_KANBAN_LEADS.md
---

# Templates — Mensagens reutilizáveis

## 1. Tabela `message_templates` (9 col)

Campos principais: `name`, `shortcut` (atalho digitado no Composer para expandir), `content`, `description`, `clinic_id`.

## 2. Renderizador (`renderTemplate`)

Duas cópias **espelhadas** que precisam ficar em sincronia:
- Frontend: `src/lib/template-vars.ts` (90 LOC) — usado no preview em Templates, Sequences, Automations e no Composer.
- Backend: `supabase/functions/_shared/template-vars.ts` — usado por `automations-tick`, `sequence-tick`, `broadcast-tick` (via placeholder `{{nome}}` só).

Assinatura:
```ts
renderTemplate(text, lead, customFieldDefs, tz = 'America/Sao_Paulo'): string
```

### Placeholders fixos
| Token | Substituição |
|---|---|
| `{{nome}}` | `lead.name` ou fallback para `lead.phone` |
| `{{primeiro_nome}}` | primeira palavra de `{{nome}}` |
| `{{telefone}}` | `lead.phone` |
| `{{email}}` | `lead.email` |
| `{{empresa}}` | `lead.company` |

### Custom fields — `{{campo.chave:modificador}}`
Regex: `/\{\{\s*campo\.([a-zA-Z0-9_]+)(?::([a-zA-Z_]+))?\s*\}\}/g`

Modificadores por tipo:
- `date/datetime`:
  - `data` → `DD/MM/YYYY`
  - `hora` → `HH:MM`
  - `dia_semana` / `weekday` → `segunda-feira`...
  - `extenso` → `1 de julho de 2026 às 10:30`
  - (default) date → `DD/MM/YYYY`; datetime → `DD/MM/YYYY HH:MM`
- `array` → join com `, `
- `boolean` → `sim/não`
- outros → `String(v)`

Timezone é aplicado via `Intl.DateTimeFormat('pt-BR', { timeZone: tz })`.

### Parse de datas
- `YYYY-MM-DD` (sem hora) → assume `T12:00:00` local para evitar drift de fuso.
- Restante via `new Date(v)`.
- Invalid → retorna string bruta.

## 3. Frontend — `src/pages/Templates.tsx` (221 LOC)

- CRUD simples: lista + editor de nome/shortcut/description/content.
- Insertor de variáveis (botões `{{nome}}` etc).
- Preview renderizado ao vivo usando `useCustomFieldDefsFull` e o primeiro lead de amostra da clínica.
- **Shortcut**: quando único, o Composer expande `/atalho` para `content` renderizado.

## 4. Uso downstream

| Consumidor | Como usa |
|---|---|
| `automations-tick` action=`send_template` | `renderTemplate(tpl.content, lead, defs, clinic_tz)` → `evolution-send`. |
| `sequence-tick` step | Se `step.template_id`, carrega `content` e renderiza. Fallback para `step.content` inline. |
| Composer no Inbox | Autocomplete por `shortcut`. |
| `broadcast-tick` | **NÃO** usa o renderer completo — apenas troca `{{nome}}` em `broadcast_message_parts.content` (débito técnico). |

## 5. Invariantes

1. **Manter frontend e backend em sincronia** — comentário no topo dos dois arquivos explicita isto.
2. Datas sem hora usam `T12:00:00` para evitar cair no dia anterior em fusos UTC-N.
3. `{{nome}}` faz fallback para `phone` para nunca renderizar vazio (piora legibilidade da broadcast).
4. Modificador desconhecido cai no default (não quebra a mensagem).
5. Custom field ausente/vazio → string vazia (não emite `undefined`).

## 6. Débitos técnicos

- Frontend e backend duplicam a lógica — refatorar para pacote compartilhado (ex.: `packages/template-vars`).
- Broadcast não usa `renderTemplate` completo — não suporta `{{campo.*}}`. Precisa unificar.
- Sem validação de tokens desconhecidos (`{{xyz}}` sai literal na mensagem).
- Não há suporte a formatação de moeda / número.
