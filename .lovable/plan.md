# Unificar gestão de contatos na aba "Contatos"

## Objetivo

Eliminar a redundância entre "adicionar contato dentro do modal de segmento" e "aba Contatos". Toda criação/edição de contato passa a ser feita **só na aba Contatos**. O segmento estático vira uma **lista que aponta para contatos já existentes** (multi-select).

## Mudanças

### 1. Modal de Segmento (`EmailSegments.tsx`)

- **Remover** o bloco "Contatos manuais" (input de e-mail/nome + botão Adicionar + lista com remover).
- **Substituir** por um seletor multi-select de contatos da clínica (carregado de `email_segment_contacts` onde `segment_id IS NULL`), com busca por nome/e-mail.
- O salvar do segmento estático passa a:
  - Apagar todos os vínculos antigos (`DELETE … WHERE segment_id = X`)
  - Inserir um vínculo novo para cada contato selecionado, copiando `email`, `name` e `lead_id` do contato original, com `segment_id` preenchido.
- Manter o toggle Dinâmico/Estático e o preview ao vivo.
- Adicionar link "Gerenciar contatos" que leva para `/email/contacts`, caso a lista esteja vazia.

### 2. Aba Contatos (`EmailContacts.tsx`)

- Continua sendo a única tela onde se **cria, edita e remove** contatos.
- Sem mudanças funcionais necessárias além de garantir que novos contatos sejam salvos com `segment_id = NULL` (já é o comportamento).

### 3. Limpeza de dados

Como você escolheu "apagar tudo e começar do zero":
- Apagar todos os registros de `email_segment_contacts` onde `segment_id IS NOT NULL` (vínculos a segmentos estáticos antigos).
- Manter intactos os contatos gerais (`segment_id IS NULL`).
- Segmentos estáticos existentes ficam vazios até o usuário re-popular via novo seletor.

### 4. Sem mudança de schema

A tabela `email_segment_contacts` já suporta os dois modos (com e sem `segment_id`). O dispatcher (`dispatch-campaign`) e o `resolve_email_segment` já lidam corretamente — nenhuma migration estrutural necessária.

## Detalhes técnicos

- Arquivo principal: `src/pages/email/EmailSegments.tsx` (linhas 140-290 da função de modal/save/addContact/removeContact)
- Componente novo: seletor multi-select com busca (pode usar `Command` + `Popover` do shadcn já em uso no projeto)
- Operação de dados: 1 `DELETE` + 1 `INSERT` por save de segmento estático

## Fora de escopo

- Tags em contatos (descartado na resposta anterior)
- Mudanças no dispatcher de campanhas
- Mudanças na aba Contatos além de garantir o padrão atual
