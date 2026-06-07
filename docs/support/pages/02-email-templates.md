---
title: Templates de Email
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: "Aba **Templates** no Email Hub → `/email/templates`. Para criar/editar com o editor visual: botão **Novo template** ou **Editar** em um template existente."
---
# Templates de Email

**Rota:** `/email/templates`  
**Arquivo principal:** `src/pages/email/EmailTemplates.tsx`  
**Editor de template:** `src/pages/email/EmailTemplateEditor.tsx` (rota `/email/templates/:id` e `/email/templates/new`)  
**Título da página:** `"Email — Templates"`

---

## Como acessar

Aba **Templates** no Email Hub → `/email/templates`.  
Para criar/editar com o editor visual: botão **Novo template** ou **Editar** em um template existente.

---

## Layout da tela (lista)

### Cabeçalho
- Título: **"Templates de Email"**
- Legenda: *"Crie modelos reutilizáveis para campanhas e automações."*
- Botão **Novo template** → navega para `/email/templates/new`

### Painel de pastas (coluna esquerda, 220px)
- Opções fixas: **Todos** · **Sem pasta**
- Pastas criadas pela clínica (listadas por `sort_order`)
- Botão de ícone `FolderPlus` para criar nova pasta
- Botão de lixeira (aparece no hover) para excluir pasta

### Lista de templates (coluna direita)
- Colunas por template: Nome · Slug (badge monospace) · badge "inativo" quando `active = false`
- Linha abaixo: assunto do template
- Ações por template: **Editar** · **Duplicar** (ícone Copy) · **Excluir** (ícone Trash2)
- Estado vazio: *"Nenhum template"*

---

## Dialog: Nova pasta

Campos:
| Campo | Tipo | Validação |
|---|---|---|
| Nome da pasta | Input texto | não pode estar vazio |

Botões: **Cancelar** · **Criar**  
Toast sucesso: *"Pasta criada"*  
Toast erro: mensagem do banco  
Fonte: `EmailTemplates.tsx:92-99`

---

## Dialog legado: Novo/Editar template (sem editor visual)

> ⚠️ Este dialog ainda existe no código mas o fluxo principal usa o **EmailTemplateEditor**. O dialog é aberto apenas via `startCreate()` em contextos sem navegação.

### Aba "Conteúdo"

| Campo | Tipo | Observações |
|---|---|---|
| Nome | Input | Preencher automático a partir do assunto |
| Slug (identificador único) | Input | Auto-gerado a partir do nome; só letras/números/hífen |
| Assunto | Input | — |
| Preheader | Input | Texto curto exibido após o assunto no cliente de email |
| HTML | Textarea (14 linhas, monospace) | Suporta variáveis `{{ nome }}`, `{{ email }}` etc. |
| Versão texto | Textarea (5 linhas, opcional) | — |
| Pasta | Select | Lista de pastas + opção "Sem pasta" |

### Aba "Remetente"

| Campo | Tipo | Observações |
|---|---|---|
| Nome do remetente | Input | — |
| From | Input + Select de domínio | Parte local + domínio verificado; se não houver domínio mostra "Configure um domínio em Configurações → Email" (desabilitado) |
| Reply-to | Input | Opcional |

### Aba "Testar"
- Input de email de destino
- Botão **Enviar teste** (chama edge function `send-email` com `force: true`)
- Aviso: *"Salve o template primeiro para poder enviar teste."* (quando sem `id`)

Toast sucesso: *"Email de teste enviado"*  
Toast erro: *"Informe um email para teste"*, *"Clínica não identificada"*

---

## Editor Visual de Template (`EmailTemplateEditor`)

**Rota:** `/email/templates/:id` ou `/email/templates/new`  
**Arquivo:** `src/pages/email/EmailTemplateEditor.tsx`

### Layout (3 colunas + toolbar)

```
[Toolbar]
[Faixa de Metadados]
[Palette | Canvas (drop zone) | Inspector]
[Rodapé de Variáveis]
```

#### Toolbar (topo)
- Botão **← Voltar** → `/email/templates`
- Input **Nome do template** (inline)
- Input **slug-do-template** (monospace)
- Botões à direita: **Importar HTML** · **HTML** · **Preview** · **Enviar teste** · **Salvar**

#### Faixa de Metadados (5 colunas)
| Campo | Observações |
|---|---|
| Assunto | Linha de assunto do email |
| Preheader | Texto de pré-visualização |
| Nome de exibição | Nome do remetente (ex.: "Clínica Ór") |
| Remetente | Parte local + Select de domínio (⚠ badge amarelo se não configurado) |
| Pasta | Select de pastas |

