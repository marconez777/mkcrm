## Causa do erro

A função `public.accept_clinic_invite(_token)` falha com `invalid_or_expired_invite` sempre que o convite já foi aceito — mesmo quando quem está chamando é exatamente o usuário que aceitou. Hoje a query é:

```sql
SELECT * FROM clinic_invites
WHERE token = _token AND accepted_at IS NULL AND expires_at > now();
```

Cenários reais que disparam o erro indevidamente:
1. Re‑render após `signUp` + `signInWithPassword` chama a RPC duas vezes — a primeira marca `accepted_at`, a segunda explode.
2. O usuário reabre o link do convite depois de já tê‑lo aceitado (clica de novo no e‑mail / volta no histórico).
3. Admin gera mais de um convite para o mesmo e‑mail/clínica (ex.: tokens `aec22...` e `72d1...` no banco). Após aceitar um, o outro continua "ativo" mas qualquer clique mostra erro genérico.

O usuário, na prática, já é membro da clínica, mas vê "Convite inválido/expirado" e não é redirecionado.

## Fases

### Fase 1 — Migração: tornar `accept_clinic_invite` idempotente

Reescrever a função para:

1. Validar autenticação.
2. Buscar o convite por `token` (sem filtrar por `accepted_at IS NULL` ainda).
3. Se não existir → `invalid_invite`.
4. Validar e‑mail do usuário vs. e‑mail do convite (`invite_email_mismatch`).
5. Se `expires_at <= now()` **e** o usuário ainda não é membro da clínica → `expired_invite`.
6. Se já existe membership em `clinic_members` para `(clinic_id, user_id)` → retornar `clinic_id` (sucesso silencioso).
7. Caso contrário: `INSERT … ON CONFLICT (user_id) DO NOTHING` em `clinic_members`, marcar `accepted_at = COALESCE(accepted_at, now())`, retornar `clinic_id`.
8. Marcar como aceitos quaisquer outros convites pendentes do mesmo e‑mail para a mesma clínica (limpa duplicatas tipo `aec22...` + `72d1...`).

Mantém `SECURITY DEFINER` e `search_path = public`.

### Fase 2 — Front: `src/pages/Invite.tsx`

- No `handleSubmit`, após `signUp` checar se já existe sessão antes de chamar `signInWithPassword` (evita chamada redundante que dispara re‑render).
- Guardar uma ref `acceptingRef` para impedir que a RPC seja chamada duas vezes na mesma montagem.
- Tratar o retorno: se `rpcErr` tiver `message === 'invalid_invite'` mostrar "Convite inválido"; se `expired_invite` mostrar "Convite expirado"; se `invite_email_mismatch` mostrar mensagem específica. Outros erros → toast genérico.
- Quando `invite.expired === true` na tela inicial, oferecer botão "Ir para o app" se a sessão já estiver presente e o usuário já for membro (consultar `clinic_members` via `current_clinic_id()`), em vez de só "Peça um novo convite".

### Fase 3 — Documentação

Atualizar `docs/features/ADMIN_ACCOUNTS_AND_LIMITS.md` (seção de convites) e `docs/MAP.md` registrando:
- Função `accept_clinic_invite` agora é idempotente.
- Convites duplicados para o mesmo `(clinic_id, lower(email))` são auto‑encerrados quando um deles é aceito.
- Códigos de erro retornados: `not_authenticated`, `invalid_invite`, `expired_invite`, `invite_email_mismatch`.

## Detalhes técnicos

Esboço SQL da nova função:

```sql
CREATE OR REPLACE FUNCTION public.accept_clinic_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite clinic_invites%ROWTYPE;
  v_user_email text;
  v_uid uuid := auth.uid();
  v_already_member boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_invite FROM clinic_invites WHERE token = _token;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'invalid_invite'; END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_uid;
  IF lower(v_user_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM clinic_members
    WHERE clinic_id = v_invite.clinic_id AND user_id = v_uid
  ) INTO v_already_member;

  IF NOT v_already_member AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'expired_invite';
  END IF;

  INSERT INTO clinic_members (clinic_id, user_id, role)
  VALUES (v_invite.clinic_id, v_uid, v_invite.role)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE clinic_invites
     SET accepted_at = COALESCE(accepted_at, now())
   WHERE clinic_id = v_invite.clinic_id
     AND lower(email) = lower(v_invite.email)
     AND accepted_at IS NULL;

  RETURN v_invite.clinic_id;
END $$;
```

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — recriação de `accept_clinic_invite`.
- `src/pages/Invite.tsx` — guard de chamada dupla + mensagens de erro mais finas.
- `docs/features/ADMIN_ACCOUNTS_AND_LIMITS.md`, `docs/MAP.md` — atualização.
