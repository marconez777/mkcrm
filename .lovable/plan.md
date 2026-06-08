# Corrigir métrica "Último login" no Admin › Usuários

## Problema

A coluna usa `auth.users.last_sign_in_at`, que o Supabase só atualiza quando há **novo login com credenciais** (senha/OAuth). Sessões que continuam ativas via refresh de token (uso diário normal) **não atualizam** esse campo, gerando "20d atrás" para usuários que estão usando o app todo dia.

## Solução

Calcular `last_seen_at` a partir de `MAX(auth.sessions.updated_at)` por usuário — esse campo é atualizado a cada refresh de token, refletindo o uso real.

## Mudanças

### 1. `supabase/functions/admin-users-list/index.ts`
- Após buscar a lista de usuários, executar uma query agregada via service_role:
  ```sql
  select user_id, max(updated_at) as last_seen_at
  from auth.sessions
  where user_id = any($1)
  group by user_id
  ```
- Adicionar ao payload de cada usuário: `last_seen_at` (pode ser null se nunca teve sessão).
- Manter `last_sign_in_at` no payload (útil para diagnóstico/auditoria).

### 2. `src/components/admin/UsersPanel.tsx` (e tipo do usuário)
- Mudar a coluna "Último login" para exibir `last_seen_at` (fallback para `last_sign_in_at` se null).
- Renomear o cabeçalho para **"Última atividade"** — mais preciso, já que reflete uso (não só login).
- Tooltip explicando: *"Última vez que a sessão do usuário foi renovada (uso real do app)."*
- CSV export: incluir as duas colunas (`last_seen_at`, `last_sign_in_at`).

### 3. Documentação
- `docs/support/pages/admin.md` (seção Usuários): atualizar descrição da coluna.
- `docs/maps/ADMIN_SUPER_ADMIN.md`: nota técnica sobre a fonte do dado.

## Detalhes técnicos

- `auth.sessions.updated_at` é atualizado pelo GoTrue em cada refresh (default a cada ~1h). Granularidade ≈ 1h é suficiente para "Xd atrás".
- Sessões expiradas/revogadas continuam na tabela com `updated_at` antigo — ok para nosso uso.
- Sem migração nem mudança de schema. Apenas leitura via service_role na edge function.

## Validação

Após o deploy, conferir:
- `felixm.edilene` deve mostrar ~2 dias (não 20).
- `ivanbaren` deve mostrar horas (não 10 dias).
- Usuários que nunca logaram continuam com "—".
