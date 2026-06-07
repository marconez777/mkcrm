---
title: Problemas de Login e Convites
topic: email
kind: troubleshooting
audience: user
updated: 2026-06-07
---
# Problemas de Login e Convites

## "Email ou senha incorretos"
1. Confirme que está usando o email **exato** cadastrado (sem espaços).
2. Use **Esqueci minha senha** na tela de login para redefinir.
3. Se foi convidado, confirme a senha inicial com quem criou o usuário em `/team`.

## "Convite expirado"
**Causa:** o link de redefinição/convite tem validade (geralmente 24h).
**Solução:** peça ao admin para reenviar pelo painel `/team` ou criar novamente.

## Login funciona mas cai em clínica errada
- Verifique com qual email entrou — usuários em mais de uma clínica precisam acessar com o email vinculado àquela clínica.
- Faça logout e entre de novo com o email correto.

## Não consegue redefinir senha (link não chega)
1. Veja na caixa de spam/lixo eletrônico.
2. Confirme se o email está correto na conta.
3. Se ainda assim não chega, o admin pode resetar a senha direto em `/team` (criar nova senha manualmente).

## "Sem permissão para acessar"
**Causa:** o usuário tem a role errada (ex.: operador tentando entrar em `/admin`).
**Solução:** admin precisa ajustar a função (Owner / Admin / Operador) em `/team`.

## Erro ao aceitar convite "Unsupported provider"
**Causa:** Google login não está configurado.
**Solução:** o cliente deve usar email/senha. Para habilitar Google, é tarefa do super_admin.

## Relacionado
- `pages/team.md`
- `01-primeiros-passos.md`
