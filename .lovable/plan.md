# Padronização visual + paginação real — Email Hub

## Objetivo

1. Aplicar os mesmos tokens já usados em **Campanhas** (`--surface-muted`, `--card-radius-lg`, `--shadow-soft`, header com `bg-muted/40` + `text-[11px] uppercase tracking-wider`, `StatusBadge` tinted) nas abas restantes: **Templates, Logs, Fila, Segmentos, Contatos, Descadastros**.
2. Substituir os `.limit(...)` fixos por paginação real (server-side) nas tabelas: **Campanhas, Logs, Fila, Descadastros, Contatos**.

Escopo apenas visual/presentation + paginação — nenhuma mudança de lógica de negócio, RPCs, edge functions ou schema.

---

## 1. Unificar a "casca" do hub

`src/pages/email/EmailHub.tsx`
- Mover o fundo `bg-[hsl(var(--surface-muted))]` + padding generoso para o wrapper externo do hub, para que todas as abas herdem o mesmo respiro.
- Remover de `EmailCampaigns.tsx` o wrapper duplicado (`min-h-screen bg-[hsl(var(--surface-muted))]` e `max-w-6xl`) — passa a usar o do hub.

Reutilizar 1 padrão de "card-tabela":
```
rounded-[var(--card-radius-lg)] border border-border/60 shadow-[var(--shadow-soft)] overflow-hidden bg-card
```
Cabeçalho de tabela padrão:
```
bg-muted/40 hover:bg-muted/40 border-border/40
text-[11px] uppercase tracking-wider font-semibold text-muted-foreground py-4
```

## 2. StatusBadge — generalizar

`src/components/email/StatusBadge.tsx`
- Adicionar labels/cores para status de **Logs** (`sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`, `failed`) e **Fila** (`pending`, `sending`, `sent`, `failed`, `cancelled`), reaproveitando os tokens `--status-*` já existentes (criar 2 novos se faltar: `delivered` mapeia em `sent`, `opened`/`clicked` mapeiam em `scheduled`, `cancelled` em `draft`).
- Remover as paletas hardcoded `bg-blue-500/15 text-blue-700...` em `EmailLogs.tsx` e `EmailQueue.tsx`.

## 3. Refatorar abas (somente CSS/markup)

Para cada arquivo abaixo, trocar `<Card>` por wrapper com os tokens, padronizar header da tabela, espaçar linhas (`py-4 / py-5`), trocar badges de status pelo `<StatusBadge>`, manter colunas/ações intactas.

- `src/pages/email/EmailLogs.tsx` — barra de filtros vira pill row mais leve; chips pequenos (`entregue/aberto/clicado/bounce/spam`) usando `border-border/60`.
- `src/pages/email/EmailQueue.tsx` — mesma casca; usar `StatusBadge`; botão "Processar agora" com `rounded-xl shadow-[var(--shadow-soft)]`.
- `src/pages/email/EmailUnsubscribes.tsx` — mesma casca; e-mail em fonte sans (não mono) com `truncate` e `title`.
- `src/pages/email/EmailSegments.tsx` — header e botões de ação com `rounded-xl`; cartões/linhas da lista com a casca padrão.
- `src/pages/email/EmailContacts.tsx` — barra de filtros em card suave; tabela com a casca padrão.
- `src/pages/email/EmailTemplates.tsx` — sidebar de pastas e lista de templates com a mesma casca (radius/shadow) e tipografia do header igual às outras abas.

Sem mudanças funcionais nesses arquivos.

## 4. Paginação real

Substituir `.limit(N)` por `.range(from, to)` + `count: "exact"` e adicionar uma barra de paginação no rodapé da tabela (usando `src/components/ui/pagination.tsx` já existente, ou um par simples de botões `‹ Página X de Y ›`).

Page size padrão: **25** (configurável internamente).

Arquivos:
- `EmailCampaigns.tsx`
  - Query base: `email_campaigns` com `range` e `count: "exact"`.
  - O cálculo de `sent/failed` (que hoje varre `email_logs` + `email_queue` para todos os ids) passa a rodar **apenas para os ids da página atual** — sem mudança de semântica, só escopo.
- `EmailLogs.tsx` — `email_logs` paginado; reset para página 1 ao mudar `filter` ou aplicar busca.
- `EmailQueue.tsx` — `email_queue` paginado; o `subscribe()` realtime continua, mas só dispara `load()` da página atual.
- `EmailUnsubscribes.tsx` — `email_unsubscribes` paginado.
- `EmailContacts.tsx` — paginação dupla: `leads` e `email_segment_contacts` no mesmo offset (`range`), e o `useMemo` que agrupa por e-mail passa a operar sobre o slice atual. Mantém os totais (`totals.total/leads/manual`) calculados via `count: "exact"` em cada query, sem trazer o dataset inteiro.

**Fora de escopo:** paginação em `EmailSegments` (lista curta) e `EmailTemplates` (já filtrado por pasta).

## Detalhes técnicos

- Tokens já estão em `src/index.css` (`--surface-muted`, `--card-radius-lg`, `--shadow-soft`, `--status-*`) — apenas reusar. Adicionar 1 par opcional `--status-clicked-bg/-fg` (violet suave) se quisermos diferenciar `clicked` de `scheduled`; senão reaproveitar.
- `StatusBadge` recebe nova prop opcional `size?: "sm" | "md"` para uso nas linhas mais densas de Logs/Fila.
- Paginação:
  ```ts
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  // ...
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count, error } = await supabase
    .from("email_logs")
    .select("*", { count: "exact" })
    .order("sent_at", { ascending: false })
    .range(from, to);
  ```
- Resetar `page` para 0 sempre que mudar `filter`/`search`.
- Rodapé padrão (componente local pequeno reutilizável `TablePager`):
  ```
  Mostrando X–Y de N · [‹]  página K/T  [›]
  ```

## Arquivos editados

- `src/index.css` *(opcional, só se adicionar `--status-clicked-*`)*
- `src/components/email/StatusBadge.tsx`
- `src/pages/email/EmailHub.tsx`
- `src/pages/email/EmailCampaigns.tsx`
- `src/pages/email/EmailLogs.tsx`
- `src/pages/email/EmailQueue.tsx`
- `src/pages/email/EmailUnsubscribes.tsx`
- `src/pages/email/EmailSegments.tsx`
- `src/pages/email/EmailContacts.tsx`
- `src/pages/email/EmailTemplates.tsx`
- `src/components/email/TablePager.tsx` *(novo, pequeno)*

## Validação

Após aplicar: navegar por cada aba e conferir (a) consistência visual com Campanhas, (b) paginação funcionando (próxima/anterior, total correto, filtros resetando para página 1), (c) ações existentes (excluir, processar, cancelar, reprocessar, exportar CSV) continuam intactas.
