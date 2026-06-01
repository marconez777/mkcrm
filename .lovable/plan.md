# Fix: leads não aparecem no Kanban quando a clínica passa de 2000 leads

## Problema

`useLeads` (em `src/hooks/useCrm.ts`) carrega leads com `.limit(2000)`. A clínica já tem **2419 leads**, então 419 ficam de fora — incluindo Rosa Maria Portolese, Janaina Delluca e Daiane, que **estão corretamente atribuídos** a "Agendamentos Novo / Consulta Agendada" no banco.

O log de warning `[useRealtimeList] leads atingiu o limite de 2000 registros` já avisa sobre isso no console.

## Solução

Trocar o `select(...).limit(2000)` por uma **busca paginada completa** usando o helper existente `src/lib/fetch-all.ts`, mantendo todo o resto do hook (realtime INSERT/UPDATE/DELETE, dedup de render keys, sort) intacto.

### Mudanças

**`src/hooks/useCrm.ts`**

1. Importar `fetchAll` de `@/lib/fetch-all`.
2. No `useEffect` do `useRealtimeList`, quando `table === "leads"`, usar `fetchAll` em vez de um único `select().limit(2000)`, em páginas de 1000.
3. Manter o `limit(500)` para `pipeline_stages` (volume pequeno, não há risco).
4. Remover o `console.warn` de "atingiu o limite" para leads, já que não haverá mais teto.

Esqueleto:

```ts
const list = table === "leads"
  ? await fetchAll<T>("leads", { orderBy: orderBy as string, pageSize: 1000 })
  : (await supabase.from(table).select("*").order(orderBy as string).limit(500)).data ?? [];
```

(ajustando à assinatura real de `fetch-all.ts` após leitura — se necessário, faço o loop inline com `.range(from, to)`.)

## Verificação

- Após o deploy, abrir o Kanban no pipeline "Agendamentos Novo" → coluna "Consulta Agendada" deve mostrar Rosa Maria Portolese e Janaina Delluca.
- Abrir "Base de Pacientes (Geral)" → coluna "consulta agendada" deve mostrar Daiane.
- Console não deve mais logar o warning de limite.

## Fora de escopo

- Virtualização da lista para volumes muito maiores (10k+). A paginação resolve o caso atual; otimização futura se a clínica crescer muito mais.
- Mudar `useLeadsPaginated` (esse já é usado em outras telas que precisam de paginação visível).
