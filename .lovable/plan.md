## Objetivo
Remover completamente o recurso de bloqueio por tentativas de login, que está travando usuários mesmo digitando a senha correta.

## Mudanças

### 1. Frontend — `src/pages/Auth.tsx`
Trocar a chamada da edge function `auth-login` por login direto via Supabase Auth:
- Substituir `supabase.functions.invoke("auth-login", ...)` por `supabase.auth.signInWithPassword({ email, password })`.
- Remover o parsing customizado de erro do contexto da function.
- Mensagens de erro voltam a vir direto do Supabase Auth (já em PT no nosso fluxo padrão).

### 2. Edge function — `supabase/functions/auth-login/`
Deletar a função inteira (não é mais usada). Sem ela, não há mais contagem de tentativas, lockout de 12h, nem retorno 423.

### 3. Banco — migration
- `DROP TABLE public.auth_lockouts CASCADE;`
- Limpar quaisquer lockouts atuais ao remover a tabela (efeito colateral do drop).

## Detalhes técnicos
- `auth-login` hoje faz: checa `auth_lockouts.locked_until`, tenta `signInWithPassword`, em erro incrementa `failed_attempts` e bloqueia em 5 falhas por 12h. Tudo isso some.
- O Supabase Auth nativo continua tendo seu próprio rate-limit por IP (muito mais frouxo) — não há perda de segurança crítica, mas o usuário não fica mais travado após poucas tentativas.
- Tabela `auth_lockouts` tem políticas RLS apenas para super_admin; nada no app frontend lê ela, então o drop é seguro.
- Tipos do Supabase (`src/integrations/supabase/types.ts`) serão regenerados automaticamente após a migration.

## Não muda
- Fluxo de "Esqueci minha senha" continua igual.
- Telas, layout e demais regras de auth permanecem intactas.
