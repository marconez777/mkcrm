
## Objetivo

Substituir todas as ocorrências **visíveis ao usuário** da marca "MK-CRM" por **"Chat Funnel AI"** em todo o projeto.

## Arquivos que serão alterados (14)

### Site institucional (textos visíveis)
- `src/pages/site/MarketingSite.tsx` — `document.title` ("MK-CRM · CRM com WhatsApp…")
- `src/components/site/SiteNav.tsx` — logo + alt
- `src/components/site/SiteFooter.tsx` — logo, alt, copyright
- `src/components/site/Hero.tsx` — alt da escultura 3D ("…inteligência do MK-CRM")
- `src/components/site/Marquee.tsx` — aria-label "Recursos do MK-CRM"
- `src/components/site/About.tsx` — badge "Sobre o MK-CRM", aria-label, "Por que MK-CRM"
- `src/components/site/Features.tsx` — headline "Por que MK-CRM" + aria-label
- `src/components/site/Capabilities.tsx` — aria-label "Tudo o que vem dentro do MK-CRM"
- `src/components/site/Testimonials.tsx` — referências de copy (mesmo comentada hoje, vou atualizar)
- `src/components/site/Blog.tsx` — referências de copy

### App autenticado
- `src/components/AppShell.tsx` — logo da sidebar (texto + alt)
- `src/components/admin/SupportPanel.tsx` — prompt do assistente ("Você é o assistente de suporte do MK-CRM…")
- `src/components/support/SupportChatFab.tsx` — header do export de conversa ("Conversa MK-CRM Suporte")
- `src/pages/SettingsForms.tsx` — label do botão "Baixar mk-crm-forms.zip" → "chat-funnel-ai-forms.zip"

## NÃO serão alterados (intencional)

Itens técnicos que quebrariam se renomeados — mantidos como estão:

- `src/lib/app-url.ts` — comentário menciona `mkcrm.lovable.app` (URL real de deploy publicado). A URL do Lovable não muda só porque o nome muda.
- `src/pages/SettingsForms.tsx:624` — identificador `mkcrm` dentro do snippet de integração JS (provável `window.mkcrm` que sites de clientes já usam). Mudar quebraria integrações ativas.
- Nome do projeto em `package.json`, paths como `src/assets/mk-logo.png`, nomes de arquivos/pastas — são identificadores internos, não afetam UX.
- Domínios reais (`crm.mkart.com.br`, `mkcrm.lovable.app`).

## Pontos para confirmar antes de eu executar

1. **Logo (`src/assets/mk-logo.png`)** — fica o mesmo arquivo de imagem ou você vai me passar um logo novo do "Chat Funnel AI"? Por padrão **mantenho o arquivo atual** e só troco o texto/alt ao lado.
2. **Nome do filename de download** (`mk-crm-forms.zip` → `chat-funnel-ai-forms.zip`) — só muda o label do botão; o arquivo zip real (se gerado em outro lugar) não é tocado.
3. **Identificador do snippet `mkcrm`** em SettingsForms — confirmo que mantenho? (recomendo manter pra não quebrar quem já instalou).

Posso seguir com essas premissas, ou você quer ajustar alguma?
