---
title: Tarefas — `/tasks`
topic: support
kind: support
audience: user
updated: 2026-06-07
---
# ✅ Tarefas — `/tasks`

## Para que serve
Quadro kanban de **tarefas internas da equipe**, independente de leads. Cada clínica tem um quadro padrão com colunas customizáveis (ex.: A Fazer · Em andamento · Concluído) e cartões com responsáveis, prazos, descrição e checklist.

## Quem acessa
Todos os papéis com acesso ao recurso **tasks** do plano.

## Layout
```
┌── Header: 📅 Tarefas · [nome do quadro] ──┐
│  [Coluna 1] [Coluna 2] ... [＋ coluna]    │
│   cards      cards                          │
└────────────────────────────────────────────┘
```

## Colunas
- Nome em maiúsculas + contador de cards.
- Clique no nome → editar inline (Enter / Esc).
- Menu **···** → **Renomear** · **Excluir coluna** (confirma *"Excluir coluna e seus cartões?"*).
- **＋ Adicionar um cartão** abaixo dos cards: campo `Título do cartão` + **Adicionar** / **✕**.
- Ao final, **＋ Adicionar coluna** (borda tracejada).

## Cartões
Mostram: ⭕/✅ status · título · descrição (2 linhas) · badge de prazo (verde se concluída, vermelho **Atrasada**, cinza no prazo) · 📝 se tem descrição · contagem `N/Total` do checklist · chips dos responsáveis.

**Drag-and-drop** entre colunas. Se o nome da coluna destino contiver "Concluído", a tarefa é marcada como concluída automaticamente.

## Diálogo de detalhes (clique no cartão)
- **Título** editável inline · ⭕/✅ alterna concluída.
- **Data de entrega**: calendário + campo de hora `HH:MM` · badge **Concluído / Atrasada / horário**.
- **Responsáveis**: chips dos atribuídos (clique remove) + **＋ Adicionar** (popover com atendentes).
- **Descrição**: textarea com auto-save · placeholder *Adicione uma descrição mais detalhada…*.
- **Checklist**: itens com checkbox + texto editável + 🗑 ao hover · campo `Adicionar item…` + **Adicionar**.
- **Anexos**: drag-and-drop ou **Adicionar** (limite 25 MB) · miniatura/ícone + nome + data + tamanho + download/excluir.
- **🗑 Excluir tarefa** (remove imediatamente).

## Atalhos
| Contexto | Tecla | Ação |
|---|---|---|
| Checklist | Enter | Adiciona item |
| Adicionar coluna/card | Enter | Cria |
| Qualquer campo | Esc | Cancela edição |

## Erros e toasts
| Mensagem | Causa |
|---|---|
| *"Falha no upload"* | Erro ao subir anexo |
| *"[arquivo] excede 25MB"* | Tamanho excedido |
| *"Erro ao remover"* | Falha ao excluir anexo |

## Relacionado
- `pages/lead-drawer.md` (tarefas vinculadas a um lead aparecem no perfil dele)
