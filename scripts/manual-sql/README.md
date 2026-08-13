# SQL de execução manual

Scripts que **NÃO** devem ser aplicados automaticamente pelo pipeline de deploy.

Ficam fora de `supabase/migrations/` de propósito: são operações de dados com
pré-requisitos que uma ferramenta não tem como verificar — ordem de deploy,
conferência de estado, janela de baixo tráfego.

| Script | Pré-requisito | Status |
|---|---|---|
| `bloco-b-topologia-dois-pipelines.sql` | Deploy do código das Etapas 1–3 **no ar** | ⏳ aguardando |

Cada script traz no cabeçalho o que exige antes de rodar e as queries de
conferência de depois. Ler antes de executar.

Ver `docs/tenants/clinica-or/PLANO_IMPLEMENTACAO.md`.
