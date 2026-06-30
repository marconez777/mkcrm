# Roadmap — Migração de domínio para `chatfunnelai.com`

Objetivo: substituir todas as referências hardcoded ao domínio antigo (`crm.mkart.com.br` e fallback `mkcrm.lovable.app`) pelo novo domínio oficial `https://chatfunnelai.com`, e validar que fluxos críticos (convites, reset de senha, emails transacionais, webhooks) apontem para o lugar certo.

## Fase 1 — Urgente (links quebrados hoje)

1. **Link de convite do Super Admin** — `supabase/functions/clinic-invite/index.ts:59`
   - Hoje: `https://crm.mkart.com.br/invite/${token}`
   - Trocar para `https://chatfunnelai.com/invite/${token}` (idealmente via env `PUBLIC_SITE_URL` com fallback no novo domínio).
   - Redeploy da edge function.

2. **Reset de senha** — `src/lib/app-url.ts`
   - `APP_BASE_URL` está `https://crm.mkart.com.br` e é usado em `Auth.tsx` para `redirectTo` do `resetPasswordForEmail`.
   - Trocar para `https://chatfunnelai.com` e atualizar o comentário do allowlist.
   - Garantir que `chatfunnelai.com` esteja no allowlist de Redirect URLs do Auth (Lovable Cloud).

## Fase 2 — Emails transacionais e relatórios

Edge functions com fallback antigo `https://mkcrm.lovable.app`:
- `supabase/functions/send-email/index.ts`
- `supabase/functions/send-email-batch/index.ts`
- `supabase/functions/ai-spend-notify/index.ts` (inclui também `from: "alerts@mkcrm.lovable.app"`)
- `supabase/functions/report-finalizados-mensal-or/index.ts`

Ações:
- Trocar fallback de `mkcrm.lovable.app` → `chatfunnelai.com`.
- Definir secret `PUBLIC_SITE_URL=https://chatfunnelai.com` para sobrescrever em runtime sem depender do fallback.
- Avaliar trocar remetente `alerts@mkcrm.lovable.app` por um endereço no novo domínio (depende de DNS/Resend configurado para `chatfunnelai.com`).

## Fase 3 — Site institucional e UI

- `src/components/site/SiteFooter.tsx:73` — email de contato `contato@mkart.com.br`. Decidir se passa a usar `contato@chatfunnelai.com` ou mantém Mkart.
- `src/pages/SettingsForms.tsx` (linhas 158 e 483) — placeholders `mkart.com.br` em "Domínios permitidos". Atualizar para placeholders neutros (`exemplo.com`) ou para `chatfunnelai.com`.
- Verificar `index.html` / metatags OG / canonical / favicon para refletir o novo domínio.

## Fase 4 — Webhooks e integrações externas

- `supabase/functions/eduzz-webhook/index.ts:299` — gera `redirectTo` a partir de `SUPABASE_URL` (vira `*.lovable.app/auth`). Trocar para `https://chatfunnelai.com/auth` (idealmente via `PUBLIC_SITE_URL`).
- Revisar painel da Eduzz / Evolution / Meta para apontar callbacks novos para `chatfunnelai.com`.
- Convidar tokens já gerados antes da troca continuarão com URL antiga; opcional: criar redirect de `crm.mkart.com.br/invite/*` → `chatfunnelai.com/invite/*` (DNS/edge) enquanto domínio antigo continuar no ar.

## Fase 5 — Backend / config

- Atualizar Supabase Auth: Site URL e Redirect URLs (adicionar `https://chatfunnelai.com`, manter antigos por X dias para não quebrar links pendentes).
- Atualizar `app_settings` / qualquer registro em DB que armazene base URL (verificar tabela `app_settings`, `clinic_secrets`, `email_domains`).
- Conferir cron jobs / `pg_cron` que chamam funções via URL absoluta.

## Fase 6 — QA e cutover

- Smoke test: convite novo → email recebido aponta `chatfunnelai.com` → aceitação funciona.
- Smoke test: reset de senha → email aponta novo domínio → fluxo completo.
- Smoke test: campanha email + alerta de spend → links no corpo apontam novo domínio.
- Smoke test: webhook Eduzz → redirect pós-login funciona.
- Verificar SEO (canonical, sitemap, robots) e Open Graph.

## Detalhes técnicos

Sugestão de implementação (Fase 1 + 2): centralizar em uma constante única.

- Frontend: `src/lib/app-url.ts` → `APP_BASE_URL = "https://chatfunnelai.com"`.
- Edge functions: padronizar leitura `const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://chatfunnelai.com";` em todas as funções listadas e adicionar secret `PUBLIC_SITE_URL` no projeto.

Itens **fora** deste roadmap (manter como estão, são identificadores internos, não URLs públicas):
- `contato@mkart.com.br` em migrations antigas (apenas seed histórico de super admin).
- `data-mk-*` atributos.
- Domínio interno do Supabase (`*.supabase.co`).

## Pergunta aberta

- O domínio antigo `crm.mkart.com.br` deve continuar respondendo (redirect 301 para o novo) ou pode ser desligado? Isso decide se precisamos manter compat nas Fases 1–2.
