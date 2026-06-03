# Integração CRM ↔ Sites externos

> **Para quem é isto:** times de marketing/dev que vão instalar tracking, formulários e webhooks de um site externo (WordPress, Wix, Webflow, Next.js, HTML puro, etc.) no MK-CRM.
> **Última atualização:** 2026-06-03

---

## Índice

| # | Documento | Quando ler |
|---|---|---|
| 01 | [Visão geral da arquitetura](./01-visao-geral.md) | Antes de qualquer integração — entenda as peças |
| 02 | [Instalação dos snippets](./02-instalacao-snippets.md) | Hora de colar código no site |
| 03 | [Tracking & eventos](./03-tracking-eventos.md) | Para entender visitor_id, sessions, UTMs, page_view |
| 04 | [Formulários](./04-formularios.md) | Para capturar leads via `<form>` |
| 05 | [Atribuição & identidade do lead](./05-atribuicao-leads.md) | Como visitas viram leads e como evitamos duplicatas |
| 06 | [Eventos customizados](./06-eventos-customizados.md) | API `window.MK.track(...)` para eventos sob medida |
| 07 | [Webhooks & API direta](./07-webhooks-api-direta.md) | Integração server-to-server (n8n, Zapier, CRM próprio) |
| 08 | [Segurança](./08-seguranca.md) | Tokens, CORS, LGPD, rate-limit, rotação |
| 09 | [Troubleshooting](./09-troubleshooting.md) | "Meu lead não chegou" → siga este fluxograma |
| 10 | [Referência técnica](./10-referencia-tecnica.md) | Schemas, tabelas, edge functions, limites |
| 11 | [Análise de conflitos — Clínica ÓR](./11-analise-conflitos-site-or.md) | Caso real: o que está quebrado entre site e CRM, com diagnóstico |
| 12 | [Roadmap de correção](./12-roadmap-correcao.md) | Plano faseado para destravar a integração ÓR |
| 13 | [Baseline Fase 0 — ÓR](./13-baseline-fase0.md) | Números "antes" + achado P0 `enqueue_email` + correção dos domínios reais (prod = `clinicaohrpsiquiatria.com`, preview = `mindscape-revive.lovable.app`; `clinicaor.com.br` não existe) |
| 📁 | [exemplos/](./exemplos/) | Snippets copy-paste por stack |

---

## Decision tree: qual integração eu preciso?

```text
Quero capturar leads de um site que eu controlo?
├── Tenho acesso ao HTML do site (WordPress, Webflow, etc.)
│   ├── Quero também rastrear visitas/UTMs?  → 02 (snippet tracker + forms)
│   └── Só quero capturar form?               → 02 (só snippet forms)
│
├── Não tenho acesso ao HTML (sistema fechado)
│   └── O sistema permite enviar webhook?     → 07 (API direta)
│
└── Quero integrar com Zapier / n8n / Make    → 07 (API direta com token privado)
```

---

## Glossário rápido

| Termo | O que é |
|---|---|
| **clinic_id** | UUID da clínica/conta no CRM. Toda integração pertence a uma clinic. |
| **integration_id** | UUID de uma integração específica (ex.: "Site institucional"). Uma clinic pode ter várias. |
| **token (público)** | String enviada pelo snippet no navegador. Pode aparecer no source do site — protegida por `allowed_domains` + rate-limit. |
| **token (privado)** | String secreta de webhook (`external-lead-capture`). **Nunca** colocar em código de browser. |
| **visitor_id** | Identificador anônimo do navegador. Cookie `_mk_vid`, persiste 365 dias. |
| **session_id** | Identificador de sessão. Expira após 30min de inatividade ou ao mudar de campanha. |
| **anonymous_id** | Sinônimo de `visitor_id` em algumas APIs antigas. |
| **form_key** | Identificador único de um formulário dentro de uma integração (ex.: `phq9`, `contato-home`). |
| **lead** | Pessoa identificada (tem phone OU email). Cada submission cria ou atualiza um lead. |
| **allowed_domains** | Lista de domínios autorizados a usar o token. Bloqueia uso em sites estranhos. |

---

## Endpoints (resumo)

Base: `https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1`

| Endpoint | Método | Auth | Propósito |
|---|---|---|---|
| `/tracking-pixel` | GET | — | Serve o JS do tracker |
| `/tracking-event` | POST | — | Recebe eventos (page_view, custom, etc.) |
| `/tracking-identify` | POST | `allowed_domains` (ou service role / admin logado) | Vincula visitor → lead |
| `/forms-snippet` | GET | — | Serve o JS de captura de form |
| `/forms-ingest` | POST | token público | Recebe submissão de form |
| `/forms-plugin-zip` | GET | — | Gera o plugin WordPress |
| `/external-lead-capture` | POST | token privado | API direta para criar leads (server-to-server) |

Detalhes completos em [10-referencia-tecnica.md](./10-referencia-tecnica.md).

---

## Onde pegar minhas credenciais?

No CRM: **Configurações → Forms** → escolha a integração → aba **"Como instalar"**.
Lá você encontra os `<script>` prontos com seu token já preenchido.

Para webhooks (API direta), peça ao admin da conta — é um token global e não fica visível no painel.
