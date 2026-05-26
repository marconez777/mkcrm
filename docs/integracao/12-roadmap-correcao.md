# 12. Roadmap de Correção — Integração Clínica ÓR

> Baseado em `11-analise-conflitos-site-or.md`. Sequenciado por **impacto / dependência**, não por dificuldade técnica.

---

## Fase 0 — Validar antes de mexer (1 dia)

| # | Ação | Onde | Responsável |
|---|------|------|------------|
| 0.1 | Rodar SQL `6.1` a `6.7` da análise | CRM | dev CRM |
| 0.2 | Rodar o "prompt de diagnóstico do site" (seção 5 da análise) | Site | dev do site |
| 0.3 | Ajustar `allowed_domains` do token `mkf_3a2f5dd0…` para `clinicaohrpsiquiatria.com` (prod) + `mindscape-revive.lovable.app` (preview Lovable) — hostname puro, sem `https://` nem `/` | CRM | dev CRM |
| 0.4 | Documentar baseline (quantos leads/dia, % com `visitor_id NULL`, % com PII completo) | CRM | dev CRM |

**Critério de saída:** temos números de antes — base para medir melhoria das fases seguintes.

---

## Fase 1 — Captura mínima viável (REVISADO 2026-05-26)

> **Revisão importante:** o diagnóstico do site (ver §5) revelou que (a) `tracking-pixel`, `tracking-event` e `tracking-identify` **já existem no CRM** e já fazem page_view SPA + `_mk_vid`/`_mk_sid` + UTM + `whatsapp_click` automático, e (b) o site **já emite CustomEvents** `mk:lead:created`, `mk:test:started`, `mk:test:completed` no `window`. A Fase 1 anterior (interceptar fetch + criar `track-event` novo) foi **substituída** por algo muito menor.
>
> A migração de telefone E.164 (item 1.3 antigo) foi **adiada** — auditoria mostrou 8 arquivos com `.eq("phone", ...)` em formato digits-only (evolution-webhook, evolution-delete-lead, evolution-collect-leads, sequence-trigger, NewConversationDialog, etc.). Migrar quebra todos. Precisa de plano dedicado.

### 1.1 — CRM: bridge `mk:*` no `tracking-pixel` ✅ FEITO

`supabase/functions/tracking-pixel/index.ts` agora escuta:
- `mk:lead:created`, `mk:lead:updated`
- `mk:test:started`, `mk:test:completed`
- `mk:wa:click`
- `mk:webinar:registered`, `mk:webinar:joined`

E drena uma fila pré-boot (`window.mkQueue`) caso o site dispare CustomEvents antes do script async carregar.

Cada `mk:foo:bar` vira `track("foo_bar", detail)` → `tracking-event` grava em `tracking_events` com `event_type='custom'`.

### 1.2 — Site: instalar o `tracking-pixel` no `<head>` (PENDENTE — dev do site)

Antes do `forms-snippet`, colar no `index.html` do projeto mindscape-revive:

```html
<script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=cf038458-457d-4c1a-9ac4-c88c3c8353a1"></script>
```

`project_id` = `clinic_id` da ÓR. Após instalado:
- Visitor ganha `_mk_vid` (cookie 365d) + `_mk_sid` (session 30min)
- Page_views SPA automáticos (`pushState`/`replaceState`/`popstate`)
- UTMs persistidas em `tracking_visitors`
- Clicks em `wa.me`/`api.whatsapp.com` viram `whatsapp_click` (já tem listener nativo no pixel, linhas 200-291)
- CustomEvents `mk:*` que o site já dispara passam a ser capturados (item 1.1)
- Próximo form submit traz `visitor_id` populado → `forms-ingest` faz `link_source='form_submission'` em `tracking_identity_links` → resolve P0.1

### 1.3 — Telefone E.164 (ADIADO — risco alto)

Auditoria revelou que migrar `leads.phone` para `+E.164` quebra:
- `evolution-webhook` (3 lookups por `phone` digits-only, vindos de `remoteJid.replace(/\D/g,'')`)
- `evolution-delete-lead`, `evolution-collect-leads`
- `sequence-trigger`
- `NewConversationDialog` (frontend)
- `_shared/evolution.ts`
- `external-lead-capture`

Para fazer: ou (a) atualizar todos os 8 call-sites + migration coordenada, ou (b) manter DB digits-only e padronizar APENAS na exibição/export. Decidir antes de tocar.



---

## Fase 2 — Atribuição (3–5 dias) — coordenação com site

Resolve **P0.1**, **P2.9**, **P2.10**, **P1.5**.

### 2.1 — Instalar `tracking-pixel` no site (resolve P0.1)

Pedir ao time do site (prompt pronto para colar no Lovable deles):

> ```
> Adicione no <head> do index.html, logo abaixo do snippet de forms já existente:
>
> <script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?token=<TOKEN_TRACKING>"></script>
>
> Esse pixel:
> - Não coleta PII.
> - Seta cookies de 1ª parte `_mk_vid` (12 meses) e `_mk_sid` (30 min).
> - Lê UTMs, referrer e click IDs (`gclid`, `fbclid`, `ctwa_clid`) da URL.
> - Envia eventos `page_view` para o CRM.
>
> Confirme que carrega nos 3 domínios e que não há CSP bloqueando.
> Não altere mais nada — em particular, mantenha os formulários como estão.
> ```

Token específico (não reaproveitar `mkf_…` de forms) — gerar via UI do CRM em `/settings/integrations`.

### 2.2 — Hook de SPA navigation no `tracking-pixel` (resolve P2.9)

