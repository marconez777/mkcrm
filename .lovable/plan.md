## O que encontrei

A IA não está preenchendo os campos por dois motivos principais:

1. **A chamada do extrator está falhando no modelo atual**
   - O `extractor-tick` está usando `gpt-5-nano`.
   - O código ainda envia `temperature: 0.1` para esse modelo em alguns casos.
   - Os logs da tabela `lead_ai_extraction_runs` mostram o erro repetido:
     - `Unsupported value: 'temperature' does not support 0.1 with this model. Only the default (1) value is supported.`
   - Exemplo: o lead **EDUARDO** teve várias execuções sem preencher nada por causa disso.

2. **Os campos que a IA grava não batem com os campos que a tela espera**
   - A função grava chaves como:
     - `procedimento_interesse`
     - `qualificacao`
     - `tentou_pagamento`
     - `consulta_agendada_em`
   - Mas a clínica OR configurou no cadastro campos como:
     - `interesse`
     - `procedimentos`
     - `data_horario`
     - `teleconsulta`
     - `link_consulta`
     - `pagamento`
     - `origem`
     - `mensagem`
     - `enviar_dia`
   - Ou seja: mesmo quando a IA extrai algo útil, **ela pode salvar em chaves diferentes das que aparecem no drawer**.

## Plano

1. **Corrigir a chamada do modelo no `extractor-tick`**
   - Ajustar a lógica para nunca enviar parâmetros incompatíveis com `gpt-5-nano`.
   - Validar a resposta antes de salvar para evitar runs “vazios” com falso sucesso.

2. **Mapear a extração para os campos reais da clínica**
   - Fazer o extrator ler a definição dos `lead_custom_fields` da clínica.
   - Traduzir a saída da IA para as chaves reais configuradas, em vez de depender só de chaves fixas internas.
   - Exemplo:
     - `procedimento_interesse` -> `interesse` / `procedimentos`
     - `consulta_agendada_em` -> `data_horario`
     - valor identificado -> `pagamento`
     - resumo relevante -> `mensagem`

3. **Manter compatibilidade com as automações já criadas**
   - Preservar os campos internos usados nas regras do pipeline, quando necessário.
   - Salvar também nos campos visíveis da clínica para a operação enxergar os dados no card e no drawer.

4. **Rodar um reprocessamento dos leads afetados**
   - Reexecutar a IA nos leads recentes da clínica OR para preencher os campos que ficaram vazios por erro anterior.
   - Confirmar no banco e na interface que os valores passaram a aparecer.

## Detalhes técnicos

- Arquivo principal envolvido: `supabase/functions/extractor-tick/index.ts`
- UI dos campos: `src/components/inbox/CustomFieldsPanel.tsx`
- Drawer de detalhes: `src/components/inbox/ContextRail.tsx`
- Evidência no banco:
  - `lead_ai_extraction_runs.error` com erro de `temperature`
  - `lead_custom_fields` da clínica usando chaves diferentes das gravadas pelo extrator

## Resultado esperado

Depois da correção:
- a IA volta a executar sem erro,
- os campos do drawer passam a ser preenchidos com as chaves certas,
- e os leads antigos podem ser reprocessados para recuperar os dados faltantes.