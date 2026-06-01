# Auditoria de ações no lead (autor + data/hora)

Hoje a timeline já mostra "Etapa alterada" e "Atendente alterado" via trigger `log_lead_changes` na tabela `leads`, mas:
- não grava **quem** fez (`auth.uid()`);
- não registra mudanças em **campos personalizados** (`custom_fields`);
- a UI não exibe o nome do usuário responsável.

## Etapas

### 1. Banco — adicionar autor e cobrir custom_fields
Migração:
- `ALTER TABLE lead_events ADD COLUMN actor_user_id uuid` (nullable, ações automáticas ficam `null`).
- Index `(actor_user_id, created_at DESC)` para futuros relatórios.
- Recriar `log_lead_changes()`:
  - Capturar `auth.uid()` em `actor_user_id` para todos os inserts.
  - Manter `stage_changed` e `attendant_changed`.
  - Novo evento `custom_fields_changed` quando `NEW.custom_fields IS DISTINCT FROM OLD.custom_fields`. Payload com diff por chave:
    ```json
    { "changes": { "data_consulta": { "from": "...", "to": "..." }, "valor": {...} } }
    ```
    Calculado iterando as chaves de `OLD ∪ NEW` e incluindo só as que mudaram.
- O trigger já dispara em `AFTER UPDATE` na `leads` — drag-and-drop do kanban, troca de atendente, edição de campo no painel direito do Inbox e qualquer outro caminho que use `update leads` passa a ser auditado automaticamente, sem mudar código de UI.

### 2. Frontend — exibir autor na timeline
- `src/components/lead/timeline/types.ts`: adicionar label PT-BR `custom_fields_changed: "Campos personalizados"` em `CRM_EVENT_PT` e expandir `TimelineItem` com `actor_name?: string`.
- `src/components/lead/LeadTimelineTab.tsx` e `src/components/inbox/ContextRail.tsx`:
  - Ao carregar `lead_events`, coletar `actor_user_id` distintos e buscar nomes via `profiles` (já existente — mesma fonte usada nos atendentes).
  - Renderizar linha extra "por **{nome}**" abaixo do título (mesma estética de "movido por usuário" já presente no print). Sem autor → "automático".
  - Para `custom_fields_changed`, render amigável: para cada chave alterada mostrar `{label do campo}: "{antigo}" → "{novo}"` (resolver label via `useCustomFieldDefs`); fallback no `field_key` se não houver definição.

### 3. Resolução do nome do autor
- Usar `profiles.full_name` (ou `email` como fallback) com `in_("user_id", ids)`.
- Cache local por sessão dentro do componente (Map) para não refazer fetch a cada evento novo via realtime.

## Detalhes técnicos

- O trigger roda como `SECURITY INVOKER`, então `auth.uid()` reflete o usuário autenticado da request — funciona para updates feitos pelo cliente Supabase no browser. Updates feitos por edge functions com `service_role` ficarão com `actor_user_id = null` (correto — não é ação humana).
- Para futuro: o mesmo padrão pode ser estendido para `lead_internal_notes`, `lead_tasks`, etc. Fora do escopo agora.
- Sem mudanças em RLS — `lead_events` já é leitura pública dentro do app.

## Arquivos afetados
- `supabase/migrations/<novo>.sql` — coluna + trigger atualizado.
- `src/components/lead/timeline/types.ts` — novo label e tipo.
- `src/components/lead/LeadTimelineTab.tsx` — fetch de profiles + render do autor + render de custom_fields_changed.
- `src/components/inbox/ContextRail.tsx` — mesmo tratamento na timeline do drawer.
- `docs/features/` — nota curta no doc relevante (opcional).
