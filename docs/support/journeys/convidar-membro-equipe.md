# Convidar um membro para a equipe

## Quando usar
Para dar acesso a um novo atendente, admin ou operador.

## Pré-requisitos
- Ser **admin** ou **owner** da clínica.
- Plano com vagas de usuário disponíveis.

## Passo a passo
1. Vá em **Equipe** (`/team`).
2. Clique em **Adicionar usuário**.
3. Preencha:
   - Nome
   - Email
   - **Senha inicial** (o usuário pode trocar depois)
   - **Função:** Owner, Admin ou Operador
4. Clique em **Criar**.
5. Envie as credenciais para a pessoa pelo canal seguro da clínica.

## Como saber que deu certo
- Usuário aparece na lista da equipe.
- Ao entrar com a senha, ele cai direto na clínica certa.

## Se algo der errado
- "Limite de usuários atingido" → `troubleshooting/limites-planos.md`.
- Usuário não consegue entrar → `troubleshooting/auth-convites.md`.

## Relacionado
- `pages/team.md`
- `pages/admin.md` (para super_admin criando contas novas)
