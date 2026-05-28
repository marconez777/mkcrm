
## 1. Nova action `import` na edge function `email-domain-manage`

Adiciona um novo branch na function que:

1. Recebe `{ action: "import", clinic_id, domain }`.
2. Resolve a chave Resend da clínica (já existe `resolveResendKey`).
3. Faz `GET https://api.resend.com/domains`, procura o domínio pelo nome.
4. Se achar, dispara `POST /domains/:id/verify` e busca o detalhe (`GET /domains/:id`) pra pegar `status` e `records` atualizados.
5. Faz `upsert` em `public.email_domains` com `clinic_id`, `domain`, `resend_domain_id`, `status`, `region`, `dns_records`, `last_checked_at`.

Diferença pra action `create`: não tenta criar no Resend (o domínio já existe lá), só importa pro nosso banco.

## 2. Rodar o import pra MCD

Depois de fazer deploy da function, chamo via `supabase.functions.invoke` (com service role) uma vez:

```
{ action: "import", clinic_id: "3c48b379-f084-478d-a51c-9daa41ad661a", domain: "marketingcomdigital.com.br" }
```

Isso vai popular `email_domains` com o registro da MCD apontando pro Resend domain real. A partir daí o dropdown REMETENTE do editor já lista `@marketingcomdigital.com.br`.

## 3. Permitir salvar template sem remetente em `src/pages/email/EmailTemplateEditor.tsx`

- Remover a validação `if (!tpl.from_email.includes("@")) { toast.error("Configure um remetente"); return; }` do `save()`.
- Salvar normalmente com `from_email` vazio (string `""`).
- Adicionar badge amarelo `Configurar antes de enviar` ao lado do label REMETENTE quando `from_email` estiver vazio ou sem `@`.
- Manter validação dura apenas no **envio de teste** (`testOpen`) e onde a campanha é disparada — sem remetente válido, esses fluxos ficam bloqueados com toast claro.
- Proteger split `tpl.from_email.split("@")[1]` no render contra `from_email` vazio (fallback pra `domains[0]?.domain ?? ""`).
- No load `isNew`, deixar `from_email = ""` se não houver domínio (em vez de string truncada).

## Fora de escopo

- Não mexer em DNS, Cloudflare, chaves Resend ou config de auth.
- Não criar UI nova de gerenciamento de domínio — o import é interno, uma vez só.
- Não alterar fluxo de campanhas além da validação de envio.

## Arquivos afetados

- `supabase/functions/email-domain-manage/index.ts` — adicionar action `import`.
- `src/pages/email/EmailTemplateEditor.tsx` — afrouxar validação de save, adicionar badge de aviso, proteger split.
