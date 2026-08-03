# Corrigir data/hora cruas nas mensagens automáticas

## O que aconteceu

A mensagem enviada mostrou `2026-08-03T14:30:00.000Z` no lugar de `03/08/2026` e `11:30`.

Causa confirmada: o renderizador de variáveis só formata data/hora quando o campo está **cadastrado** como tipo `datetime` na clínica. Na Clínica ÓR não existe cadastro para `consulta_agendada_em` nem `procedimento_agendado_em` (os campos cadastrados são só interesse, link_consulta, mensagem, pagamento, procedimentos, teleconsulta). Sem cadastro, o valor é tratado como texto e sai cru — e o mesmo vale para o fuso: nem a data nem o horário foram convertidos para o horário de São Paulo.

Isso afeta 5 modelos da ÓR (Lembrete 1 dia antes, Lembrete 1h, Teleconsulta, Consulta Presencial, Primeira Sessão, Reagendamento).

## Correção

1. **Blindar o renderizador** (`_shared/template-vars.ts`): quando a variável pedir um modificador de data (`:data`, `:hora`, `:extenso`, `:dia_semana`) ou quando o valor tiver cara de data ISO, formatar como data/hora mesmo sem cadastro do campo. Assim nenhum tenant volta a receber data crua por falta de cadastro.
2. **Cadastrar os campos** `consulta_agendada_em` e `procedimento_agendado_em` como `datetime` na Clínica ÓR (e nos demais tenants que já gravam esses valores), para que apareçam corretos também na ficha do lead.
3. **Varredura**: procurar em todos os tenants variáveis `{{campo.X:data|hora}}` que apontem para campos sem cadastro e listar/cadastrar os que faltarem.
4. **Verificação**: renderizar os 6 modelos da ÓR com um lead real e conferir a saída (`03/08/2026` às `11:30`, fuso São Paulo) antes de liberar; deploy das funções que enviam (`automations-tick`, `sequence-tick`).

## Detalhes técnicos

- `formatCustom()` decide o formato por `fieldType` vindo de `lead_custom_fields`; o fallback hoje é `"text"`. A correção passa a inferir `datetime` por modificador ou por regex ISO 8601.
- Nada muda no comportamento de campos realmente textuais sem modificador.
