## Objetivo

Permitir definir o **nome de exibição ("De")** na hora de criar/editar uma campanha de email. Padrão: "Clínica Ór". Esse nome sobrescreve o `from_name` do template só para envios daquela campanha.

## Mudanças

### 1. Banco
- `email_campaigns`: adicionar coluna `from_name_override TEXT NULL`.
- `email_queue`: adicionar coluna `from_name_override TEXT NULL`.
- Atualizar a função SQL `enqueue_email` para aceitar e gravar `_from_name_override`.

### 2. Edge function `dispatch-campaign`
- Buscar `from_name_override` da campanha e passar para o `enqueue_email`.

### 3. Edge function `send-email`
- Ler `from_name_override` da linha do `email_queue` (quando `queue_id` for fornecido). Se existir, usar no `fromHeader` em vez do `template.from_name`.

### 4. UI `EmailCampaigns.tsx`
- Adicionar campo **"Nome de exibição (De)"** no diálogo de criar/editar campanha, com placeholder "Ex.: Clínica Ór" e dica explicando que sobrescreve o do template.
- Mostrar o `from_name_override` na lista, abaixo do nome da campanha, em texto pequeno (opcional, só pra dar visibilidade).
- Persistir no insert/update da campanha.

### 5. Pré-preencher campanhas existentes (opcional)
- Não preencher automaticamente — fica vazio (= usa template). Usuário define a partir de agora.

## Não muda
- `template.from_name` continua sendo o default. Se o override estiver vazio, mantém o comportamento atual.
- O `from_email` (endereço) **não** muda — só o nome amigável.
