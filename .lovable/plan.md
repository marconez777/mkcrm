
## Objetivo

Sempre que um email der bounce (hard ou soft), o endereço deve ir automaticamente para a lista de descadastrados e sair da base de contatos — sem depender de limpeza manual.

## Abordagem

Hoje a função `resend-webhook` só adiciona à supressão quando o bounce é **hard**. Soft bounces ficam de fora, e contatos em `email_segment_contacts` continuam ativos. Vou centralizar tudo em **um trigger no banco**, que é o lugar universal: funciona independente da origem (webhook do Resend, importação manual, qualquer edge function que insira em `email_logs`).

### O que o trigger faz

Disparado em `AFTER INSERT OR UPDATE` em `public.email_logs`, quando `bounced_at` passa de NULL para um valor (ou já entra preenchido):

1. **Insere em `email_unsubscribes`** com `reason='bounce'` e `source='auto-bounce-trigger'` (idempotente, usa `ON CONFLICT DO NOTHING`).
2. **Remove o email de `email_segment_contacts`** dessa clínica.
3. O trigger existente `trg_cancel_pending_on_unsubscribe` já cuida de cancelar emails pendentes — não precisa duplicar.

### Cobertura

- Hard bounce ✓ (já funcionava no webhook, agora também no banco)
- Soft bounce ✓ (novo — antes ficava ignorado)
- Bounce inserido por qualquer caminho futuro ✓
- Reprocessamento de webhook duplicado ✓ (idempotente via unique key)

### Limpeza no webhook

Removo o trecho específico de hard bounce do `resend-webhook/index.ts`, já que o trigger cobre. Isso evita lógica duplicada e mantém uma única fonte da verdade.

## Detalhes técnicos

**Migration:**

```sql
CREATE OR REPLACE FUNCTION public.tg_suppress_on_bounce()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.bounced_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.bounced_at IS NULL)
     AND NEW.recipient_email IS NOT NULL THEN

    INSERT INTO public.email_unsubscribes (clinic_id, email, reason, source)
    VALUES (NEW.clinic_id, lower(NEW.recipient_email), 'bounce', 'auto-bounce-trigger')
    ON CONFLICT (clinic_id, email) DO NOTHING;

    DELETE FROM public.email_segment_contacts
    WHERE clinic_id = NEW.clinic_id
      AND lower(email) = lower(NEW.recipient_email);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_email_logs_suppress_on_bounce
AFTER INSERT OR UPDATE OF bounced_at ON public.email_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_suppress_on_bounce();
```

**Edge function:** removo o bloco `if event.type === 'email.bounced' ... bounce.type === 'hard'` que faz upsert em `email_unsubscribes` — fica somente a atualização de status/bounced_at, e o trigger faz o resto.

## Arquivos afetados

- nova migration em `supabase/migrations/`
- `supabase/functions/resend-webhook/index.ts` — remoção do upsert manual
- redeploy da edge function

## Não muda

- Comportamento de `complained` (continua suprimindo direto no webhook)
- Lógica de retry, dedup, status
- Frontend
