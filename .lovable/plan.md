Vou corrigir o erro de envio atacando a causa real no backend, não apenas repetindo o índice.

1. Ajustar a função de envio `evolution-send`
- Remover o `upsert(..., { onConflict: "client_message_id" })` da tabela `messages`.
- Trocar por fluxo explícito e compatível com o banco atual:
  - primeiro buscar por `client_message_id`
  - se já existir, reutilizar o registro
  - se não existir, fazer `insert` simples com status `pending`
- Manter a deduplicação já existente por `client_message_id`, mas sem depender de `ON CONFLICT` em índice parcial.
- Preservar o restante da lógica: retries, atualização de `status`, `external_id`, `last_error` e atualização do lead.

2. Limpar a estrutura do banco para evitar confusão futura
- Criar uma migração para remover índices únicos duplicados de `messages.client_message_id` e de `(lead_id, external_id)` que foram sendo acumulados.
- Manter apenas um índice único parcial correto para `client_message_id` e um único índice para dedupe por `external_id`.
- Não alterar dados existentes.

3. Validar o fluxo de envio
- Conferir logs da função após o ajuste.
- Validar que o erro `42P10` desapareceu.
- Confirmar que novas mensagens entram como `pending` e depois mudam para `sent` ou `failed` corretamente.

Detalhes técnicos
- O erro atual não acontece por ausência de índice. O banco já possui vários índices únicos em `client_message_id`.
- O problema é que o código usa `ON CONFLICT (client_message_id)` contra um índice único parcial (`WHERE client_message_id IS NOT NULL`). Em PostgreSQL, esse tipo de inferência exige predicado compatível; no caminho atual da função isso não está sendo satisfeito, por isso continua retornando `42P10`.
- Repetir a migração do índice não resolve. A correção robusta é parar de usar esse `upsert` nesse ponto do fluxo.

Se você aprovar, eu aplico essa correção completa agora.