```js
(function(history){
  var pushState = history.pushState;
  history.pushState = function(){
    var ret = pushState.apply(this, arguments);
    window.dispatchEvent(new Event('mk:locationchange'));
    return ret;
  };
  window.addEventListener('popstate', function(){
    window.dispatchEvent(new Event('mk:locationchange'));
  });
})(window.history);

window.addEventListener('mk:locationchange', sendPageView);
```

### 2.3 — Normalizar `source_page` (resolve P2.10)

No `forms-snippet`, trocar `source_page: location.href` por:

```js
source_page: location.pathname,
source_url: location.href,    // mantém URL completa em campo separado
```

Atualizar schema de `forms-ingest` para aceitar `source_url` opcional e persistir em `lead_events.payload.source_url`.

### 2.4 — Documentar `allowed_domains` (resolve P1.5)

- Adicionar UI no CRM mostrando os domínios atuais e botão "testar com este domínio".
- Documentar em `docs/integracao/08-seguranca.md`.

**Saída da Fase 2:** dashboard de origem dos leads volta a funcionar; UTMs/`ctwa_clid` chegam; visitor_id presente em ~95 % dos submits.

---

## Fase 3 — Robustez (1 semana) — CRM-only

Resolve **P1.4**, **P2.11**, **P3.12**, **P3.13**, **P3.14**.

### 3.1 — UI de `field_map` por formulário (P1.4 + P2.11)

Em `/settings/forms`, para cada `form_definition`:
- Mostrar últimos 10 payloads.
- Permitir mapear chaves (`treatmentInterest` → coluna custom; `accepts_marketing` → flag).
- Salvar em `form_definitions.field_map`.

### 3.2 — Capturar checkbox sempre (P3.12)

`forms-snippet/index.ts:34`:

```js
if(type==="checkbox"){ v = el.checked ? "1" : "0"; }
else if(type==="radio"){ if(!el.checked) continue; }
```

### 3.3 — Retry com backoff + observabilidade (P3.13)

- Se `fetch` falhar, gravar em `localStorage._mk_outbox` e tentar de novo no próximo carregamento.
- Expor `window.MKForms.lastError` e `window.MKForms.queueSize`.

### 3.4 — Versionamento de snippet (P3.14)

- `forms-snippet?token=…&v=<hash>` → responde com `Cache-Control: public, max-age=31536000, immutable`.
- Sem `v` → resposta dinâmica `max-age=60` apenas.

**Saída da Fase 3:** integração resiliente a quedas; UI permite configuração sem deploy.

---

## Fase 4 — Identidade canônica (1 semana, opcional) — coordenação

Resolve **P1.7** e blinda contra ad-block.

### 4.1 — Webhook reverso do site

Pedir ao time do site (prompt):

> ```
> Crie uma edge function `notify-crm` que faz POST para
> https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-lead-capture
> com header `Authorization: Bearer <SECRET>` e body:
>   { external_lead_id, name, email, phone, kind, source_page, treatment_interest,
>     test_type, test_score, test_result_label, occurred_at }
>
> Dispare via pg_net dentro dos triggers `tg_on_new_lead` e
> `tg_on_test_result_completed`. Assinatura HMAC-SHA256 do body no header
> `x-mk-signature`.
> ```

### 4.2 — Coluna `external_lead_id` no CRM

- Migration: `ALTER TABLE leads ADD COLUMN external_lead_id text, ADD COLUMN external_source text`.
- Index único parcial: `CREATE UNIQUE INDEX ON leads (clinic_id, external_source, external_lead_id) WHERE external_lead_id IS NOT NULL`.
- `external-lead-capture` faz upsert por `(clinic_id, external_source, external_lead_id)` em vez de `(clinic_id, phone)`.

### 4.3 — Reconciliação retroativa

Job que tenta cruzar leads sem `external_lead_id` por `(email)` ou `(phone_normalizado)` com novos dados do webhook reverso, preenchendo o `external_lead_id`.

**Saída da Fase 4:** captura 100 % garantida; um único paciente = um único UUID no CRM com referência ao UUID do site.

---

## Resumo visual

```text
Fase 0 ──┐
Validar  │  1 dia,  bloqueante
         │
Fase 1 ──┤  1–2 dias, CRM-only
P0.2/3   │  → libera score do teste e clicks WhatsApp
P1.6     │
         │
Fase 2 ──┤  3–5 dias, depende do site
P0.1     │  → libera atribuição e UTMs
P2.9/10  │
P1.5     │
         │
Fase 3 ──┤  ~1 semana, CRM-only
P1.4     │  → resiliência e configurabilidade
P2.11    │
P3.*     │
         │
Fase 4 ──┘  ~1 semana, coordenação (opcional mas recomendado)
P1.7        → identidade canônica + blindagem contra ad-block
```

**Janela total realista:** 3–4 semanas até a Fase 3 entregue; Fase 4 mais 1 semana adicional.

---

## Pontos de decisão antes de começar

1. **Novo endpoint `track-event` vs reuso de `forms-ingest`?** Recomendo novo endpoint.
2. **Padronizar telefone com ou sem `+`?** Recomendo **com `+`** (E.164 estrito) — bate com o site e com APIs externas (Twilio, WhatsApp Business).
3. **Token único `mkf_…` para tudo, ou dois tokens (`mkf_…` para forms + `mkt_…` para tracking)?** Recomendo **dois tokens** — permite revogar tracking sem perder forms.
4. **Fase 4 entra agora ou só depois de medirmos perda de captura na Fase 1–3?** Recomendo medir antes (na Fase 0 já dá para estimar % de submits que somem em relação a Google Analytics do site, se eles tiverem retomado).
