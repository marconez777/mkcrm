## Objetivo
Remover "Engajamento" como sub-item do menu lateral (IA → Engajamento) e adicioná-lo como uma aba dentro do hub de IA, ao lado de Dashboard / Agentes IA / Mensagens / Disparo em massa / Relatórios agendados / Memórias IA / Insights / Custos. Atualizar a documentação para refletir essa mudança.

## Alterações de código

1. **`src/pages/ai/AiHub.tsx`**
   - Importar `MetricsEngagement` de `@/pages/MetricsEngagement`.
   - Adicionar entrada na lista de tabs (após `reports` ou antes de `insights`):
     `{ value: "engagement", path: "/ai/engagement", aliases: ["/metrics/engagement", "/metrics"], label: "Engajamento" }`.
   - Adicionar `<TabsContent value="engagement"><MetricsEngagement /></TabsContent>`.

2. **`src/App.tsx`**
   - Trocar as rotas `/metrics/engagement` e `/metrics` para renderizarem `<AiHub />` (mantendo aliases via `AiHub`) em vez de `<MetricsEngagement />` direto, para que a aba fique destacada e o layout (sidebar + tabs) seja consistente.
   - Adicionar rota `/ai/engagement` apontando para `<AiHub />`.

3. **`src/components/AppShell.tsx`**
   - Remover o array `children` do item "IA" (que continha Engajamento), deixando IA como item simples sem submenu — alinhado com o padrão dos outros itens do hub que vivem só como abas.

4. **`src/components/CommandPalette.tsx`** (se houver entrada "Engajamento")
   - Atualizar destino para `/ai/engagement`.

## Atualização de documentação (Fase 4 — Features & Fluxos)

5. **`docs/frontend/PAGES.md`** e **`docs/frontend/ROUTING.md`**
   - Marcar `MetricsEngagement` como aba dentro de `/ai` (rota canônica `/ai/engagement`, aliases `/metrics/engagement` e `/metrics`).
   - Remover menção a submenu lateral "IA → Engajamento".

6. **`docs/features/`**
   - Atualizar (ou criar, se faltar) o doc do hub de IA listando todas as abas atuais na ordem: Dashboard, Agentes IA, Mensagens, Disparo em massa, Relatórios agendados, Memórias IA, Insights, Custos, **Engajamento**.
   - Atualizar o doc de Engajamento indicando que o acesso é via aba dentro de IA, não pelo sidebar.

7. **`docs/flows/`**
   - Ajustar qualquer fluxo que mencione navegar pelo sidebar até "IA → Engajamento" para refletir o caminho via aba.

8. **`docs/CHANGELOG.md`**
   - Adicionar entrada datada 2026-05-30: "UI: Engajamento movido do submenu lateral para aba dentro do hub `/ai` (rota canônica `/ai/engagement`, mantém aliases `/metrics/engagement` e `/metrics`)."

9. **`docs/AUDIT_PHASE1.md`** (opcional)
   - Marcar o item "Engajamento como sub-item lateral" como resolvido.

## Fora de escopo
- Nenhuma mudança em RPCs `engagement_*`, RLS, ou na página `MetricsEngagement` em si (apenas onde é montada).
- Sem alteração de permissões/feature flags.
