# Publicar um formulário de captura

## Quando usar
Para capturar leads do site, landing page ou anúncio direto no CRM.

## Pré-requisitos
- Funil e etapa de destino definidos.
- Acesso ao site/landing onde o formulário será incorporado.

## Passo a passo
1. Vá em **Configurações → Formulários** (`/settings/forms`).
2. Clique em **Novo formulário**.
3. Configure:
   - Nome
   - Campos (nome, telefone, email, custom fields)
   - Funil e etapa de destino
   - Mensagem de obrigado / redirect
4. Salve e copie o **snippet HTML** ou a **URL pública**.
5. Cole o snippet no site (no `<body>`).

## Como saber que deu certo
- Submeta um teste pelo próprio site.
- Lead aparece no Kanban na etapa configurada.
- Veja em `/tracking/debug` o evento `form_submit`.

## Se algo der errado
- Erro de CORS → `troubleshooting/tracking-formularios.md`.
- Lead não chega → confira o snippet, domínio autorizado e o destino do formulário.

## Relacionado
- `pages/settings.md`
- `journeys/instalar-pixel-tracking.md`
