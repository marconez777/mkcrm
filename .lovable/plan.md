## Objetivo

Permitir usar campos personalizados do lead (incluindo o campo "Data e horário" — `data_horario`) como variáveis nos templates e mensagens automáticas, para que o lembrete de consulta possa dizer, por exemplo, "sua consulta no dia 19/05/2024 às 10:30".

## Como vai funcionar

Hoje os templates aceitam apenas `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}` e `{{empresa}}`. Vou adicionar suporte universal a **qualquer campo personalizado** usando o `field_key` configurado em Configurações → Campos personalizados:

- `{{campo.data_horario}}` → 19/05/2024 10:30
- `{{campo.data_horario:data}}` → 19/05/2024
- `{{campo.data_horario:hora}}` → 10:30
- `{{campo.data_horario:dia_semana}}` → segunda-feira
- `{{campo.data_horario:extenso}}` → 19 de maio de 2024 às 10:30
- `{{campo.<qualquer_outro_field_key>}}` → valor cru do campo (texto, número, select, etc.)

Funciona em qualquer campo personalizado, não só nos de data, então também resolve `{{campo.interesse}}`, `{{campo.procedimentos}}`, etc.

Formatação:
- `date` → `dd/MM/yyyy`
- `datetime` → `dd/MM/yyyy HH:mm` (timezone America/Sao_Paulo)
- demais tipos → string
- Quando o campo está vazio, a variável é substituída por string vazia (sem deixar `{{...}}` no texto enviado).

## Onde aplicar

Mesmo motor de substituição em quatro lugares:

1. **Frontend — atalhos do chat** (`src/hooks/useQuickReplies.ts` → função `applyVariables`): expandir para resolver `{{campo.*}}` lendo `leads.custom_fields` do lead atual.
2. **Edge function `automations-tick`** (`send_template`, linhas ~206-218): trocar o `.split().join()` por uma função `renderTemplate(content, lead, customFieldDefs)` que carrega `custom_fields` + `lead_custom_fields` (para saber o `field_type`) e formata.
3. **Edge function `sequence-tick`** (`renderVars` no topo do arquivo): mesma extensão.
4. **`ai-chat`** (já lê `lead_custom_fields`) — sem alteração funcional, segue como está.

Para evitar duplicação, criar `supabase/functions/_shared/template-vars.ts` com a função `renderTemplate(text, { lead, customFieldDefs })` e usar em ambas as edge functions. No frontend, criar `src/lib/template-vars.ts` com a mesma lógica (carrega definições via hook quando necessário).

## UI — chips de variáveis

Adicionar nos chips abaixo do conteúdo:

- **`src/pages/Templates.tsx`** — buscar `lead_custom_fields` (todos) e renderizar um chip para cada um, agrupados depois dos chips fixos. Para campos `date`/`datetime`, gerar três chips: `{{campo.<key>}}`, `{{campo.<key>:data}}`, `{{campo.<key>:hora}}`.
- **`src/pages/Sequences.tsx`** — mesma lista de chips/hint atualizada.
- **`src/pages/Settings.tsx`** (editor de quick reply) — atualizar o hint de variáveis para mencionar `{{campo.<chave>}}`.
- **`src/pages/Automations.tsx`** (linha 396, ação `send_template`) — atualizar o texto de ajuda mencionando `{{campo.<chave>}}` com exemplo `{{campo.data_horario:data}}`.

## Fora de escopo

- Não mexer no sistema de bloqueio de conta (já removido).
- Não mexer no white screen / Google Translate (já tratado em `index.html`).
- Não criar novo tipo de campo personalizado nem novo gatilho.
- Sem mudança de schema do banco — as variáveis usam as definições existentes em `lead_custom_fields` e os valores em `leads.custom_fields`.

## Validação

1. No template "Lembrete consulta — 1 dia antes", trocar o texto para algo como:
   `Oi {{primeiro_nome}}! Lembrando da sua consulta em {{campo.data_horario:data}} às {{campo.data_horario:hora}}. Posso confirmar?`
2. Rodar manualmente o tick (botão ▶ em Automações) para um lead com `data_horario` preenchido e verificar no Inbox que a mensagem chegou com a data formatada.
3. Testar `/atalho` no chat com a mesma variável e verificar que expande no Composer.
