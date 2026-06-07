---
title: Equipe — `/team`
topic: support
kind: support
audience: user
updated: 2026-06-07
summary: "Estado vazio: *\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"Nenhum membro\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"*."
---
# 👥 Equipe — `/team`

## Para que serve
Gerenciar os **membros da clínica**: ver quem tem acesso, criar novos logins direto (sem precisar de e-mail de convite).

## Quem acessa
Apenas **Owner** e **Admin**. Outros papéis são redirecionados automaticamente.

## Layout
- Título **Equipe** + subtítulo *Membros da clínica **[Nome da clínica]***.
- Botão **👤＋ Novo usuário** — abre diálogo.
- Tabela de membros.

## Tabela
| Coluna | Conteúdo |
|---|---|
| **Nome** | Nome completo (ou `—`) |
| **Email** | E-mail |
| **Papel** | Badge: `admin`, `professional`, `viewer`, `owner` |
| **Desde** | `DD/MM/AAAA` |

Estado vazio: *"Nenhum membro"*.

## Diálogo "Cadastrar usuário"
| Campo | Obrigatório |
|---|---|
| **Nome** (`Nome completo`) | Não |
| **Email** (`pessoa@email.com`) | Sim |
| **Senha** (`Mínimo 8 caracteres`) | Sim, ≥8 caracteres |
| **Papel**: `Admin / Profissional / Visualizador` | Sim |

Nota: *"Repasse a senha de forma segura. O usuário pode alterá-la depois."*

Botões: **Cancelar / Criar**.

> Diferente do **convite por e-mail** (em outros pontos do produto), aqui o admin cria o login completo e repassa a senha manualmente.

## Erros e toasts
| Mensagem | Causa |
|---|---|
| *"Usuário criado"* | OK |
| *"Erro ao criar usuário"* / *"[mensagem do servidor]"* | E-mail duplicado, senha fraca, etc. |

## Relacionado
- `01-primeiros-passos.md` (aceitar convite por e-mail)
- `troubleshooting/auth-convites.md`
