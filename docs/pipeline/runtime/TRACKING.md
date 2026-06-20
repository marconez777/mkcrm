---
title: "Tracking e Pixel First-Party (V6)"
topic: analytics
kind: reference
audience: agent
updated: 2026-06-20
summary: "Como funciona a infraestrutura do mkTrack (tracking-pixel, tracking-event e tracking-identify). Gestão de cookies first-party e redirecionamento de WhatsApp."
code_refs:
  - supabase/functions/tracking-pixel/index.ts
  - supabase/functions/tracking-event/index.ts
  - supabase/functions/tracking-identify/index.ts
  - supabase/functions/wa-redirect/index.ts
---

# Tracking e Pixel First-Party

A plataforma hospeda a sua própria solução de Analytics para que o usuário evite bloqueadores de cookies de terceiros.

## 1. O Tracker (`tracking-pixel`)

A Edge Function `tracking-pixel` serve o arquivo `tracker.js` dinamicamente com base no `project_id` na URL.
Ao ser injetado no site do cliente, o script executa as seguintes tarefas na camada do navegador:

- Gera um identificador de visitante (`_mk_vid`) persistido por Cookie e LocalStorage (Fallback).
- Gera um identificador de sessão (`_mk_sid`) válido por 30 minutos, reiniciado sempre que há mudança de `utm_campaign`.
- Detecta os UTMs (`utm_source`, `utm_medium`, `gclid`, etc.) mantendo-os atrelados à sessão.
- Sobrescreve o método `history.pushState` para rastrear navegação em SPAs (Single Page Applications).

### Coleta Automática

O script é reativo e coleta automaticamente sem necessidade de código no front-end do cliente:
- `page_view` (Ao carregar e mudar rota)
- `form_start` e `form_submit_attempt`
- Cliques em tags com `data-track-event`

## 2. Redirecionamento de WhatsApp (`wa-redirect`)

Um dos focos principais do tracker é unir o tráfego anônimo no site ao contato no WhatsApp:

1. O Tracker procura todos os links `wa.me` ou `api.whatsapp.com` no DOM (utilizando um MutationObserver para pegar botões flutuantes assíncronos).
2. Ele altera o `href` do botão, apontando para a Edge Function `wa-redirect`, e anexa o `vid`, `sid` e o telefone de destino (`to`).
3. Quando o usuário clica, ele passa pela Edge Function que registra o clique e devolve um redirect HTTP 302 (Location) limpo para o aplicativo do WhatsApp.
4. Isso permite atribuir o lead ao UTM correto.

## 3. Ingestão de Eventos (`tracking-event`)

O navegador envia o payload (preferencialmente via `navigator.sendBeacon`) contendo todos os dados do evento.
A função `tracking-event` processa e descarrega o payload na tabela `tracking_events`. A tabela é otimizada para alta escrita.

## 4. Identificação (`tracking-identify`)

Quando um Lead preenche um formulário (Landing Page, por exemplo), o frontend chama a função `tracking-identify`.
Esta função cruza o e-mail ou telefone preenchido com a base de Leads e liga aquele "Visitante Anônimo" (`visitor_id`) a um `lead_id` real, resolvendo retrospectivamente todos os cliques passados daquele usuário.
