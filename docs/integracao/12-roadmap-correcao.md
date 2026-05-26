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

## Fase 1 — Captura mínima viável (1–2 dias) — CRM-only

Resolve **P0.2**, **P0.3** e **P1.6** sem depender do time do site.

### 1.1 — Interceptar `fetch` para `submit-test-result` (resolve P0.2)

Adicionar no `forms-snippet/index.ts`, após o listener de submit:

```js
var origFetch = window.fetch;
window.fetch = function(input, init){
  try {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/submit-test-result') !== -1) {
      var body = {};
      try { body = JSON.parse((init && init.body) || '{}'); } catch(e) {}
      sendCustomEvent('test_completed', body);
    }
  } catch(e) {}
  return origFetch.apply(this, arguments);
};
```

Criar `sendCustomEvent(type, detail)` que faz POST para um novo endpoint `track-event` (ou reaproveita `forms-ingest` com `form_key = '__event__'` + payload).

**Decisão pendente:** novo endpoint dedicado vs reuso de `forms-ingest`. Recomendo **novo endpoint** (`track-event/index.ts`) para não poluir `form_submissions`.

### 1.2 — Capturar clicks em WhatsApp (resolve P0.3)

```js
document.addEventListener('click', function(ev){
  var a = ev.target.closest && ev.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
  if (!a) return;
  sendCustomEvent('whatsapp_click', {
    href: a.href,
    text: (a.innerText || '').slice(0, 80),
    pathname: location.pathname
  });
}, true);
```

No CRM, o `track-event` insere em `lead_events` (sem `lead_id` ainda — vincula depois via `visitor_id` ou na próxima submissão).

### 1.3 — Padronizar telefone para `+E.164` (resolve P1.6)

- Alterar `forms-ingest/index.ts:54-60` para retornar `"+55..."`.
- Migration retroativa: `UPDATE leads SET phone = '+' || phone WHERE phone ~ '^[0-9]+$' AND length(phone) >= 12`.
- Atualizar `docs/integracao/05-atribuicao-leads.md` e `10-referencia-tecnica.md`.

**Saída da Fase 1:** CRM recebe 100 % das conclusões de teste e dos clicks WhatsApp; telefones alinhados.

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
