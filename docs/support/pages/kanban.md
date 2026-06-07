---
title: Kanban — `/`
topic: support
kind: support
audience: user
updated: 2026-06-07
---
# 🗂️ Kanban — `/`

## Para que serve
Visualização em quadro de todos os leads organizados em **etapas (colunas)** de um **funil**. É a tela inicial após o login. Permite arrastar leads entre etapas, criar leads, gerenciar funis e etapas.

## Quem acessa
Todos os papéis. Operador pode mover/editar leads; admin/owner pode editar funis e etapas.

## Layout da tela
```
┌── Header: [Seletor de funil]  N leads · N etapas  [Busca] [Filtros] [Ações] ──┐
│                                                                                │
│  ‹ [Etapa 1 (N)]  [Etapa 2 (N)]  [Etapa 3 (N)]  ... ›                         │
│      cards          cards          cards                                       │
└────────────────────────────────────────────────────────────────────────────────┘
```
Setas **‹ ›** aparecem quando há mais colunas para rolar.

## Cabeçalho
- **Seletor de funil** (nome + cor) — abre lista de funis e opção de criar novo.
- Subtítulo: `N leads · N etapas` (ou `N de N` quando há filtro).
- Busca: `Buscar por nome ou telefone…`.
- **Filtro de data** — período de entrada do lead.
- Toggle **Modo compacto** — cards mais densos.
- **Expandir todas (N)** — aparece quando há colunas colapsadas.
- **✏️ Editar** — edita o funil atual.
- **＋ Coluna** — nova etapa.
- **＋ Lead** / **＋ Card** — novo lead (texto varia conforme tipo do funil).

## Colunas (etapas)
Cada coluna mostra: bolinha colorida + **nome da etapa** + contador + **valor total** (soma de `deal_value` quando >0, formatado `R$ X.XXX,XX`).

- Botão **⊟ Colapsar** vira faixa vertical com nome rotacionado e botão **⊞** para expandir.
- Duplo clique no nome → renomear inline (Enter confirma, Esc cancela).
- Menu **⋮** → **✏️ Editar etapa** · **🗑 Excluir etapa** (confirma).

## Cards de lead
Mostram: avatar com iniciais · badge de não lidas · nome ou telefone · telefone · prévia da última mensagem (modo normal) · 💬 + tempo desde a última (`agora / Nm / Nh / Nd`) · data de entrada.

- Menu **⋮** no canto: **Mover para coluna →** (submenu de etapas) · **Mover para outro funil**.
- **Clique no card** abre o **LeadDrawer** (painel lateral).
- **Drag-and-drop** entre colunas. Toast com **Desfazer** (6s).

## Diálogos
| Diálogo | Campos |
|---|---|
| **Nova coluna** | Nome da etapa |
| **Novo lead / card** | Nome · Telefone (com DDI) / Identificador |
| **Mover para outro funil** | Funil destino + etapa destino |
| **Editar etapa** | Nome · Cor |
| **Editar funil** | Nome · Cor · WhatsApp vinculado · Tipo |

## Atalhos
| Tecla | Ação |
|---|---|
| `/` | Foca busca |
| `→` `←` | Rola página horizontalmente |
| `Home` `End` | Primeira / última coluna |

## Erros e toasts
| Mensagem | Causa |
|---|---|
| *"Movido para '[etapa]'"* + Desfazer | Drag/menu ok |
| *"Lead criado"* | Criação ok |
| *"Telefone obrigatório"* | Falta telefone |
| *"Crie uma coluna primeiro"* | Sem etapas no funil |
| *"Coluna excluída"* | Etapa removida |

## Relacionado
- `pages/lead-drawer.md`
- `pages/inbox.md`
- `journeys/importar-leads.md`
