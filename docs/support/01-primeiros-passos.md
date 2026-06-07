---
title: Primeiros passos
topic: support
kind: support
audience: user
updated: 2026-06-07
summary: "Se você foi convidado por alguém da equipe:"
---
# 🚀 Primeiros passos

> O que fazer logo após criar uma conta ou ser convidado.

## 1. Entrar na conta

- Acesse a URL da sua clínica e clique em **Entrar**.
- Digite e-mail e senha cadastrados, ou clique em **Continuar com Google**.
- Esqueceu a senha? **Esqueci minha senha** → e-mail com link de redefinição.

## 2. Aceitar um convite

Se você foi convidado por alguém da equipe:

1. Abra o e-mail "Você foi convidado para a clínica X".
2. Clique em **Aceitar convite**.
3. Se ainda não tem conta: preencha nome e senha. Se já tem: faça login.
4. Você cai direto na clínica que te convidou.

> **Convite expirado?** Peça para quem te convidou reenviar pela página **Equipe**.

## 3. Onboarding (primeira clínica)

Ao criar a primeira clínica você passa pelo onboarding:

1. **Nome da clínica** — como aparece para a equipe.
2. **Nicho/segmento** — adapta sugestões da IA.
3. **Conectar WhatsApp** (opcional agora) — QR Code; pode pular e fazer depois em **Configurações**.
4. **Convidar equipe** (opcional) — adiciona membros por e-mail.

Pode sair e voltar a qualquer momento.

## 4. Visão geral da navegação

Após entrar, a barra lateral mostra (depende do plano):

| Item | Rota | Função |
|---|---|---|
| **Kanban** | `/` | Funis e leads em cartões |
| **Inbox** | `/inbox` | Conversas de WhatsApp |
| **Tarefas** | `/tasks` | To-dos da equipe |
| **IA** | `/ai` | Agentes, mensagens, automações, métricas |
| **E-mail** | `/email` | Campanhas, automações, templates, contatos |
| **Rastreamento** | `/tracking` | Pixels, formulários, atribuição |
| **Equipe** | `/team` | Membros e convites |
| **Configurações** | `/settings` | Preferências da clínica |

## 5. Conectar o WhatsApp

1. **Configurações** → aba **WhatsApp** → **Conectar nova instância**.
2. Aparece um **QR Code**. Abra o WhatsApp no celular → **Aparelhos conectados** → **Conectar aparelho** → escaneie.
3. Status muda para **Conectado** em alguns segundos.

Detalhes em `journeys/conectar-whatsapp.md` (Fase 4).

## 6. Convidar a equipe

1. Vá em **Equipe** (`/team`).
2. **Convidar membro** → digite e-mail + escolha papel (Admin ou Operador).
3. A pessoa recebe e-mail com link. Convites expiram em alguns dias.

Para alterar/remover papéis, use o menu de cada linha.

## 7. Próximos passos típicos

| Quero… | Vá para |
|---|---|
| Atender mensagens de WhatsApp | `pages/inbox.md` |
| Organizar leads em funil | `pages/kanban.md` |
| Criar um agente de IA que atende sozinho | `journeys/criar-primeiro-agente-ia.md` |
| Enviar uma campanha de e-mail | `journeys/enviar-campanha-email.md` |
| Capturar leads do meu site | `journeys/publicar-formulario.md` ou `journeys/instalar-pixel-tracking.md` |
| Importar minha base de leads | `journeys/importar-leads.md` |
