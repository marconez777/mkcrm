## Objetivo
No Passo 3 (Conexão) do wizard `/ai/agents/new`, permitir reutilizar a chave/provedor já configurada no **Construtor** da clínica, em vez de obrigar a colar uma nova chave.

## UX (Passo 3 — Conexão)

Adicionar no topo do card um seletor (segmented/radio) com duas opções:

1. **Usar a chave do Construtor** (padrão quando Builder está `operacional`)
   - Mostra um resumo somente-leitura: provedor + modelo do Builder + badge ✓ "Já validada".
   - Campos de provedor / API key / Base URL ficam ocultos.
   - Permite só editar o **Modelo** (opcional; default = modelo do Builder).
   - **Testar conexão** roda `ai-builder` action `ping` sem overrides (usa o agente Builder direto). Não é obrigatório — já vem validado.
   - Botão **Continuar** liberado imediatamente.

2. **Usar uma chave própria** (fluxo atual)
   - Mantém exatamente a UI atual: provedor, API key, Base URL, Modelo, Testar conexão obrigatório.

Se o Builder não estiver configurado/`operacional`, a opção 1 aparece desabilitada com tooltip *"Configure o Construtor primeiro"* e a opção 2 fica selecionada por padrão (comportamento atual).

## Mudanças técnicas

**`src/pages/ai/AgentWizard.tsx`**
- Buscar o Builder (provider, model, api_key existência, `builder_verified_at`) no mesmo effect que já faz `builderStatus` check — guardar em estado `builderInfo`.
- Novo estado `keySource: "builder" | "own"` (default `"builder"` quando `builderStatus === "ok"`).
- Persistir `keySource` em `ai_agent_drafts.settings.key_source` para sobreviver a reloads.
- Ajustar `canNextFromStep3`: se `keySource === "builder"` → sempre `true` (Builder já validado); se `"own"` → regra atual.
- Em `finishAndCreateAgent`, quando `keySource === "builder"`:
  - Buscar o Builder atual e copiar `provider`, `api_key`, `base_url` para o novo agente.
  - Usar o `model` escolhido no wizard (ou o do Builder se vazio).
  - `provider_verified_at` herdado.
- Em `testConnection` (modo builder), invocar `ai-builder` `ping` sem overrides.
- Atualizar `invalida verificação` effect para ignorar mudanças quando `keySource === "builder"`.

**Step3 component (mesmo arquivo, ~linha 1251)**
- Renderizar bloco de seleção de origem da chave no topo.
- Condicionalmente esconder o grid de Provider/API key/Base URL.
- Mostrar resumo do Builder quando `keySource === "builder"`.

## Fora de escopo
- Nenhuma mudança em edge functions (`ai-builder` já aceita rodar `ping` sem overrides).
- Nenhuma migração de banco.
- Docs (`docs/support/pages/ai-agents.md` e `supabase/functions/_shared/support-kb/pages/ai-agents.md`) serão atualizadas em seguida para refletir a nova opção no Passo 3.
