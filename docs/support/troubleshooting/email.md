---
title: Problemas com Email
topic: email
kind: troubleshooting
audience: user
updated: 2026-06-07
---
# Problemas com Email

## Campanha pausada automaticamente
**Causas:**
- Taxa de bounce ou reclamação acima do limite seguro.
- Crédito/limite de envio do plano estourado.
- Domínio perdeu verificação.

**Solução:** abra a campanha, leia o motivo no banner do topo. Em geral: corrija a lista (remover bounces), verifique o domínio, e clique em **Retomar**.

## Bounce alto
- **Hard bounce:** email não existe. Sistema marca o contato como inválido e para de enviar.
- **Soft bounce:** problema temporário (caixa cheia). Sistema tenta de novo.
- Se a taxa estiver alta logo no início, sua lista está desatualizada — limpe antes.

## Domínio não verifica
1. Verifique se cada registro DNS foi copiado **exatamente** (sem espaços extras).
2. SPF: garanta que existe **apenas um** registro SPF no domínio.
3. Aguarde até 24h para propagação completa.
4. Use uma ferramenta como `dig` ou `mxtoolbox.com` para confirmar.

## Fila travada / emails não saem
1. Veja **Email → Fila** (`/email/queue`) — há mensagens em "retry" ou "failed"?
2. Status do domínio ainda **verificado**?
3. Limite de envio do plano não estourou? Ver `limites-planos.md`.

## Email cai em spam
- Domínio verificado com SPF + DKIM corretos é o mínimo.
- Evite palavras de spam no assunto ("GRÁTIS", "URGENTE", muitos `!!!`).
- Mantenha boa reputação: nunca envie para listas compradas.

## Unsubscribe não funciona
- O link de unsubscribe é gerado automaticamente em todo email transacional/marketing.
- Veja em **Email → Unsubscribes** se o contato realmente saiu.

## Relacionado
- `pages/04-email-campaigns.md`
- `pages/11-settings-email-domain.md`
