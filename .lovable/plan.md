## Objetivo

Reduzir o ruído visual no hub AI juntando **Automações**, **Sequências** e **Templates** em uma única aba **"Mensagens"** com sub-abas internas. **Disparo em massa** continua como aba própria (tem dashboard/risco próprios).

Mudança puramente de navegação — nenhuma tabela, edge function ou lógica de negócio é tocada.

## Antes / Depois

```text
Antes:  Dashboard | Agentes IA | Memórias IA | Custos IA | Automações | Sequências | Disparo em massa | Templates
Depois: Dashboard | Agentes IA | Memórias IA | Custos IA | Mensagens ▾ | Disparo em massa
                                                              ├─ Sequências
                                                              ├─ Automações
                                                              └─ Templates
```

A aba **Mensagens** abre com sub-abas (Tabs do shadcn) e cada sub-aba renderiza o componente já existente sem alteração.

## Mudanças

### 1. `src/pages/ai/AiHub.tsx`
- Remover as 3 entradas independentes (`automations`, `sequences`, `templates`) da lista `TABS`.
- Adicionar 1 entrada nova `messages` com `path: "/ai/messages"` e `matchPrefix: "/ai/messages"`.
- Visível se **qualquer** das 3 features (`automations`, `sequences`, `templates`) estiver habilitada (em vez de uma só).
- Renderizar `<Messages />` no `TabsContent`.

### 2. Novo `src/pages/ai/Messages.tsx`
- Página com `Tabs` internas: **Sequências** (default), **Automações**, **Templates**.
- A sub-aba ativa é sincronizada com a rota: `/ai/messages/sequences`, `/ai/messages/automations`, `/ai/messages/templates`. Default `/ai/messages` → sequences (ou a primeira liberada por feature flag).
- Cada `TabsContent` renderiza o componente existente sem mudanças: `<Sequences />`, `<Automations />`, `<Templates />`.
- Esconde sub-abas conforme `hasFeature("sequences" | "automations" | "templates")`.

### 3. `src/App.tsx`
- Adicionar rotas `/ai/messages` e `/ai/messages/:tab` apontando para o `AiHub`.
- Manter as rotas antigas (`/ai/sequences`, `/ai/automations`, `/ai/templates`, e os aliases `/sequences`, `/automations`, `/templates`) como **redirects** para o sub-path equivalente em `/ai/messages/...` para não quebrar links salvos, command palette e bookmarks.

### 4. `src/components/CommandPalette.tsx` (se houver entradas para essas páginas)
- Atualizar destinos das ações para apontar para `/ai/messages/sequences|automations|templates`.

### 5. `src/components/AppShell.tsx` (sidebar — se mostrar essas páginas)
- Substituir 3 itens por 1 item "Mensagens", se aplicável.

## Fora do escopo

- Nenhuma mudança em tabelas, RPCs, edge functions, RLS.
- Nenhuma mudança nos componentes `Templates.tsx`, `Sequences.tsx`, `Automations.tsx` (eles continuam idênticos, só passam a viver dentro do `<Messages />`).
- `Disparo em massa` permanece como aba própria do hub.
- Feature flags continuam funcionando por módulo (sequences, automations, templates separadas).

## Critérios de aceite

- A aba "Mensagens" aparece no hub AI no lugar das 3 antigas.
- Dentro dela, as 3 sub-abas funcionam com o conteúdo idêntico ao de hoje.
- Links antigos (`/ai/sequences` etc.) abrem a aba correta sem 404.
- Se a clínica tiver só 1 das 3 features habilitada, a aba "Mensagens" aparece e só mostra a sub-aba liberada.
- Disparo em massa segue como aba independente.
