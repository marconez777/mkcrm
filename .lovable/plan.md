## Contexto

Entendi mal antes — `seguranca` na verdade é só o subdomínio CNAME que o Resend usa para tracking de cliques (links1.resend-dns.com). O domínio de envio real configurado e **já verificado** no Resend da ÓR é a raiz `clinicaohrpsiquiatria.com` (prints 2-4).

Hoje no banco temos registrado o domínio errado:
- `email_domains` → `seguranca.clinicaohrpsiquiatria.com` (status `pending`, resend_id `5b837948-...`)

Esse registro foi criado por engano e aponta para um domínio do Resend que não vai verificar (pois os DNS foram configurados na raiz, não no subdomínio).

## Plano

1. **Buscar o Resend domain ID real** de `clinicaohrpsiquiatria.com`
   - Chamar `GET https://api.resend.com/domains` usando a `RESEND_API_KEY_OR` da clínica ÓR
   - Localizar a entrada `clinicaohrpsiquiatria.com` (status `verified`) e capturar o `id`

2. **Limpar o registro errado**
   - Deletar do Resend o domínio fantasma `seguranca.clinicaohrpsiquiatria.com` (id `5b837948-77a2-4db8-8c6f-553aa8092df4`) via `DELETE /domains/{id}` com a key da ÓR
   - Deletar a linha `c963c63a-dde2-4fe3-9269-49c71bc66e4c` de `email_domains`

3. **Inserir o domínio correto**
   - Inserir nova linha em `email_domains`:
     - `clinic_id` = `cf038458-457d-4c1a-9ac4-c88c3c8353a1` (ÓR)
     - `domain` = `clinicaohrpsiquiatria.com`
     - `resend_domain_id` = (id obtido no passo 1)
     - `status` = `verified`
     - `region` = `sa-east-1` (São Paulo, conforme print)
     - `dns_records` = registros retornados pela API
     - `last_checked_at` = now()

4. **Validar**
   - Reler `email_domains` e confirmar que a ÓR aparece com a raiz verificada
   - Confirmar com você que `/settings/email` mostra o domínio correto

## Nenhuma mudança de código

A edge function `email-domain-manage` e o resto da integração já estão corretos — só foi cadastrado o subdomínio errado. Não é preciso alterar código, apenas dados.

## Pergunta antes de executar

O domínio raiz `clinicaohrpsiquiatria.com` muito provavelmente já é usado para receber e-mails normais da clínica (caixas de entrada em `@clinicaohrpsiquiatria.com`). Usar a raiz como sender significa que e-mails transacionais sairão como `algo@clinicaohrpsiquiatria.com`. Confirma que é isso que você quer? Caso prefira separar (boa prática para preservar a reputação do domínio principal), o ideal seria cadastrar um subdomínio dedicado tipo `notify.clinicaohrpsiquiatria.com` ou `mail.clinicaohrpsiquiatria.com` no Resend. Mas se você já decidiu pela raiz, sigo direto com o plano acima.
