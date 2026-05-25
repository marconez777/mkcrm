
## Contexto

Investigação para `gestao.sanapta@gmail.com`:
- Conta existe, confirmada, sem ban (`auth.users`).
- **Sem lockout** em `auth_lockouts` (já checado).
- Logs do GoTrue mostram que as tentativas falhadas dela retornam genuinamente `invalid_credentials` (a senha enviada estava errada do ponto de vista do servidor). Não é bug do nosso edge `auth-login`.

Como você não consegue resolver remoto (o problema é só no navegador dela), a melhor saída é deixar **ela mesma resetar a senha**. Hoje o app não tem esse fluxo — está listado como melhoria pendente em `docs/architecture/AUTH.md`.

---

## Escopo

Criar o fluxo completo de "Esqueci minha senha" usando o Supabase Auth padrão (`resetPasswordForEmail` + `updateUser`), **sem** depender de edge function nova nem de domínio de email customizado — vai usar o email default do Supabase (que já funciona). Depois, se quiser branding, dá pra plugar nos templates de auth do Lovable Cloud em uma etapa separada.

### Mudanças (UI apenas + 1 rota nova)

1. **`src/pages/Auth.tsx`**
   - Adicionar link `Esqueci minha senha` abaixo do botão Entrar.
   - Modo "forgot": mostra só campo de email + botão "Enviar link de redefinição".
   - Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${window.location.origin}/reset-password })`.
   - Mensagem neutra ("Se o email existir, enviamos o link") para não vazar enumeração.

2. **`src/pages/ResetPassword.tsx` (novo)**
   - Rota pública `/reset-password`.
   - Detecta a sessão de recovery (Supabase já dispara `PASSWORD_RECOVERY` via `onAuthStateChange` quando o usuário chega pelo link).
   - Form com nova senha + confirmação (mínimo 6 chars, igualdade).
   - Chama `supabase.auth.updateUser({ password })`.
   - Sucesso → toast + redireciona pra `/`.
   - Se acessar sem sessão de recovery válida → mensagem "link expirado ou inválido" + botão voltar para `/auth`.

3. **`src/App.tsx`**
   - Registrar `/reset-password` como rota pública (fora do `ProtectedRoute`).

4. **`docs/architecture/AUTH.md`**
   - Adicionar seção "Esqueci minha senha" documentando o fluxo.
   - Remover esse item da lista de "Melhorias sugeridas".

### Ação imediata para a Andreia

Assim que o fluxo subir, instruir você a pedir pra ela:
1. Abrir https://crm.mkart.com.br/auth
2. Clicar em "Esqueci minha senha"
3. Digitar `gestao.sanapta@gmail.com`
4. Abrir o email do Supabase ("Reset your password") e seguir o link
5. Definir senha nova

Isso garante que ela troca a senha do navegador dela e elimina qualquer hipótese de autofill/typo/encoding.

### Fora de escopo (pra não inchar)

- Branding dos emails de auth (templates Lovable Cloud) — separado, posso planejar depois se quiser.
- 2FA, captcha, desbloqueio self-service de lockout — já estão no roadmap.
- Mudar a edge `auth-login` — não precisa mexer.

### Notas técnicas

- `auth.users` desse projeto **não tem** tabela `profiles` espelhada — auth é gerenciada via `clinic_members` + `user_roles`. Reset de senha não toca em nenhuma dessas tabelas, então nada de migração.
- O Supabase envia email de recovery automaticamente; não exige `RESEND_API_KEY` nem domínio verificado pra funcionar (usa remetente padrão `noreply@mail.app.supabase.io`).
- Como `/reset-password` precisa ser pública, ela vai antes de qualquer guard em `App.tsx`.
