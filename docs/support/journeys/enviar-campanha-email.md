---
title: Enviar uma campanha de email
topic: email
kind: journey
audience: user
updated: 2026-06-07
---
# Enviar uma campanha de email

## Quando usar
Para disparar um email para um segmento de contatos (promoção, novidade, follow-up).

## Pré-requisitos
- Domínio de envio configurado e verificado em **Email → Configurações de domínio**.
- Pelo menos um **segmento** ou lista de contatos criada.
- Um **template** pronto (ou criar na hora).

## Passo a passo
1. Vá em **Email → Campanhas** (`/email/campaigns`).
2. Clique em **Nova campanha**.
3. Preencha:
   - **Nome interno** (não aparece para o destinatário)
   - **Assunto** (use variáveis como `{{nome}}` se quiser)
   - **Remetente** (de qual domínio)
   - **Segmento(s)** de destino
   - **Template** ou conteúdo direto
4. (Opcional) Configure **A/B test** de assunto.
5. Escolha **Enviar agora** ou **Agendar** para uma data.
6. Clique em **Revisar** e confira o preview.
7. Clique em **Iniciar envio**.

## Como saber que deu certo
- Status muda para **running** → **completed**.
- Métricas começam a aparecer em **Email → Dashboard** (entregues, abertos, cliques).

## Se algo der errado
- Domínio não verificado → `journeys/configurar-dominio-email.md`.
- Campanha pausou sozinha → `troubleshooting/email.md` (seção "Campanha pausada").
- Bounce alto → `troubleshooting/email.md` (seção "Bounces").

## Relacionado
- `pages/04-email-campaigns.md`
- `pages/05-email-segments.md`
