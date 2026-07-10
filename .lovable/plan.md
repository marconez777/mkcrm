## G16 — Flag `classifier_version` por tenant

Objetivo: permitir dark-launch/rollback de prompts do classifier trocando um setting (`automation.<slug>.classifier_version = v1|v2`), sem redeploy. No dia 1 só existe `v1`; `v2` fica como stub pronto para receber prompt novo.

### Mudanças

**1. `supabase/functions/_template_pipeline_classify/agent.ts`**
- Refatorar `runAgent` para delegar em duas funções puras: `handleV1(ctx, model)` (contém o prompt/lógica atual, movido tal e qual) e `handleV2(ctx, model)` (stub que hoje só chama `handleV1` com um TODO comentado — mantém o comportamento até alguém escrever o v2).
- Exportar `handleV1` e `handleV2` como pede o roadmap.
- Assinatura nova:
  ```ts
  export async function runAgent(
    client, ctx, opts: { version: "v1" | "v2" }
  ): Promise<AgentOk | AgentError>
  ```
  Faz `switch(opts.version)` → `handleV1` / `handleV2`. Default defensivo = `v1`.

**2. `supabase/functions/_template_pipeline_classify/index.ts`**
- Adicionar import de `getTenantSetting` do `_shared/app-settings.ts`.
- Em `classifyOne`, antes de chamar `runAgent`, resolver:
  ```ts
  const versionRaw = await getTenantSetting(client, TENANT_SLUG, "classifier_version");
  const version = versionRaw === "v2" ? "v2" : "v1";
  ```
  Passar `{ version }` para `runAgent`.
- Incluir `version` no `console.log` do handler e no retorno de `classifyOne` (`{ ok, dry_run, applied, version }`) para o smoke test mostrar qual branch rodou.
- Atualizar o cabeçalho de comentários listando "Flag `automation.<slug>.classifier_version` (v1|v2) — G16".

**3. `docs/roadmap/PIPELINE_TENANT_ROADMAP.md`**
- Marcar G16 como concluído com a data e um bullet curto ("template lê `automation.<slug>.classifier_version`; `agent.ts` expõe `handleV1`/`handleV2`, default v1").
- Atualizar o rodapé de progresso (P1 em andamento, próximo G4).

### Não incluído

- Nenhum schema novo (a flag vive em `app_settings`, já suportado por `getTenantSetting`).
- Nada em UI/frontend (G16 é backend-only).
- Nenhuma mudança em `apply.ts`, `schema.ts` ou nas edges existentes (`pipeline-classify`, `pipeline-tick`).
- G4 e G6 ficam para os próximos planos.

### Verificação

- `tsgo` (typecheck) roda automático.
- Smoke test manual pós-deploy: chamar a edge clonada com `{action:"lead", lead_id:"...", dry_run:true}` e conferir que o retorno inclui `version:"v1"`; depois setar `automation.<slug>.classifier_version = "v2"` em `app_settings` e repetir → retorno deve virar `version:"v2"`.
