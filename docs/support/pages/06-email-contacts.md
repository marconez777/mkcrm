---
title: Contatos
topic: email
kind: support
audience: user
updated: 2026-06-07
summary: Aba **Contatos** no Email Hub → `/email/contacts`.
---
# Contatos

**Rota:** `/email/contacts`  
**Arquivo:** `src/pages/email/EmailContacts.tsx`

---

## Como acessar

Aba **Contatos** no Email Hub → `/email/contacts`.

---

## Layout da tela

### Cabeçalho
- Título: **"Contatos"**
- Legenda: `{total} únicos · {leads} de leads · {manual} inscrições manuais`
- Botões: **Exportar CSV** · **Importar planilha** · **Adicionar contato**

### Filtros
| Filtro | Opções |
|---|---|
| Busca | email ou nome (livre) |
| Origem | Todos / De leads / Manual / Auto (lead em segmento) |
| Segmento | Todos / lista de segmentos |

### Tabela de contatos
Colunas: **Email** · **Nome** · **Origem** · **Segmentos** · **Criado** · **Ações** (Excluir)

Estado de carregamento: barra de progresso indicando `loaded/total` registros.  
Estado vazio: sem registros exibidos.  
Toast erro no load: *"Falha ao carregar contatos. Recarregue a página."*

---

## Dialog: Adicionar contato manual

| Campo | Validação |
|---|---|
| Email | regex `.+@.+\..+` obrigatório; toast *"E-mail inválido"* |
| Nome | opcional |
| Segmento | Select (ou "Sem segmento") |

Toast sucesso: *"Contato adicionado"*

---

## Dialog: Importar planilha

| Campo | Observações |
|---|---|
| Arquivo | Accept `.csv`, `.xlsx`, `.xls` |
| Coluna de E-mail * | Select das colunas detectadas; auto-detectada por regex `/e[\-_ ]?mail\|email/i` |
| Coluna de Nome | opcional; auto-detectada por `/nome\|name/i` |
| Segmento de destino | opcional; "Sem segmento" inclui em campanhas "Todos os leads" |

Pré-visualização: `{N} linha(s)`

Toasts:
- *"Planilha vazia"*
- *"Falha ao ler planilha: {msg}"*
- *"Mapeie a coluna de e-mail"*
- *"Nenhum e-mail válido"*
- *"{ok} importado(s) · {fail} falharam (duplicados?)"*

Importação em chunks de 500.

---

## Excluir contato

Confirm dialog (AlertDialog) antes de excluir. Remove entradas em `email_segment_contacts` E o lead em `leads` se existir.

Toast: *"Contato excluído"*

---

## Exportar CSV

Gera arquivo `contatos-{data}.csv` com colunas: `email, nome, origens, segmentos, form_source`.

---

## Regras de negócio

- Contatos são **agrupados por email** (dedup). Um email pode ter origem `lead`, `auto` (lead em segmento) e/ou `manual` simultaneamente.
- Paginação client-side: PAGE_SIZE itens por página.
- Reset de página ao mudar filtros.
- Carrega até 100.000 leads e 100.000 registros de `email_segment_contacts` com barra de progresso real.

---

## Tabelas consultadas

`leads` · `email_segment_contacts` · `email_segments`
