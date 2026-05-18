# Tracking no site (guia opcional)

O pixel do CRM **já está instalado** na Clínica ÓR via:

```html
<script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=or"></script>
```

Não é preciso mudar o snippet. O `tracker.js` é servido pelo CRM e atualiza automaticamente. Este guia é **opcional**, para refinar a precisão dos eventos.

## O que é capturado automaticamente

Sem mexer em nada no site:

| Evento | Quando dispara |
|---|---|
| `session_start` | Primeira interação da sessão |
| `page_view` | Carga inicial + mudanças de rota SPA |
| `whatsapp_click` | Clique em qualquer link para `wa.me`, `api.whatsapp.com`, `web.whatsapp.com` ou `whatsapp://` |
| `form_start` | Primeira interação (focus/change) em qualquer campo dentro de um `<form>`, 1x por form |
| `form_submit_attempt` | Submit do form (não garante sucesso real) |

> Para confirmar **sucesso** de envio, o site deve chamar `window.mkTrack('form_submit_success', { form_id: '...' })` após resposta OK do backend. O `form_submit_attempt` automático **não** indica conversão confirmada.

## Refinando com data attributes (opcional)

Qualquer elemento com `data-track-event` dispara um evento ao ser clicado. Atributos suportados:

- `data-track-event` — nome do evento (obrigatório)
- `data-track-label` — rótulo legível
- `data-track-location` — onde no site (Hero, Footer, etc.)

### Botão WhatsApp

```html
<a href="https://wa.me/5511999999999"
   data-track-event="whatsapp_click"
   data-track-label="WhatsApp"
   data-track-location="Hero">
  Falar no WhatsApp
</a>
```

### Botão Agendar

```html
<button data-track-event="button_click"
        data-track-label="Agendar consulta"
        data-track-location="Hero">
  Agendar consulta
</button>
```

### Botão Iniciar teste

```html
<button data-track-event="mental_test_start"
        data-track-label="Iniciar teste de saúde mental"
        data-track-location="Página de teste">
  Iniciar teste
</button>
```

## Hooks JavaScript

Para eventos que não correspondem a um clique único (ex.: fluxo do teste):

```js
// Quando o usuário começa o teste
window.mkTrack('mental_test_start', { location: 'teste_saude_mental' });

// Quando termina
window.mkTrack('mental_test_completed', { location: 'teste_saude_mental' });

// Quando virar lead (após submit confirmado no backend)
window.mkTrack('lead_created', { source: 'form_contato' });
```

A função usa o `visitor_id` e `session_id` já existentes — não é necessário passar nada disso.

## ⚠️ Proibido enviar

Nunca inclua nas `properties`:

- valores digitados em inputs (nome, telefone, e-mail, mensagem);
- respostas do teste de saúde mental;
- diagnóstico, sintomas, dados clínicos;
- query strings com dados pessoais.

O tracker já sanitiza URLs antes do envio (mantém apenas origin + path + UTMs/click IDs permitidos). Mas se você passar dados sensíveis manualmente em `properties`, eles vão para o CRM. Não passe.

## Resiliência

- Eventos usam `navigator.sendBeacon` quando disponível (com `fetch keepalive` como fallback), o que reduz perda em cliques de saída como o WhatsApp.
- Listeners em capture phase + try/catch — falha no tracker não quebra o site.
- Cache do `tracker.js` está em `no-store` durante a fase de testes; atualizações chegam imediatamente.
