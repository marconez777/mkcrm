# Instalar o pixel de tracking

## Quando usar
Para registrar visitas, origem (UTM), eventos e atribuir leads que chegarem depois.

> **Importante:** o snippet de instalação **NÃO** está na tela `/tracking` (ela é só o painel/dashboard). Ele fica em **Configurações → Integração do Site** (`/settings/integration`) e já inclui pixel + captura de formulários no mesmo script.

## Pré-requisitos
- Acesso ao código do site (ou ao Google Tag Manager).
- Papel **Admin** ou **Owner** na clínica.

## Passo a passo
1. Vá em **Configurações** (`/settings`) → aba **Integração do Site**.
2. Clique em **Abrir** (leva para `/settings/integration`).
3. Selecione (ou crie) uma integração e cadastre o(s) **domínio(s) autorizado(s)** do seu site (ex.: `https://www.suaclinica.com.br`).
4. Copie o bloco **"Copiar tudo"** — ele já contém os dois `<script>`: o **tracking-pixel** e o **forms-snippet** na ordem correta (pixel primeiro).
5. Cole **antes do `</head>`** em todas as páginas do site (ou via GTM como **Custom HTML**).
6. (Opcional) Configure **eventos customizados** chamando `window.mkTrack('nome_evento', { ... })`.

## Como saber que deu certo
- Acesse o site em uma aba.
- No CRM, abra `/tracking-debug` (visível para super admin ou quando `tracking.debug_enabled = true`) — você deve ver `page_view` em tempo real.
- Em `/tracking` o contador de **Visitas únicas** aumenta.

## Se algo der errado
- Nada aparece no debug → `troubleshooting/tracking-formularios.md` (seção "Pixel não dispara").
- UTM errado → confira a URL de origem; o pixel grava o que estiver na query.
- Domínio não autorizado → volte em `/settings/integration` e adicione o domínio exato.

## Relacionado
- `pages/tracking.md`
- `pages/settings.md`
- `journeys/publicar-formulario.md`
