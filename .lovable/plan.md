## Problema

A migração anterior adicionou o índice por clínica `leads_clinic_phone_key`, mas **não removeu** o índice global antigo `leads_phone_unique` — por isso o erro `duplicate key value violates unique constraint "leads_phone_unique"` continua acontecendo quando duas clínicas têm o mesmo telefone.

Existe o mesmo problema em `lead_custom_fields`: o índice `lead_custom_fields_field_key_key` é **global**, então uma clínica não consegue criar uma chave (`interesse`, `procedimentos`, etc.) que outra clínica já criou — daí o 409 Conflict no print.

Como a importação não é transacional, quando falha no meio: o funil, etapas e campos personalizados já foram criados, e alguns leads também — por isso você vê 1 lead no funil "Gestão interna" mesmo após o erro.

## Correções

### 1. Migração SQL
- `DROP INDEX IF EXISTS public.leads_phone_unique` (remove restrição global de telefone).
- `DROP INDEX IF EXISTS public.lead_custom_fields_field_key_key` e criar `UNIQUE (clinic_id, field_key)` no lugar.

### 2. `KommoImportDialog.tsx`
- Filtrar `lead_custom_fields` existentes e novos **por `clinic_id`** (já filtra na leitura, mas a checagem de duplicidade precisa considerar o novo índice composto).
- Setar `clinic_id` explicitamente ao inserir custom fields (hoje depende só do default — funciona, mas fica explícito).
- **Cleanup em caso de erro**: se a inserção de leads falhar, apagar o `pipeline` recém-criado (cascade leva etapas e leads parciais junto), para não deixar lixo no Kanban.
- Mensagem de erro mais clara quando ainda houver conflito de telefone (indicar qual telefone).

### Sobre "Tipo: Gestão interna"
O tipo está sendo gravado corretamente (a screenshot mostra "gestão interna" no funil). O lead apareceu porque a importação inseriu parcialmente antes de travar — o cleanup acima resolve.

## Resultado esperado
- Importações de clínicas diferentes podem reusar telefones e nomes de campos.
- Em caso de falha, o funil parcial é removido automaticamente.
