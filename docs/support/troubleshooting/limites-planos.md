---
title: Bloqueios por limite de plano
topic: email
kind: troubleshooting
audience: user
updated: 2026-06-07
---
# Bloqueios por limite de plano

## Como funciona
Cada plano tem limites para:
- Número de **leads** ativos
- Número de **usuários** da equipe
- **Mensagens** de WhatsApp por mês
- **Emails** enviados por mês
- **Gasto de IA** mensal (em USD)
- Funcionalidades específicas (campos personalizados, email marketing, automações avançadas, etc.)

## "Limite atingido" — o que fazer
1. Identifique qual limite estourou pela mensagem ou pelo painel de **Métricas**.
2. Cliente precisa **fazer upgrade de plano** ou solicitar **aumento manual** à plataforma.
3. Super_admin: em `/admin → clínica`, aplique outro plano ou use **override manual** de limites.

## Funcionalidade some do menu
**Causa:** o plano atual não inclui aquela feature (ex.: email marketing, custom fields, automações avançadas).
**Solução:** upgrade do plano libera a feature automaticamente.

## "Limite de gasto de IA atingido"
Ver `ia.md` (seção do erro 402).

## "Limite de usuários atingido" ao convidar
- Remova um usuário inativo em `/team`, ou
- Upgrade de plano para liberar mais vagas.

## "Limite de envio de email atingido"
- Aguarde virar o mês (reset automático), ou
- Upgrade para um plano com volume maior.

## Como saber quais limites o plano tem
- Cliente: em **Configurações → Plano e uso** vê os contadores atuais vs. limite.
- Super_admin: em `/admin → clínica → aba Plano` vê tudo, incluindo overrides.

## Relacionado
- `pages/admin.md`
- `journeys/aplicar-plano-cliente.md`
