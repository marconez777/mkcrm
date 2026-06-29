## Objetivo
Adicionar um card "Filtro de Pipelines da IA" na aba **Settings → IA do Pipeline**, permitindo que a clínica escolha em quais pipelines as automações de IA devem atuar. A escolha é persistida em `clinics.settings.ai_target_pipeline_ids`.

## Arquivos

### 1. Novo: `src/components/settings/AIPipelinesCard.tsx`
Componente client-side com:
- Carrega lista de pipelines (`pipelines` table, ordenado por `position`).
- Carrega `clinics.settings.ai_target_pipeline_ids` (array de UUIDs).
- Renderiza checkboxes (um por pipeline) marcando os selecionados.
- Botão **Salvar** que faz merge no JSON `settings` preservando outras chaves.
- Estados: `loading`, `saving`; usa `sonner` para feedback.
- Tipagem corrigida (`useState<Pipeline[]>`, `Record<string, unknown>`) — o snippet enviado tem genéricos vazios que quebrariam o TS build.
- Respeita `canManage` (botão e checkboxes desabilitados quando falso).
- Texto de ajuda: "Se nenhum estiver selecionado, as automações atuarão em todos os pipelines por padrão."

### 2. Editar `src/pages/Settings.tsx`
- Import: `import AIPipelinesCard from "@/components/settings/AIPipelinesCard";`
- Dentro de `<TabsContent value="ai-pipeline">` (linha ~389), inserir `<AIPipelinesCard ... />` logo após `<OpenAIKeyCard ... />`, com as mesmas props `clinicId` e `canManage` já calculadas no JSX existente.

## Detalhes técnicos
- Não requer migration: `clinics.settings` já é `jsonb`.
- Não requer mudança de RLS: políticas existentes de `clinics` cobrem update por owner/admin.
- Sem mudanças em edge functions nesta entrega.

## Observação importante (consumo do filtro)
Fiz um grep no repo: a chave `ai_target_pipeline_ids` **ainda não é lida por nenhum agente, edge function ou hook**. Ou seja, salvar a seleção hoje só persiste o valor — não restringe efetivamente as automações até que o consumo seja implementado.

Posso seguir de duas formas:
- **(A) Só a UI agora** (escopo exato do prompt enviado): cria o card e persiste o JSON. Consumo fica para um próximo plano.
- **(B) UI + consumo mínimo**: também atualiza os pontos de entrada dos agentes (`pipeline-deterministic`, `pipeline-classify`, `pipeline-auto-retry`, gatilhos de automação) para pular leads cujo `pipeline_id` não esteja na allowlist — quando a allowlist estiver vazia, comportamento atual (atua em todos) é mantido.

Por padrão proponho **(A)** para respeitar o escopo do prompt; me diga se prefere (B) e eu re-emito o plano expandido.
