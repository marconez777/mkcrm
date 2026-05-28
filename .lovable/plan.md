## Objetivo
Deixar o card de perfil no rodapé do sidebar (hoje só `marco@marco.com.br` + ícone de sair) mais polido — virar um mini-card com avatar, nome, e-mail e um menu pra abrir o perfil / sair.

## Mudanças (apenas UI — `src/components/AppShell.tsx`)

Substituir o botão atual por um **card de perfil** com:

- **Avatar** (`@/components/ui/avatar`)
  - Usa `profiles.avatar_url` se existir; fallback = iniciais do nome ou da parte antes do `@` do e-mail
  - Ring sutil + dot de presença online no canto (verde, mesmo padrão do `dotColor` que já existe)
- **Nome em destaque** (`profiles.full_name`, fallback pra parte antes do `@`) + **e-mail menorzinho embaixo** (truncado)
- **DropdownMenu** ao clicar (já temos `@/components/ui/dropdown-menu`):
  - `Perfil` → navega pra `/settings?tab=profile` (rota que já existe)
  - `Configurações` → `/settings`
  - separador
  - `Sair` (vermelho) → `supabase.auth.signOut()`
- Hover state suave (`hover:bg-sidebar-accent/60`), borda sutil `border-sidebar-border/40`, `rounded-lg`, padding 2.5.

## Carregamento de dados
Buscar `full_name, avatar_url` da tabela `profiles` (1 query no mount, `eq("user_id", user.id).maybeSingle()`). Estado local no `AppShell`; sem schema, sem RLS, sem edge function — RLS atual já permite ler o próprio perfil (`profiles_self_or_clinic`).

## Fora do escopo
- Não mexer no resto do sidebar (nav, status WhatsApp, atalhos).
- Não criar página de perfil (já existe em Settings).
- Sem mudanças de tema/tokens novos.
