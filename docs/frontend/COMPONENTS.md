# Frontend — Componentes

> Organização dos componentes React em `src/components/**`.
>
> Última atualização: 2026-05-25

---

## 1. Estrutura

```text
src/components/
├── ui/              shadcn-ui (Radix + Tailwind). NÃO EDITAR sem critério.
├── AppShell.tsx     Layout root (sidebar + main).
├── CommandPalette.tsx, ShortcutsDialog.tsx
├── NavLink.tsx, ProtectedRoute.tsx, FeatureRoute.tsx
├── admin/           Cards/tables do super admin.
├── email/           Editor blocks→html, wizards, dialogs.
├── inbox/           Painéis da conversa (ChatPane, Composer, ContextRail, ...).
├── kanban/          Pipeline (PipelineSidebar, StagesManager, dialogs).
├── lead/            LeadJourney/Timeline e subcomponentes.
├── leads/           Cards de atribuição (LeadAttributionCard).
├── settings/        WhatsAppQrDialog etc.
└── tasks/           TaskDetailDialog.
```

---

## 2. `ui/` (shadcn-ui)

50+ primitives copiadas do shadcn. **Regras:**

- **Não substituir** por bibliotecas alternativas (MUI, Chakra, etc.).
- **Não remover** primitives mesmo que pareçam não usados — o command
  palette e novos features podem precisar.
- Customizações vão em **variantes via cva** dentro do próprio arquivo,
  não em wrappers paralelos.
- Tokens semânticos obrigatórios: `bg-background`, `text-foreground`,
  `border-border`, `bg-primary text-primary-foreground`, etc. Nunca
  `text-white`, `bg-slate-900`, hex literais (ver `conventions/CODE_STYLE.md`).
- `toast` vem de `sonner` (novo) — `use-toast.ts` e `toaster.tsx` são
  legado mas continuam montados em `App.tsx` para compat.

Componentes-chave usados em todo lugar: `Button`, `Input`, `Dialog`,
`Drawer`, `Sheet`, `Tabs`, `Card`, `Badge`, `Select`, `Popover`,
`Tooltip`, `DropdownMenu`, `Form` (react-hook-form + zodResolver),
`Table`, `Skeleton`, `Sonner`, `Calendar`, `ConfirmDialog`, `PromptDialog`.

---

## 3. Componentes do shell

### `AppShell.tsx`
Sidebar fixa 240px + `<main class="flex-1 overflow-hidden">{children}</main>`.
Monta lista de `navItems` filtrada por role+features (ver `ROUTING.md §2.3`).
Footer: status de saúde (`useHealth`), atalhos, logout. Status "down"
linka para `/settings?qr=1` para reconectar WhatsApp.

### `CommandPalette.tsx`
`Ctrl/Cmd+K` ou `/`. Lista comandos globais (criar lead, ir para inbox,
ir para template X). Usa `cmdk` via `ui/command`.

### `ShortcutsDialog.tsx`
Aberto por `?` ou `window.dispatchEvent(new Event("open-shortcuts"))`.
Lista hotkeys da página atual.

### `NavLink.tsx`
Wrapper trivial sobre o NavLink do router com classes default.

---

## 4. Inbox

`ChatPane` controla virtualização e scroll-to-bottom. `Composer` é o
editor (texto, anexos, áudio gravado, agendamento, encaminhar, quick
replies). `ContextRail` reúne abas `CustomFields`, `LeadTasks`,
`ScheduledMessages`. `MediaBubbles` renderiza imagem/áudio/vídeo/PDF
com fallback. `ScheduleMessageDialog` usa `lib/scheduled-messages.ts`.
`ForwardDialog` permite enviar a mensagem para outro lead. `TaskDialog`
cria/edita uma tarefa vinculada ao lead.

---

## 5. Kanban

`PipelineSidebar` (lista de pipelines + leads pinned/archived),
`PipelineSwitcher` (dropdown no topo), `StagesManager` (CRUD de
estágios), `MoveLeadDialog`, `EditStageDialog`, `EditPipelineDialog`,
`NewPipelineDialog`, `KommoImportDialog` (importa pipeline JSON do Kommo),
`ImportPipelineDialog` (importa próprio export do CRM),
`PipelineDateFilter`, `PipelineOverview` (cards de KPI no header),
`TopScrollbar` (espelha o scroll horizontal das colunas no topo,
usando `useHorizontalScroll`).

---

## 6. Lead

`LeadJourneyTab` — gráfico de jornada com eventos de tracking + form +
mensagens. `LeadTimelineTab` — feed unificado, filtrado por
`TimelineFilters`; cada item é `TimelineItemRow` com `types.ts` para
tipos discriminados (message / event / form / appointment / scheduled).

---

## 7. Email editor

`Canvas` mostra a árvore de blocks renderizada. `Palette` lista blocks
arrastáveis. `Inspector` edita props do block selecionado. `TipTapEditor`
para blocks de texto rico. Conversão blocks↔html em
`src/lib/email/{blocksToHtml,htmlToBlocks,sanitize,types,variables}.ts`.

---

## 8. Admin

`AiSpendLimitCard` (configura limite mensal por clínica),
`IntegrationsDomainsTable`, `IntegrationsKeysCard`, `IntegrationsQuotaTable`.
Todos consomem `integrations-status` e tabelas administrativas com RLS
relaxada para super_admin.

---

## 9. Settings

`WhatsAppQrDialog` — polling de `evolution-qr` até `connected`. Mostra
QR base64 + status. Trigger via `?qr=1` ou clique no status footer.

---

## 10. Convenções

- **Arquivos `.tsx` com 1 componente padrão por arquivo**, default
  export quando for componente de página/feature; named para utilitários.
- **Props sempre tipadas** com interface inline ou `type Props = {...}`.
- **`cn(...)`** (de `lib/utils.ts`) para juntar classes condicionais.
- **Acessibilidade**: `aria-label` em ícones sem texto, `title` quando há
  hover relevante, `role` em divs interativas.
- **Sem CSS in JS** (styled-components, emotion). Tudo Tailwind.

---

## 11. Pegadinhas

- Editar `ui/*` quebra cascata em todo o app — use variantes ou crie um
  wrapper específico.
- Componentes de dialog **devem** ser montados ao alto da árvore para
  funcionar com `useDialogs` (estado global). Já está em `App.tsx`.
- `MediaBubbles` precisa de URL pública/signed; ver `lib/media-url.ts`.
- `Canvas` (email editor) re-monta o iframe a cada keystroke se o
  `html` mudar referencialmente — `useMemo` no html é crítico.

---

## 12. Melhorias sugeridas

- Storybook (ou Ladle) para `ui/*` e componentes complexos do inbox/kanban.
- Extrair `inbox/` para um package independente — hoje há acoplamento
  com `useDialogs`, `useAuth`, `lib/drafts`, dificultando testes.
- Componente `<EmptyState/>` reutilizável.
