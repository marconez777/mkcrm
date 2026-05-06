## Problema

Ao criar ou excluir um funil, a lista lateral só atualiza após recarregar a página.

## Causa

O hook `usePipelines` já tem uma subscription Supabase Realtime escutando mudanças na tabela `pipelines`, mas a tabela **não está incluída na publicação `supabase_realtime`** do banco. Por isso nenhum evento chega ao cliente.

Verifiquei: `pipeline_stages` e `leads` estão na publicação, mas `pipelines` não.

## Solução

**1. Migração de banco**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.pipelines;`
- `ALTER TABLE public.pipelines REPLICA IDENTITY FULL;` (garante payload completo em UPDATE/DELETE)

**2. Reforço no cliente (`src/hooks/usePipelines.ts`)**
- Após `insert`/`update`/`delete` feitos localmente (renomear, definir padrão, excluir, criar), também atualizar o estado local imediatamente como fallback otimista — assim, mesmo se o evento Realtime atrasar, a UI responde na hora.
- Manter a subscription para sincronizar entre abas/usuários.

## Resultado

Criar, renomear, definir padrão e excluir funis refletem instantaneamente na sidebar e no switcher, sem refresh.
