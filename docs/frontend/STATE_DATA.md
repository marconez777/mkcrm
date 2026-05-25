# Frontend — Estado e Dados

> Como o frontend obtém, cacheia e propaga dados.
>
> Última atualização: 2026-05-25

---

## 1. Camadas de estado

| Camada                  | Onde                                     | Quando usar                                              |
|-------------------------|------------------------------------------|----------------------------------------------------------|
| **Auth/contexto global**| `useAuth` (Context API)                  | session, membership, role, features                      |
| **Diálogos globais**    | `useDialogs` (Context API)               | LeadDrawer, confirm, prompt — abrir de qualquer lugar    |
| **TanStack Query**      | `queryClient` em `App.tsx`               | Fetches comuns: settings, listagens não-realtime, RPCs   |
| **Realtime list**       | `useRealtimeList` (`useCrm.ts`)          | Leads, stages (assinaturas `postgres_changes`)           |
| **Local component**     | `useState`/`useReducer`                  | UI state efêmero (open, hover, draft)                    |
| **localStorage**        | `lib/drafts.ts`, `saved-views.ts`        | Drafts de mensagem, filtros salvos, pipeline selecionado |
| **URL (router)**        | path params, query string                | Lead aberto (`/inbox/:leadId`), modal QR (`?qr=1`)       |

Regra: **NÃO** duplicar estado entre camadas. Se o dado vem do Supabase,
ele vive em TanStack Query OU no realtime hook — não nos dois. Componente
deriva o que precisa via selectors.

---

## 2. Supabase client

Cliente único em `src/integrations/supabase/client.ts` (auto-gerado, não
editar). Importe sempre:
```ts
import { supabase } from "@/integrations/supabase/client";
```

Tipos em `src/integrations/supabase/types.ts` (também auto-gerado pós
cada migration). Acessíveis via:
```ts
import type { Database } from "@/integrations/supabase/types";
type Lead = Database["public"]["Tables"]["leads"]["Row"];
```

Para tipos de domínio reusáveis, há `src/types/crm.ts` com aliases
(`Lead`, `Stage`, `Pipeline`, `Message`).

---

## 3. Padrão de fetch / mutate

### Read direto (one-off)
```ts
const { data, error } = await supabase
  .from("leads")
  .select("id, name, phone, stage_id")
  .eq("clinic_id", clinicId)
  .limit(50);
```

- **Sempre** `.eq("clinic_id", ...)` em queries client-side. A RLS já
  filtra, mas explicitar evita confusão e habilita índices.
- **Limit** padrão é 1000 do Supabase. Em listas grandes, pagine.

### Read com cache (TanStack Query)
```ts
const { data, isLoading } = useQuery({
  queryKey: ["leads", clinicId, filter],
  queryFn: async () => {
    const { data } = await supabase.from("leads").select("*")...;
    return data ?? [];
  },
  staleTime: 30_000,
});
```

Invalidar manualmente após mutate:
```ts
await supabase.from("leads").update({...}).eq("id", id);
queryClient.invalidateQueries({ queryKey: ["leads"] });
```

### Write
```ts
const { error } = await supabase.from("leads").update({ stage_id }).eq("id", id);
if (error) { toast.error(error.message); return; }
```

- Realtime propaga update para outros clientes automaticamente.
- Para writes de outros usuários, o `useRealtimeList` atualiza local
  sem precisar de invalidate.

### Invoke edge function
```ts
const { data, error } = await supabase.functions.invoke("ai-assist", {
  body: { lead_id, mode: "summarize" },
});
```

- **NUNCA** chame por path `/api/...`. Use `invoke` ou construa via
  `import.meta.env.VITE_SUPABASE_URL`.
- Erros vêm em `error` ou em `data.error` (depende da função). Sempre
  testar ambos.

---

## 4. Realtime

`useRealtimeList<T>` em `useCrm.ts` é o padrão para tabelas que precisam
viver atualizadas (leads, stages). Para casos pontuais:

```ts
useEffect(() => {
  const ch = supabase.channel(`messages-${leadId}`)
    .on("postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
        (payload) => { /* patch local */ })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [leadId]);
```

Tabelas com realtime habilitado (publication `supabase_realtime`):
ver `docs/database/SCHEMA.md` (`leads`, `pipeline_stages`, `messages`,
`broadcast_recipients`, `broadcast_events`, `email_send_logs`, etc.).

---

## 5. Forms (UI)

`react-hook-form` + `zodResolver`. Padrão visto em `Settings`,
`Onboarding`, `EmailTemplateEditor`:

```tsx
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: {...},
});
// ...
<Form {...form}>
  <FormField control={form.control} name="..." render={...} />
</Form>
```

Validações de servidor (edge function) também devem ser **espelhadas**
no schema do frontend para feedback imediato.

---

## 6. URL state vs local state

| Caso                                          | Onde mora               |
|-----------------------------------------------|-------------------------|
| Lead aberto                                   | `/inbox/:leadId` path   |
| Tab ativa no drawer                           | local state (não é URL) |
| Filtros do kanban (estágio, attendant, data)  | localStorage + state    |
| Filtros salvos compartilháveis                | `saved-views.ts` + URL hash (futuro) |
| Pipeline selecionado                          | localStorage `mk:pipeline:current` |
| Diálogo aberto (lead drawer, confirm)         | `useDialogs` context    |
| Modal pontual (`WhatsAppQrDialog`)            | local state + query `?qr=1` para deep-link |

---

## 7. Pegadinhas

- **TanStack Query + realtime**: se um realtime hook patcha local e o
  Query continua com cache antigo, o componente pode renderizar
  inconsistente. Solução: invalidar a query no `onPostgresChanges` OU
  ler do hook realtime e ignorar Query.
- **Auth flicker**: usar `loading` do `useAuth` antes de qualquer
  redirect. `ProtectedRoute` já faz; em código custom, lembrar.
- **`maybeSingle` vs `single`**: para queries que podem não ter
  resultado (membership de um user em uma clínica), use `maybeSingle()`
  para evitar erro.
- **Lower/case-sensitive**: emails vão lowercased no banco (`ilike` no
  forms-ingest). Ao comparar no frontend, normalizar.
- **Telefone**: SEMPRE passar por `normalizePhoneBR` antes de salvar ou
  buscar. Inconsistências aqui causam "lead duplicado".

---

## 8. Melhorias sugeridas

- Migrar listagens não-realtime restantes para TanStack Query (hoje
  ainda há `useState` + `fetch` direto em algumas páginas).
- Centralizar query keys em `src/lib/query-keys.ts` para evitar typos
  em invalidações.
- Adicionar `onError` global em `queryClient` para toast automático.
- Considerar Zustand para state UI compartilhado entre páginas
  (filtros, seleções) — hoje cada página recria.
