---
title: Aplicar / alterar plano de uma clínica (super_admin)
topic: admin
kind: journey
audience: user
updated: 2026-06-07
---
# Aplicar / alterar plano de uma clínica (super_admin)

## Quando usar
Quando a equipe da plataforma precisa promover, rebaixar ou customizar limites de uma clínica.

## Pré-requisitos
- Ser **super_admin** da plataforma.

## Passo a passo
1. Vá em **Admin** (`/admin`).
2. Aba **Clínicas** → busque pelo nome ou ID.
3. Clique na clínica para abrir os detalhes.
4. Na aba **Plano**:
   - Escolha um plano do catálogo, ou
   - Marque **override manual** e ajuste limites individuais (mensagens, leads, IA, etc.).
5. Salve.
6. (Opcional) Em **Limite de gasto de IA** defina o teto mensal em USD.

## Como saber que deu certo
- Toast: **"Plano atualizado"**.
- A clínica passa a respeitar os novos limites imediatamente.
- Histórico aparece no painel de **Auditoria**.

## Se algo der errado
- Limite não muda no dashboard do cliente → peça para recarregar a página.
- Conflito com override antigo → remova o override e reaplique o plano.

## Relacionado
- `pages/admin.md`