#### Palette (coluna esquerda, 260px)
Blocos arrastáveis: `src/components/email/editor/Palette.tsx`

#### Canvas (coluna central)
- Área de drop (`canvas-drop`)
- Blocos reordenáveis via drag-and-drop (DnD Kit)
- Por bloco: mover ↑↓, duplicar, remover
- Fonte: `src/components/email/editor/Canvas.tsx`

#### Inspector (coluna direita, 340px)
- Edição de propriedades do bloco selecionado
- Fonte: `src/components/email/editor/Inspector.tsx`

#### Rodapé de Variáveis
- Botões clicáveis com variáveis disponíveis (ex.: `{{ nome }}`)
- Clicar copia a variável para a área de transferência
- Toast: *"Copiado: {{ variavel }}"*

### Dialogs do Editor

| Dialog | Gatilho | O que faz |
|---|---|---|
| Preview | Botão "Preview" | Renderiza o HTML num iframe (sanitizado) |
| HTML renderizado | Botão "HTML" | Exibe textarea readonly + botão Copiar |
| Enviar teste | Botão "Enviar teste" | Input de email + botão Enviar (chama `send-email`) |
| Importar HTML | Botão "Importar HTML" | Textarea para colar HTML; opções: Substituir blocos / Adicionar ao final |

### Autosave

- Rascunho salvo no `localStorage` a cada 2 segundos (debounce) sob a chave `email-template-draft:{id}`.
- Ao carregar template existente, verifica localStorage primeiro.
- Ao salvar no banco, limpa o rascunho local.
- Fonte: `EmailTemplateEditor.tsx:139-149`

---

## Ações disponíveis (resumo)

| Ação | Botão/elemento | Comportamento |
|---|---|---|
| Novo template | **Novo template** | Navega para `/email/templates/new` |
| Editar template | **Editar** | Navega para `/email/templates/:id` |
| Duplicar template | ícone Copy | Abre dialog com nome `"(cópia)"` e slug `"-copia"` |
| Excluir template | ícone Trash2 | Confirm dialog → DELETE na tabela |
| Criar pasta | ícone FolderPlus | Dialog de nova pasta |
| Excluir pasta | ícone Trash2 (hover) | Confirm → templates ficam sem pasta |

---

## Validações ao salvar (editor visual)

| Condição | Toast de erro |
|---|---|
| Nome vazio | *"Informe o nome"* |
| Assunto vazio | *"Informe o assunto"* |
| Slug inválido | *"Slug inválido (use letras, números e hífen, começando por letra)"* |
| Nenhum bloco | *"Adicione pelo menos um bloco"* |

Toast de sucesso: *"Template salvo"*  
Fonte: `EmailTemplateEditor.tsx:228-231`

---

## Validações ao enviar teste (editor visual)

| Condição | Toast de erro |
|---|---|
| Template não salvo | *"Salve o template primeiro"* |
| From email não configurado | *"Configure um remetente antes de enviar"* |
| Email de destino inválido | *"Informe um email válido"* |

Toast sucesso: *"Email de teste enviado"*  
Fonte: `EmailTemplateEditor.tsx:272-275`

---

## Tabelas consultadas

| Tabela | Operação |
|---|---|
| `email_templates` | SELECT, INSERT, UPDATE, DELETE |
| `email_template_folders` | SELECT, INSERT, DELETE |
| `email_domains` | SELECT (para Select de remetente) |

---

## Regras de negócio

- Slug gerado automaticamente a partir do nome (normaliza acentos, substitui espaços por `-`, máximo 60 chars).
- Slug deve corresponder ao regex `/^[a-z][a-z0-9-]*$/`.
- Ao criar template novo, `from_email` é sugerido como `contato@{primeiro_domínio_verificado}`.
- Template inativo (`active = false`) aparece na lista com badge "inativo" mas pode ser editado.
- Teste ignora cota diária e supressões (`force: true` na edge function `send-email`).
- HTML legado (sem `blocks_json`) é importado automaticamente via `htmlToBlocks()` e toast info exibe: *"HTML legado importado em N bloco(s). Salve para persistir."*
- Rodapé de descadastro é inserido automaticamente no HTML renderizado, a menos que o template já contenha a variável `{{ unsubscribe_url }}`.

