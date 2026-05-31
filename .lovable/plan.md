# Plano — Múltiplas caixas de conversa por instância de WhatsApp

## Contexto

O banco já suporta múltiplas instâncias por clínica:
- `whatsapp_instances` (com `name`, `evolution_instance`, `connection_state`, `is_default`)
- `leads.whatsapp_instance_id` já existe
- `pipelines.whatsapp_instance_id` vincula funis à instância
- Em **Settings** já é possível criar/listar instâncias e marcar uma como padrão

O que falta é a **experiência no Inbox**: hoje `useLeadsPaginated` busca todos os leads da clínica sem filtrar por instância, e não há UI para alternar entre caixas.

## Objetivo

No topo da lista de conversas (`ConversationList`), expor um **switcher de instância** (tipo "abas" ou dropdown compacto) que filtra a caixa de entrada por `whatsapp_instance_id`. Trocar de instância recarrega a lista, mantém os filtros (não lidas/minhas/etc.) e atualiza a URL para permitir deep-link.

## Escopo

### 1. Hook de instâncias ativas
- Criar `src/hooks/useWhatsappInstances.ts`: lista `whatsapp_instances` da clínica (`id, name, phone_number, connection_state, is_default`), com realtime em `UPDATE` (para refletir conexão/desconexão).
- Expor `instances`, `defaultInstance`, `loaded`.

### 2. Filtro por instância no `useLeadsPaginated`
- Aceitar parâmetro `instanceId?: string | null` (null = "todas"). 
- Aplicar `.eq("whatsapp_instance_id", instanceId)` em `loadInitial` e `loadMore` quando definido.
- Resetar cursor/lista quando `instanceId` muda.
- No handler de realtime (`INSERT`/`UPDATE` de `leads`), ignorar linhas cujo `whatsapp_instance_id` não bate com o filtro ativo.

### 3. UI: switcher de caixa no `ConversationList`
- Adicionar barra acima do search com:
  - Abas horizontais roláveis (uma por instância) + opção "Todas".
  - Cada aba mostra: bolinha de status (`connection_state`), nome curto da instância, badge com contagem de não lidas daquela instância.
  - Em telas estreitas, vira `Select` dropdown.
- Persistir seleção em `localStorage` (`inbox:instanceId`) e refletir em querystring `?inst=<id>`.
- Estado inicial: querystring → localStorage → `is_default` → "Todas".

### 4. Integração no `Inbox.tsx`
- Ler/escrever `instanceId` no estado da página e passar para `useLeadsPaginated`.
- Ao criar uma "Nova conversa" (`NewConversationDialog`), pré-selecionar a instância ativa do switcher (em vez de só a default), garantindo que o lead criado caia na caixa visível.
- Badge no `<title>` (`useUnreadTitle`) considera apenas a caixa selecionada quando há instância ativa; "Todas" mantém comportamento atual.

### 5. Contagens de não lidas por instância
- Para os badges nas abas, agregar localmente a partir de `leads` já carregados **e** disparar um count leve:
  ```sql
  select whatsapp_instance_id, sum(unread_count)::int
  from leads
  where archived_at is null
  group by whatsapp_instance_id
  ```
  via supabase-js (head=false, com `select` agregado simples — ou via RPC se necessário). Recalcular em realtime ao receber INSERT/UPDATE em `leads`.

### 6. Guardrails
- Se a clínica tiver apenas **1 instância**, esconder o switcher (UI fica idêntica ao hoje).
- Se a instância selecionada for excluída/desconectada, fallback automático para "Todas".
- Verificar RLS de `whatsapp_instances` (já restrita por `clinic_id`) — sem mudanças no banco.

## Fora de escopo

- Provisionamento/conexão de novas instâncias (já existe em Settings).
- Mudar a estratégia de envio (`evolution-send` já resolve a instância pelo lead/pipeline).
- Alterar Kanban ou outras páginas — apenas Inbox nesta etapa.

## Arquivos afetados

- Novo: `src/hooks/useWhatsappInstances.ts`
- Editar: `src/hooks/useLeadsPaginated.ts` (parâmetro `instanceId`)
- Editar: `src/pages/Inbox.tsx` (estado + URL sync)
- Editar: `src/components/inbox/ConversationList.tsx` (switcher UI)
- Editar: `src/components/inbox/NewConversationDialog.tsx` (default instance da seleção)
- Sem migrações de banco.

## Diagrama

```text
┌─ Inbox ────────────────────────────────────────────────┐
│ [Todas] [📱 Vendas ●3] [📱 Suporte ●0] [📱 Pós ⚠]      │  ← switcher
│ ─────────────────────────────────────────────────────  │
│ 🔍 buscar...   filtros: [Não lidas] [Minhas]           │
│ ─────────────────────────────────────────────────────  │
│ • João — "obrigado!"            14:02   ●2             │
│ • Maria — "pode confirmar?"     13:55                  │
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```
