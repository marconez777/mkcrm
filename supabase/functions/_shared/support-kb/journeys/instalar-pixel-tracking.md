# Instalar o pixel de tracking

## Quando usar
Para registrar visitas, origem (UTM), eventos e atribuir leads que chegarem depois.

## Pré-requisitos
- Acesso ao código do site (ou ao Google Tag Manager).

## Passo a passo
1. Vá em **Tracking** (`/tracking`).
2. Copie o **snippet de instalação** (tag `<script>`).
3. Cole antes do `</head>` em todas as páginas do site (ou via GTM como **Custom HTML**).
4. (Opcional) Configure **eventos customizados** chamando `window.mkTrack('nome_evento', { ... })`.

## Como saber que deu certo
- Acesse o site em uma aba.
- Abra `/tracking/debug` no CRM — você deve ver o `pageview` aparecendo em tempo real.
- Em `/tracking` o contador de visitas aumenta.

## Se algo der errado
- Nada aparece no debug → `troubleshooting/tracking-formularios.md` (seção "Pixel não dispara").
- UTM errado → confira a URL de origem; o pixel grava o que estiver na query.

## Relacionado
- `pages/tracking.md`
- `journeys/publicar-formulario.md`
