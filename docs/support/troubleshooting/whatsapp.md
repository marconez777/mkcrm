---
title: Problemas com WhatsApp
topic: support
kind: troubleshooting
audience: user
updated: 2026-06-07
---
# Problemas com WhatsApp

## QR Code não aparece ou expira muito rápido
**Causa:** sessão antiga travada ou problema temporário do provedor.
**Solução:**
1. Feche o diálogo e clique em **Conectar nova instância** de novo.
2. Se persistir, em **Configurações → WhatsApp**, clique em **Desconectar** na instância antiga e crie uma nova.
3. Garanta que a câmera do celular está enquadrando o QR completo.

## Conectado mas não recebe mensagens
**Causas comuns:**
- Sessão caiu e o badge não atualizou → reconectar.
- Número está em uso em outro aparelho/serviço (WhatsApp só permite uma sessão Web ativa).
- Webhook do provedor parou → aguardar alguns minutos ou reconectar.

## Mensagens não enviam (status fica "pendente")
**Solução:**
1. Confira se a instância está **Conectada**.
2. Verifique se o número do destinatário é válido (formato internacional).
3. Se for envio em massa, pode ser limite de plano — ver `limites-planos.md`.

## Mídia falha (imagem/áudio/PDF)
- **Limite de tamanho:** 16MB para mídia inbound/outbound. Acima disso, falha.
- Verifique o formato (jpg, png, pdf, mp3, ogg, mp4 são suportados).

## "Sessão travada"
**Solução:** desconecte a instância e conecte de novo.

## IA não responde no WhatsApp
1. O agente está **ativo** e vinculado à instância correta? Ver `pages/ai-agents.md`.
2. O lead está com **IA pausada**? Ver `journeys/pausar-ia-em-lead.md`.
3. Há limite de gasto de IA estourado? Ver `ia.md`.

## Relacionado
- `pages/settings.md`
- `pages/inbox.md`
