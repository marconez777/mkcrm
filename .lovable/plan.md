## Objetivo

Adicionar uma barra de progresso radial (a do print) como **loader visual** nas áreas de carregamento mais pesado da ferramenta, com o texto **"Carregando"** (não "Upload") e a porcentagem real do progresso quando dá pra calcular.

## O que será criado

### 1. `src/components/ui/progress-radial.tsx`
Componente `ProgressRadial` adaptado do snippet enviado, **usando tokens semânticos do design system** (não cores hardcoded como `text-green-500`):
- Track: `text-muted`
- Indicator: `text-primary` (segue o tema da ferramenta)
- `strokeLinecap="round"`, animação suave em `value`
- Props: `value`, `size`, `strokeWidth`, `startAngle`, `endAngle`, `label`, `children`

### 2. `src/components/ui/loading-radial.tsx`
Wrapper de uso simples que renderiza o ProgressRadial centralizado com:
- `%` grande no centro
- texto **"Carregando"** abaixo (i18n PT-BR)
- legenda opcional embaixo (ex.: "Contatos", "Segmento", "Relatório")
- Variantes: `inline` (dentro de uma Card) e `overlay` (fullscreen com backdrop blur sobre o conteúdo)

### 3. Progresso real em `src/lib/fetch-all.ts`
Adicionar callback opcional `onProgress(loaded, total?)` em `fetchAllPaged` e `fetchAllByIn`:
- `fetchAllPaged`: emite após cada página (sem total exato, usa `hardCap` como denominador quando informado, senão modo indeterminado).
- `fetchAllByIn`: total = `unique.length`, emite após cada chunk → progresso preciso 0–100%.

Sem quebrar chamadas existentes (callback é opcional).

## Onde aplicar o loader

Pontos identificados como "carregamento denso" (já usam `fetchAllPaged`/`fetchAllByIn`, então dá pra mostrar progresso real):

| Local | Quando | Tipo |
|---|---|---|
| `EmailContacts.tsx` | carregar todos os contatos (4000+) | overlay na lista |
| `EmailSegments.tsx` — salvar segmento | resolve + persiste 4000+ leads | overlay no botão Salvar |
| `EmailSegments.tsx` — sugestões de filtro | `fetchAllPaged` de leads | inline no painel |
| `CampaignRecipientsPreview.tsx` | resolver RPC + checar unsubs em chunks | inline na prévia |
| `CampaignReportDialog.tsx` | agregar `email_logs`/`email_queue` paginados | inline no dialog |
| `AutomationReportDialog.tsx` | mesma coisa + `fetchAllByIn` de nomes | inline no dialog |
| `EmailDashboard.tsx` | logs paginados (até 50k) | inline no card |
| `EmailCampaigns.tsx` | agregação grande de logs/queue | inline no card de stats |

Onde não dá pra estimar (consultas únicas rápidas) continuamos com o spinner atual — o radial só aparece se a operação passar de ~400ms (threshold pra não piscar).

## Detalhes técnicos

- Cores via tokens (`hsl(var(--primary))`, `hsl(var(--muted))`) — nada hardcoded.
- O ProgressRadial recebe `value` controlado; os componentes consumidores mantêm um state `progress` atualizado via `onProgress`.
- Para operações sem total conhecido (`fetchAllPaged` sem hardCap explícito como teto), o componente entra em **modo indeterminado** (animação de rotação contínua) em vez de mostrar `%` falso.
- Threshold de 400ms antes de exibir, pra evitar flash em datasets pequenos.
- Mantém a mesma chamada `fetchAllPaged(build)` retrocompatível.

## Fora do escopo

- Não muda lógica de negócio, RLS, edge functions ou schema.
- Não substitui spinners de botões pequenos / skeletons já existentes em listas curtas.
- Não toca em áreas que não usam paginação pesada.
