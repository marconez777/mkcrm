## Escopo

Aplicar a direção **Clean — pills suaves** (selecionada) na tela `src/pages/email/EmailCampaigns.tsx`, mantendo 100% das colunas, ações e estados atuais. Os refinamentos visuais (radius generoso, sombra macia, pills de status com tinted background + borda sutil, hover suave, header arejado, mini progress bar) viram tokens reutilizáveis para depois propagarmos ao resto do hub de Email.

## Mudanças

### 1. Tokens no design system (`src/index.css`)
- Adicionar variáveis semânticas:
  - `--surface-muted` (fundo off-white tipo `#f9fafb`)
  - `--card-radius-lg` (20px)
  - `--shadow-soft` (`0 8px 30px rgb(0 0 0 / 0.04)`)
- Adicionar paletas tinted para badges de status (já existem `--primary`, mas precisamos das variantes soft):
  - `--status-sending-bg/fg`, `--status-scheduled-bg/fg`, `--status-sent-bg/fg`, `--status-paused-bg/fg`, `--status-failed-bg/fg`, `--status-draft-bg/fg`
- Espelhar tudo no `dark` mode.

### 2. Componente `StatusBadge` novo (`src/components/email/StatusBadge.tsx`)
- Recebe `status` da campanha e renderiza pill arredondada com `bg + fg + border` do token correspondente.
- Estado `sending` ganha bolinha verde com `animate-pulse` interno (substitui o `LivePulseDot` externo só nesta lista).
- Reaproveitável em outras telas (logs, fila, automações).

### 3. Refatorar `EmailCampaigns.tsx`
- Container externo: trocar `max-w-6xl` por wrapper com `bg-[hsl(var(--surface-muted))]` arejado e header com mais respiro vertical.
- Header: título maior (`text-2xl font-bold`), subtítulo `text-muted-foreground`, botão "Nova campanha" com `rounded-xl`, sombra suave, ícone à esquerda.
- Substituir `Card` da tabela por um wrapper com `rounded-[var(--card-radius-lg)] shadow-[var(--shadow-soft)] border border-border/60 overflow-hidden`.
- `TableHeader`: fundo `bg-muted/40`, labels `text-[11px] uppercase tracking-wider text-muted-foreground font-semibold`.
- Linhas: `py-5`, hover `bg-muted/40 transition-colors`, divisores `divide-y divide-border/40`.
- Coluna **Enviados**: trocar texto puro por `{sent} / {total}` + mini progress bar (1.5px, w-24) com cor `primary` quando `sending`, `muted-foreground/40` quando `sent`, vermelho suave quando `failed`. Mantém valores reais já calculados.
- Coluna **Status**: usar o novo `StatusBadge`. Botão "Ao vivo" continua existindo na coluna de ações, mas com aparência de outline suave (não verde sólido) — o pulso passa a viver dentro do badge.
- Coluna **Ações**: ícones em `text-muted-foreground` com hover colorido (`hover:text-primary` para positivos, `hover:text-destructive` para excluir). Padding consistente. Remover labels nos ícones secundários (Editar/Duplicar/Pausar/Retomar/Lixeira) e manter `title` para acessibilidade — só "Relatório" e "Ao vivo" continuam como botões com texto.
- Estado vazio: card centralizado com ícone + título "Nenhuma campanha ainda" + subtítulo + CTA secundário.

### 4. Não muda
- Nenhuma lógica de negócio: `load()`, `dispatch`, `pause`, `resume`, `duplicate`, `remove`, dialogs, `CampaignReportDialog`, `CampaignLiveDialog`, `CampaignRecipientsPreview` permanecem iguais.
- Tabs superiores do hub (vivem em `EmailHub.tsx`) não são tocadas neste passo.
- Rotas, queries, RLS, edge functions: nada.

## Fora de escopo (próximos passos sugeridos)
- Aplicar os mesmos tokens nas outras abas (Templates, Logs, Fila, Segmentos, Contatos, Descadastros) — fazemos depois que você validar visualmente esta tela.
- Paginação real da tabela (hoje carrega tudo).

## Arquivos
- `src/index.css` — novos tokens
- `src/components/email/StatusBadge.tsx` — novo
- `src/pages/email/EmailCampaigns.tsx` — refator visual

Pronto para implementar?