## Problema

Hoje o pipeline tem 3 falhas que se somam:

1. **Qualquer palavra vira “agendamento”.** Um gatilho no banco marca o lead como “tentou agendar” só por ver palavras como *marcar, agendar, hoje, segunda, 10h, 3/4*. Isso já dispara a IA e acende o chip “Agendando”.
2. **Datas antigas viram consulta agendada.** A IA aceita qualquer data que extrair do texto (inclusive passada) e grava como `consulta_agendada_em`. A regra de Kanban move o card para *Consulta Agendada* só por ter data preenchida — sem checar se é futura.
3. **Coluna Administrativo não está protegida.** Nenhum dos 3 motores que movem card (IA, automação, regras de campo) sabe que *Administrativo* é intocável, então o lead volta pra *Consulta Agendada* na próxima varredura.

Decisões assumidas (você pediu pra eu decidir):
- Administrativo: **nenhuma movimentação automática** — nem entrada, nem saída.
- Data no passado: **ignorar** (não grava, não move).
- “Consulta agendada” exige: **data futura válida + frase explícita de confirmação + confiança alta**.

---

## O que vai mudar (linguagem leigo)

### 1. Coluna “Administrativo” virá blindada
- Marcar a etapa como “trava de saída/entrada automática”.
- Os 3 robôs (IA do chat, automações, regras de campo) passam a ignorar qualquer card que esteja em Administrativo e também não podem mandar nada *para* Administrativo sozinhos.
- Mover de/para Administrativo só por arrastar manualmente.

### 2. Data de consulta só conta se for futura e explícita
- Antes de gravar `consulta_agendada_em`, o sistema confere:
  - É data válida no formato esperado (DD/MM, DD/MM/AAAA ou ISO).
  - É **hoje ou no futuro** (com 12h de tolerância pra fuso). Se for passada, descarta.
- A IA recebe instrução reforçada: só preencher data se o lead **confirmar** (“pode ser dia X às Y”, “confirmo terça 14h”). Pedido de horário (“qual horário tem?”) **não** vale.
- O chip de data no card também esconde data passada (proteção dupla, pros leads que já estão sujos).

### 3. Regra que move pra “Consulta Agendada” fica mais exigente
- Novo operador `is_future` para datas no campo `consulta_agendada_em`.
- A regra padrão muda de *“data preenchida”* para *“data preenchida E é futura E `tentou_agendar` = verdadeiro”*.

### 4. Gatilho do banco fica mais conservador
- Reduzir as palavras-soltas que acendem `tentou_agendar`. Só liga o flag quando há padrão de *confirmação* (ex.: “pode marcar pra…”, “confirmo …”, “fechado pra …”, data + horário juntos). Palavras isoladas (*hoje*, *marcar*, *segunda*) só sinalizam pra IA revisar, mas **não** marcam o lead como tendo tentado agendar.

### 5. Limpeza dos leads atuais com data antiga
- Script único: para todos os leads com `consulta_agendada_em` no passado, limpar o campo e o flag `tentou_agendar`. Os cards param de aparecer como “Agendado” sem a gente ter que mexer um por um.
- Cards que estão hoje em *Consulta Agendada* mas têm data passada/sem data: ficam onde estão (não mexemos no stage manualmente), mas a próxima varredura não vai mais segurar lá.

---

## Detalhes técnicos

**Migrations**
- `pipeline_stages`: adicionar `lock_auto_move boolean default false`.
- Marcar a etapa “Administrativo” de cada pipeline com `lock_auto_move = true`.
- Limpeza: `UPDATE leads SET custom_fields = custom_fields - 'consulta_agendada_em' - 'data_horario'` onde a data é passada; `custom_fields || '{"tentou_agendar": false}'` quando aplicável.
- Ajustar `trg_lead_needs_extraction()`: remover do gatilho de `tentou_agendar=true` os matches genéricos; manter apenas combinações “verbo de confirmação + (data|hora|dia da semana)”.

**Edge functions**
- `supabase/functions/_shared/dates.ts` (novo): `parseFutureDate(str): Date | null` — aceita DD/MM, DD/MM/AAAA, ISO, em UTC; rejeita data > 12h no passado; rejeita Feb 31 etc.
- `extractor-tick/index.ts`:
  - Em `applyFields`/`applyClinicFieldMapping`, passar `consulta_agendada_em` por `parseFutureDate`; se `null`, não grava e também zera `tentou_agendar` se a IA só inferiu por isso.
  - SYSTEM_PROMPT reforçado: lista explícita de frases que contam como confirmação vs. dúvida; instrução “se a data mencionada já passou, retorne null”.
  - Subir threshold default para `0.8` quando o campo for `consulta_agendada_em`.
- `field-rules-tick/index.ts`:
  - Novo operador `is_future` (parseia string como data e compara com `now()`).
  - Skip do lead se o stage atual tem `lock_auto_move=true`.
  - Skip da regra se `target_stage_id` aponta para stage com `lock_auto_move=true`.
- `automations-tick/index.ts` (action `move_stage`) e `ai-chat/index.ts` (tool `move_lead_stage`): mesma checagem de `lock_auto_move` em origem e destino, com log em `lead_events` (`stage_lock_skipped`).

**Frontend**
- `src/pages/Kanban.tsx` (linha ~278): só renderizar chip de data se `parseFutureDate(consulta)` ≠ null.
- `FieldRulesCard` / `SuggestRulesDialog`: adicionar `is_future` à lista de operadores em PT (“É data futura”).
- Indicador visual de etapa travada (cadeado pequeno no header de Administrativo).

**Atualização das regras existentes**
- Migration data-only converte regras com `{field: "consulta_agendada_em", op: "not_empty"}` para um array `[{op:"not_empty"}, {op:"is_future"}, {field:"tentou_agendar", op:"is_true"}]`.

---

## Validação

1. Lead em Administrativo + mensagem com “agendar terça”: card **não sai** de Administrativo, log `stage_lock_skipped`.
2. Lead com mensagem “vim dia 25/02” (passado): IA não grava `consulta_agendada_em`, card não vai pra Consulta Agendada.
3. Lead com mensagem “pode marcar pra 20/12 às 14h”: IA grava data futura, regra move pra Consulta Agendada.
4. Card existente da Camila Attori (25/02): após o script de limpeza, chip some e o card pode ser movido manualmente.
5. Dr. Ivan em Administrativo: ao rodar `field-rules-tick` manualmente, é pulado.
