> ⚠️ **Escopo:** este arquivo trata apenas dos **emails de autenticação** (reset de senha, confirmação de cadastro, magic link). Para o módulo de **email marketing** (campanhas, automações, templates) ver `docs/edge-functions/EMAIL.md` e `docs/flows/EMAIL_CAMPAIGN.md`. Para o **roadmap de performance/escala** do módulo de marketing ver `docs/roadmap/EMAIL_SCALE.md`.
>
> Última atualização: 2026-05-26.

---


## Problema

1. O link no email vai para o domínio errado (provavelmente `mkcrm.lovable.app`) porque hoje uso `window.location.origin` como `redirectTo` — depende de onde ela abriu o formulário.
2. O template está em inglês e vem de `no-reply@auth.lovable.cloud`, sem identidade visual.

---

## Escopo

### 1. Forçar o link para `crm.mkart.com.br` (UI — imediato)

- Em `src/pages/Auth.tsx`, trocar `redirectTo: ${window.location.origin}/reset-password` por uma constante fixa `https://crm.mkart.com.br/reset-password`.
- Centralizar em `src/lib/app-url.ts` (novo): `export const APP_BASE_URL = "https://crm.mkart.com.br"` — pra reutilizar em qualquer outro lugar futuramente.

> Ambos os domínios (`crm.mkart.com.br` e `mkcrm.lovable.app`) já estão no allowlist do Supabase Auth, então forçar o domínio próprio só funciona — não precisa mexer em config do Supabase.

### 2. Customizar o email (template em pt-BR com marca MK CRM)

Hoje a workspace **não tem domínio de email configurado**. Pra mandar de `noreply@mkart.com.br` (ou subdomínio) precisamos:

**2a. Configurar o domínio de email** — vou abrir o dialog do Lovable Cloud pra você escolher/validar o subdomínio (sugerido: `notify.mkart.com.br`). Você só precisa adicionar 2 NS records no seu provedor de DNS — o Lovable cuida do resto (SPF/DKIM/MX). DNS pode levar até 72h, mas não trava o resto.

**2b. Scaffold dos templates de auth** (após configurar o domínio):

- Cria edge function `auth-email-hook` + 6 templates React Email em `_shared/email-templates/`.
- Vou customizar TODOS em **português brasileiro** com a identidade do MK CRM:
  - Cores: do `src/index.css` (primary, foreground, muted-foreground, --radius).
  - Fonte: stack do app.
  - Logo: o ícone `MessageSquare` já usado no `/auth` (ou se existir um arquivo de logo em `public/`, eu uso).
  - Tom: direto, semelhante ao app ("Redefinir sua senha", "Confirmar email", etc.).
- Templates afetados:
  - `recovery.tsx` → "Redefinir sua senha" — botão "Redefinir senha"
  - `signup.tsx` → "Confirme seu email no MK CRM"
  - `magic-link.tsx` → "Seu link de acesso ao MK CRM"
  - `invite.tsx` → "Você foi convidado para o MK CRM"
  - `email-change.tsx` → "Confirme seu novo email"
  - `reauthentication.tsx` → "Código de verificação"

**2c. Deploy** do `auth-email-hook`.

### 3. Atualizar docs

- `docs/architecture/AUTH.md`: documentar URL fixa de redirect e templates customizados.

### Fora de escopo

- Mudar Site URL/Allowlist no Lovable Cloud (já está OK).
- Auth nativa (`supabase.auth.*`) — não há edge function de login custom.
- Email marketing — só auth.

### Notas técnicas

- Sem migração de DB.
- Sem novas secrets — Lovable Cloud provisiona `LOVABLE_API_KEY` automaticamente.
- O hardcode do redirect já resolve o problema mesmo antes do DNS validar (o link só vai parar de ser `@auth.lovable.cloud` quando o DNS estiver verde, mas pelo menos cairá em `crm.mkart.com.br` desde já).
- Se o DNS demorar, ela já pode resetar a senha agora pelo template default em inglês — só o link vai pro domínio certo.
