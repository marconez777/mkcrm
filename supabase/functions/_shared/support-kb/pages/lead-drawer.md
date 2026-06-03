# 👤 Lead Drawer — painel do lead

## Para que serve
Painel deslizante que abre sobre o Kanban ao clicar em um cartão. Mostra **perfil completo**, **chat**, **detalhes** e **linha do tempo** do lead sem sair do quadro.

## Quem acessa
Todos os papéis (mesmas regras do lead em si).

## Como abre
- Kanban → clique no cartão.
- Inbox/Tasks → links para o lead.
- Fecha com **✕** ou clicando fora.

## Layout
```
┌── Header: [Avatar] [Nome] [Telefone]   [✨] [↺] [🗑] ──┐
│  [ Chat ] [ Detalhes ] [ Linha do tempo ]              │
│                                                         │
│  Conteúdo da aba                                        │
└─────────────────────────────────────────────────────────┘
```

## Cabeçalho
- Avatar + nome (ou telefone se sem nome) + 📞 telefone.
- **✨** — Revisar conversa com o agente **vigia** configurado para a conexão de WhatsApp do lead.
- **↺** — Sincronizar histórico completo do WhatsApp.
- **🗑** — Excluir lead (exige digitar `EXCLUIR`).

## Abas
| Aba | Conteúdo |
|---|---|
| **Chat** | Mesmo chat do Inbox: mensagens, compositor, busca, notas internas, anexos |
| **Detalhes** | Perfil completo: nome, funil, etapa, atendente, valor, e-mail, tags, notas, campos personalizados, auto-resposta IA, tarefas, mensagens agendadas, card de **Atribuição do Lead** (origem/UTM) |
| **Linha do tempo** | Histórico cronológico de eventos: mudanças de etapa, atendente, campos, IA, mensagens importantes |

Os controles da aba **Detalhes** são iguais aos do painel lateral do Inbox — ver `pages/inbox.md` (seção "Perfil").

## Erros e toasts
| Mensagem | Causa |
|---|---|
| *"Vigia revisou a conversa"* | Botão ✨ ok |
| *"Lead sem WhatsApp vinculado"* | Lead não tem conexão associada |
| *"Nenhum agente vigia configurado para esta conexão"* | Falta configurar vigia em Configurações |
| *"Sincronizado: N mensagens"* / *"Falha: …"* | Resultado do sync |
| *"Lead excluído"* / *"Falha ao excluir lead"* | Resultado da exclusão |

## Relacionado
- `pages/inbox.md`
- `pages/kanban.md`
- `pages/settings.md` (configurar vigia por instância)
