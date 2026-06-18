## Diagnóstico — caso Marcio

O classifier errou dois pontos no mesmo lead:

1. **Tag `1ª consulta` ficou ativa** num paciente em tratamento há ~5 anos. A regra de `tags_remove` existe, mas o modelo não tem **nenhum sinal de idade do lead** no prompt — só vê stage atual e tags. Sem `lead.created_at`, nº de mensagens históricas e moves anteriores, ele assume default ("é uma 1ª consulta porque está em 'Consulta agendada'").

2. **Chip mostrou "Consulta 19/06" sendo que era 18/06.** A causa raiz é dupla:
   - O prompt **não diz qual é "hoje"** nem qual fuso usar.
   - `formatMessages` usa `created_at.slice(0, 16)` — isso é **UTC cru** (ex.: 18:07 UTC = 15:07 BRT). O modelo lê "15:07" achando que é local, mas quando precisa resolver "quinta" relativa, ele acaba escolhendo "a próxima quinta", que cai dia 19, não dia 18.
   - Não há validação no servidor: qualquer string que o modelo coloque em `consulta_agendada_em` vira chip no Kanban.

Os campos `consulta_agendada_em` / `procedimento_agendado_em` são **escritos exclusivamente pelo classifier via `custom_fields_patch`** — nenhum outro código os seta. Então toda a correção é no edge function `pipeline-classify`.

## Plano

### 1. Dar contexto temporal e de idade do lead ao classifier

Em `classifyOne`, antes de chamar o LLM, montar um bloco **"Contexto do lead"** com:

- **`now_local`**: agora em America/Sao_Paulo (`Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" })`) — também passar o ISO com offset.
- **`timezone`**: `America/Sao_Paulo` (constante por enquanto; campo na clínica fica para depois).
- **`lead.created_at`** + "idade" calculada em dias/meses/anos.
- **Contagem total de mensagens** do lead (`select count` em `messages`) e data da primeira mensagem — para inferir "paciente antigo".
- **Últimos 5 stage moves** (`lead_stage_history`) com data + nomes — mostra se já passou por "Em tratamento"/"Consulta finalizada"/"Paciente antigo".
- **`custom_fields` atuais resumidos** — para o modelo não duplicar/contradizer.

Esse bloco substitui o atual `pipelineSummary` minimalista.

### 2. Formatar timestamps das mensagens em BRT

`formatMessages` passa a usar `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" })` — assim "15:07" vira "18/06 15:07" e bate com o que o lead vê no WhatsApp.

### 3. Endurecer o system prompt

Adicionar regras explícitas:

- **Datas relativas** ("amanhã", "5a/quinta", "semana que vem"): resolva **a partir do timestamp da mensagem que cita a data**, não do `now`. Use o fuso `America/Sao_Paulo`. Devolva em ISO completo `YYYY-MM-DDTHH:mm:00-03:00`.
- **Nunca aplique tag `1ª consulta`** se o lead:
  - tem mais de 90 dias de idade, OU
  - já passou por stage `Em tratamento` / `Consulta finalizada` / `Paciente antigo` em algum momento, OU
  - tem tag `paciente_antigo`.
  - Se uma dessas condições for verdadeira E `1ª consulta` existir, **inclua em `tags_remove`** e adicione `retorno` no lugar quando fizer sentido.
- **`consulta_agendada_em` / `procedimento_agendado_em`** só devem ser preenchidos quando o lead **confirmou** dia E hora; em remarcação, sobrescreva o valor antigo (não some).

### 4. Validar datas server-side antes de aplicar

Novo helper `sanitizeDateField(value, anchorIso)`:

- Parse com `Date.parse`; se inválido → descarta.
- Reject se a data resolvida cair **antes** do timestamp da última mensagem (data passada não faz sentido para "agendada").
- Reject se cair **mais de 90 dias após** a última mensagem (provável alucinação).
- Em caso de reject, o campo é removido do `custom_fields_patch` e o motivo entra em `lead_events.payload.applied.custom_fields_rejected`.

### 5. Telemetria

`lead_events` do tipo `auto:classifier` ganha `applied.custom_fields_rejected: { key, raw_value, reason }[]` para a gente ver no histórico do lead quando o modelo tentou meter uma data ruim e o servidor barrou.

### 6. Fora de escopo (próximos passos se você quiser)

- Campo `timezone` por clínica (hoje fixo em America/Sao_Paulo).
- UI no card mostrando hora além da data quando relevante.
- Tag `retorno` automática (a regra acima sugere, mas o canon de tags v4.2 precisa ser revisado antes de oficializar).

## Arquivos

- `supabase/functions/pipeline-classify/index.ts` — `buildSystemPrompt`, `formatMessages`, `classifyOne` (contexto novo + sanitização), telemetria.

Nenhuma migration; nenhum schema mudou.

## Como vou validar

1. Rodar `pipeline-classify` ação `lead` no Marcio depois do deploy e conferir:
   - `consulta_agendada_em` ISO bate com 18/06 10:30 BRT (ou foi rejeitado se o modelo ainda errar).
   - `tags_remove` contém `"1ª consulta"`.
2. Conferir `lead_events` recentes do Marcio: `applied.tags_diff.removed` e `applied.custom_fields_rejected`.
3. Conferir no Kanban: chip "Consulta 18/06" e sem "1ª consulta".
