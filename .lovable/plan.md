## Problema

Hoje só existe **um** campo de agendamento (`consulta_agendada_em`) e **uma** regra ("data preenchida → Consulta Agendada"). Quando o lead marca uma sessão de cetamina (procedimento, recorrente), a IA grava no mesmo campo e o card vai parar em **Consulta Agendada** — quando o certo seria **Procedimento Agendado**.

No caso Leonardo/Ariane: o procedimento já foi identificado (Procedimentos = Infusão de cetamina), só falta o pipeline tratar o novo agendamento como **sessão de procedimento**, não como nova consulta.

## Decisões assumidas

- "Consulta" = primeira avaliação com o médico. "Procedimento" = aplicação/sessão (cetamina, infusão, etc.), normalmente repetida.
- Sinal forte de procedimento: a palavra do agendamento vem junto de um nome de procedimento conhecido (cetamina, infusão, cetamine, sessão, aplicação, EMTr, etc.) **ou** o lead já tem `procedimentos` preenchido / já passou por Procedimento pago / Consulta finalizada.
- Quando for procedimento, **não** mexe em `consulta_agendada_em` nem em `tentou_agendar`.

## O que muda (linguagem leigo)

### 1. Novo campo "Data do procedimento"
- Campo customizado `procedimento_agendado_em` (mesma validação de data futura que já fizemos pro de consulta).
- Aparece no drawer do lead junto da data de consulta.

### 2. IA aprende a diferença
- Prompt do extractor recebe lista explícita:
  - Palavras de **consulta**: "consulta", "avaliação", "primeira vez", "avaliar", "conhecer o doutor".
  - Palavras de **procedimento**: "cetamina", "infusão", "sessão", "aplicação", "EMTr", "estimulação", "tratamento" + qualquer item já listado em `procedimentos`.
- Regra: se a mensagem agenda algo **e** bate procedimento → grava em `procedimento_agendado_em`. Senão, em `consulta_agendada_em`.
- Reforço contextual: se o lead já tem `procedimentos` preenchido, **ou** já passou por "Consulta finalizada"/"Procedimento pago", o default vira procedimento (a não ser que a mensagem diga explicitamente "consulta"/"avaliação").

### 3. Nova regra de movimentação
- Regra padrão por pipeline:
  - `procedimento_agendado_em` preenchido + é data futura → move pra **Procedimento Agendado**.
- A regra existente ("Consulta agendada") continua, mas só dispara pelo campo de consulta. Como na rodada anterior já incluímos `is_future`, fica consistente.

### 4. Chip do card
- Card mostra o chip que tiver: se for procedimento, "🧪 Procedimento dd/mm"; se for consulta, "📅 Consulta dd/mm". Esconde data passada (já implementado).

### 5. Limpeza dos leads atuais
- Para leads que estão hoje em **Consulta Agendada** mas têm `procedimentos` preenchido (cetamina, infusão, etc.) e nunca passaram por "Consulta finalizada": mover script-único pra **Procedimento Agendado** e migrar a data de `consulta_agendada_em` → `procedimento_agendado_em`.
- Caso Leonardo/Ariane entra nesse lote.

## Detalhes técnicos

**Migrations**
- `custom_field_defs`: nova chave `procedimento_agendado_em` (type=date) — por clínica.
- `pipeline_field_rules`: para cada pipeline com stage "Procedimento Agendado", inserir regra `[{field:"procedimento_agendado_em", op:"not_empty"}, {field:"procedimento_agendado_em", op:"is_future"}]` → `target_stage = Procedimento Agendado`.
- Data fix script: `UPDATE leads SET custom_fields = jsonb_set(custom_fields - 'consulta_agendada_em', '{procedimento_agendado_em}', custom_fields->'consulta_agendada_em')` WHERE stage = Consulta Agendada AND custom_fields ? 'procedimentos' AND ... .

**Edge functions**
- `supabase/functions/extractor-tick/index.ts`:
  - Adicionar bloco no SYSTEM_PROMPT classificando o agendamento (consulta vs procedimento) com lista de termos.
  - Ao escrever data: `applyClinicFieldMapping` decide alvo (`consulta_agendada_em` ou `procedimento_agendado_em`) baseado no classifier; `parseFutureDate` em ambos.
  - Heurística de contexto: passa `lead.custom_fields.procedimentos` e `stage atual` no prompt.
- `_shared/dates.ts`: já cobre — reaproveita.
- `ai-chat/index.ts` tool `set_lead_field`: aceita `procedimento_agendado_em`.

**Frontend**
- `src/pages/Kanban.tsx`: render do chip — se tiver `procedimento_agendado_em` futuro, mostra esse; senão consulta.
- `src/pages/LeadDrawer.tsx` / `CustomFieldsPanel.tsx`: exibe os dois campos.
- `FieldRulesCard` / `SuggestRulesDialog`: já suporta `is_future`; basta listar o novo campo.

## Validação

1. Mensagem "pode marcar a cetamina pra 20/12 às 14h" em lead com `procedimentos=Infusão de cetamina`: card vai pra **Procedimento Agendado**, chip 🧪 20/12.
2. Mensagem "quero marcar uma consulta com o dr X" em lead novo: vai pra **Consulta Agendada**.
3. Leonardo/Ariane após backfill: aparece em **Procedimento Agendado** com a próxima data de infusão.
4. Mensagem ambígua "agenda pra mim terça" em lead que já tem cetamina: default = procedimento.
5. Mensagem com data passada: nem um nem outro campo é gravado (mantém comportamento da rodada anterior).
