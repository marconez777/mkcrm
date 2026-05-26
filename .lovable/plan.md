## Contexto

O domínio `clinicaohrpsiquiatria.com` já está configurado na conta Resend da Clínica OR (domínio verificado + webhook criado). Só precisamos atualizar as credenciais no projeto.

A boa notícia: o `from_email` dos emails é configurado **por template** no banco (campo `from_email` em cada template), não está hardcoded. Então não precisa mexer em código nenhum — só nas secrets e nos templates existentes.

## Passos

### 1. Atualizar as 2 secrets
- `RESEND_API_KEY` → nova API key da conta Clínica OR
- `RESEND_WEBHOOK_SECRET` → signing secret do novo webhook

### 2. Redeploy dos edge functions que usam essas secrets
- `send-email` (usa RESEND_API_KEY)
- `resend-webhook` (usa RESEND_WEBHOOK_SECRET)
- `dispatch-campaign` (chama send-email)

### 3. Atualizar templates existentes
Você precisa editar cada template em `/email/templates` e mudar o campo **From Email** de `...@mkart.com.br` para `...@clinicaohrpsiquiatria.com` (ex: `noreply@clinicaohrpsiquiatria.com`). Senão o envio falha porque o domínio não existe na conta Resend nova.

### 4. Limpar referência antiga (opcional)
Em `supabase/functions/clinic-invite/index.ts` linha 59 ainda existe `https://crm.mkart.com.br/invite/...`. Isso é só o link de convite (não envio de email) — posso trocar para o domínio do app novo se quiser, ou deixar.

## O que preciso de você

Confirme o plano e me peça para pedir as secrets. Aí abro o formulário seguro para você colar a `RESEND_API_KEY` e a `RESEND_WEBHOOK_SECRET` novas.