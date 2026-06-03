# Templates de mensagem — `/templates`

## Para que serve
Biblioteca de mensagens reutilizáveis para WhatsApp (atendimento manual, automações, sequências). Cada template pode ter um **atalho** acessível no compositor do Inbox digitando `/atalho`.

## Quem acessa
Owner / Admin / Operador.

## Layout
- **Sidebar esquerda (`w-72`):** lista de templates. Cada item:
  - Ícone 📄, nome
  - Badge `/atalho` se tiver atalho configurado
  - Botão **+** para criar
- **Painel principal:** vazio (*"Selecione ou crie um template."*) ou editor.

## Editor
- Cabeçalho: título "Editar template" + botões **Lixeira** e **Salvar**.
- Card com os campos:

| Campo | Tipo | Validação |
|---|---|---|
| Nome | Input | obrigatório |
| Atalho | Input | opcional, sem `/` (ex.: `ola`) |
| Descrição | Input | opcional |
| Conteúdo | Textarea (8 linhas) | obrigatório |

### Barra de variáveis
Abaixo do conteúdo, botões para inserir no cursor:

**Variáveis padrão:** `{{nome}}`, `{{primeiro_nome}}`, `{{telefone}}`, `{{email}}`, `{{empresa}}`.

**Variáveis de campo personalizado:** todos os campos da clínica aparecem como `{{campo.<chave>}}`. Para campos do tipo `date`/`datetime`, também aparecem `{{campo.<chave>:data}}` e `{{campo.<chave>:hora}}`.

> Dica: para campos de data, também funciona `:dia_semana` e `:extenso`.

## Ações

| Botão | Comportamento |
|---|---|
| **+** (sidebar) | Cria template "Novo template" com conteúdo *"Olá {{primeiro_nome}}, "* |
| **Salvar** | UPDATE em `message_templates`. Toast: *"Template salvo"* |
| **Lixeira** | Confirmação → DELETE |
| Botão de variável | Concatena no final do conteúdo |

## Mensagens de toast

| Situação | Mensagem |
|---|---|
| Template salvo | *"Template salvo"* |
| Erro de banco | mensagem original |

## Pegadinhas
- **Inserir variável** sempre concatena no **final** — não no cursor. Para posições específicas, edite a textarea manualmente.
- **Atalho duplicado**: o sistema não impede salvar dois templates com o mesmo atalho — o último cadastrado vence na busca do Inbox.
- **Remover atalho**: deixar o campo vazio salva como `null` (a busca por `/...` deixa de funcionar).
- Templates são usados em **Sequências**, **Automações** (`send_template`), **Quick replies do Inbox** e **Broadcasts** (apenas como referência manual — broadcast só interpola `{{nome}}`).

## Relacionado
- Páginas: `pages/inbox.md`, `pages/automations.md`, `pages/sequences.md`, `pages/settings.md` (campos personalizados)
- Conceitos: `00-conceitos.md#templates`
