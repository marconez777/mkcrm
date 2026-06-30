## Objetivo
Remover o logo MK (`mk-logo.png`) e o texto "Chat Funnel AI" escrito ao lado em código, substituindo pelas imagens novas enviadas. Atualizar favicon.

## Escolha entre os dois logos enviados
- **`chat-funnel-ai-ico.png`** (só ícone do infinito + cubos) → uso em **lugares quadrados/pequenos**: sidebar do AppShell, footer do site, favicon.
- **`chat-funnel-ai-500.png`** (lockup horizontal com texto, 500px, nítido) → uso na **navbar do site** (substituindo o ícone + texto separado, já que esse arquivo tem o texto embutido).
- **`chat-funnel-ai.png`** (versão gigante 1920px) → descartar; o 500 já tem o mesmo lockup em tamanho mais adequado e nítido para web.

## Arquivos novos
Copiar uploads para `src/assets/`:
- `src/assets/chat-funnel-ai-ico.png`
- `src/assets/chat-funnel-ai-500.png`

Copiar ícone para `public/favicon.png` (substitui o atual).

## Edições de código

### `src/components/AppShell.tsx` (sidebar)
- Trocar import `mk-logo.png` → `chat-funnel-ai-ico.png`.
- Manter `h-8 w-8 object-contain`.

### `src/components/site/SiteNav.tsx`
- Trocar import para `chat-funnel-ai-500.png`.
- Remover o `<span>Chat Funnel AI</span>` (lockup já tem o texto).
- Ajustar img para `h-8 w-auto object-contain` (sem `rounded-lg` / `object-cover`, que distorceriam o lockup).

### `src/components/site/SiteFooter.tsx`
- Trocar import para `chat-funnel-ai-500.png` ao lado do texto-marca, ou usar o ícone — vou usar o **lockup 500** também e remover o nome em texto, ficando coerente com a navbar. `h-8 w-auto object-contain`.

### `index.html`
- Favicon já aponta para `/favicon.png`; só substituir o arquivo binário.

### Asset antigo
- Apagar `src/assets/mk-logo.png` (nenhuma outra referência depois das edições).

## Fora do escopo
- Não mexer em `<title>MK CRM</title>` nem em outras strings de marca espalhadas (Onboarding, AdminBranding default, proposalContent etc.) — você pediu só "apagar logo MK + texto ao lado e colocar o novo logo". Se quiser renomear "MK CRM"/"MK Admin" também, me avisa que faço numa segunda passada.
