## Situação

Você adicionou `mkart.com.br` na conta Resend errada (Clínia OR). Não há domínio Lovable Emails configurado neste projeto — toda a config de email está direto no Resend via `RESEND_API_KEY`. Então o "revert" é todo no lado do Resend + DNS, não na Lovable.

## Passos para reverter

### 1. Na conta Resend ERRADA (Clínia OR)
- Entrar em **Domains** → selecionar `mkart.com.br` → **Delete domain**
- Em **Webhooks** → deletar o webhook que aponta para `https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/resend-webhook` (se foi criado nessa conta)
- Em **API Keys** → revogar a key que está sendo usada hoje (a que está no secret `RESEND_API_KEY` deste projeto)

### 2. No DNS do mkart.com.br (registrar)
Remover todos os registros que o Resend mandou adicionar para verificar o domínio:
- Registros **TXT** (SPF / `_resend` / DMARC se criou)
- Registros **DKIM** (CNAME tipo `resend._domainkey...`)
- **MX** de bounce (`send.mkart.com.br` ou similar) se foi adicionado

Manter os registros MX/SPF originais que você já usava para email normal.

### 3. Na conta Resend CERTA
- Adicionar `mkart.com.br` (ou subdomínio, ex.: `mail.mkart.com.br`) em **Domains**
- Copiar os novos registros DNS que o Resend mostrar e adicionar no registrar
- Aguardar verificação (alguns minutos a algumas horas)
- Criar **API Key** com escopo no domínio novo
- Criar **Webhook** apontando para `https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/resend-webhook` com os eventos: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked` — copiar o **Signing Secret**

### 4. Você me manda
- Nova **RESEND_API_KEY** (da conta certa) → vou atualizar o secret
- Novo **RESEND_WEBHOOK_SECRET** → vou atualizar o secret
- (Opcional) domínio/subdomínio final usado, se mudar o `from:` default

### 5. Eu faço aqui
- Atualizar os 2 secrets (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`)
- Redeploy de `send-email`, `resend-webhook`, `dispatch-campaign` se necessário
- Teste de envio + verificação dos eventos open/click chegando em `email_logs`

## Importante
Não preciso mexer em nenhum código nem em DNS pela Lovable agora — a única coisa "Lovable side" são os dois secrets, que eu troco quando você me passar os novos valores.

Me confirma quando tiver feito os passos 1-3 e me mande os valores do passo 4.