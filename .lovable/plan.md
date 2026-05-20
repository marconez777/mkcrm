## Problema

Encontrei o bug em `supabase/functions/dispatch-campaign/index.ts` (linhas 111–112):

```ts
if (campaign.test_email) {
  pushRec(campaign.test_email, null, null);   // ← envia SÓ pro test_email
} else if (campaign.segment_id) {
  // resolve segmento
}
```

Como você salvou um e-mail de teste no formulário da campanha, esse `if` casa primeiro e o segmento `Leads da Lista` (com 2 contatos) é totalmente ignorado no envio real. O `test_email` deveria valer **apenas** no modo "Enviar teste" (`test_only: true`), nunca no disparo real.

## Correção

Remover o ramo `if (campaign.test_email)` da resolução de destinatários do envio real. A lógica fica:

1. Se `segment_id` existir → usa `resolve_email_segment` (segmentos dinâmicos + contatos manuais do segmento).
2. Senão → "Todos os leads" (leads da clínica + contatos manuais sem segmento, como já está).

O `test_email` continua sendo usado normalmente no bloco `if (test_only)` acima (linhas 54–90) para o botão "Enviar teste".

## Arquivo afetado

- `supabase/functions/dispatch-campaign/index.ts` — remover linhas 111–112 e ajustar o `else if` para `if`.
- Redeploy da função.

Sem mudanças de schema ou frontend.
