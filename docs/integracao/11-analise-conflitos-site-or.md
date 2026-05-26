# 11. Análise de Conflitos — Site Clínica ÓR ↔ CRM MK

> **Data:** 2026-05-26
> **Fontes cruzadas:**
> - `integracao-crm.md` (documentação enviada pelo time do site da Clínica ÓR, descrevendo o estado real do código deles)
> - Código vivo do CRM: `supabase/functions/forms-snippet/index.ts`, `supabase/functions/forms-ingest/index.ts`, `supabase/functions/tracking-pixel/index.ts`
> - Documentação interna do CRM em `docs/integracao/01..10`
>
> **Objetivo:** identificar tudo que está prometido em algum dos dois lados e **não funciona ponta-a-ponta**, classificar por severidade e fornecer prompts/SQL de diagnóstico.

---

## 1. Resumo executivo

A integração CRM ↔ Site Clínica ÓR está funcionando **apenas para o caminho mais simples**: o snippet `forms-snippet` captura o evento `submit` dos 4 formulários marcados com `data-mk-form` e grava um lead em `forms-ingest`. **Tudo o resto** que o snippet/CRM promete (atribuição, page-view, UTM, clicks de WhatsApp, conclusão de teste, identidade de visitante) **não está acontecendo** para esse cliente — porque depende de componentes que **não estão instalados no site** ou de eventos que **não passam por `<form>`**.

| Severidade | Qtde | Descrição rápida |
|---|---|---|
| **P0 — Bloqueador** | 3 | `tracking-pixel` ausente, Etapa 2 do quiz invisível, WhatsApp clicks perdidos |
| **P1 — Alto** | 4 | Campos sem `name=`, `allowed_domains` não validado, telefone divergente, sem chave canônica entre lados |
| **P2 — Médio** | 4 | PII em claro vs hash, SPA sem hook, `source_page` divergente, sem `field_map` |
| **P3 — Baixo** | 3 | Opt-in não marcado é perdido, sem retry, sem versionamento de snippet |

**O que isso significa na prática:**
- O dashboard do CRM mostra 100 % dos leads desse site como **"sem origem"** (sem UTM, sem referrer, sem visitante).
- O CRM **nunca recebe o score** dos testes PHQ-9/GAD-7 → automações baseadas em severidade do teste **não disparam**.
- Conversões via botão WhatsApp são **invisíveis** ao CRM.
- Existe risco de **duplicação silenciosa**: o lead nasce como UUID no site e como outro UUID no CRM, sem chave de ligação.

---

## 2. Metodologia

Cruzei item-a-item:

1. O que a doc do site **afirma que existe** no código do site (seções 2, 3, 5, 6 do `integracao-crm.md`).
2. O que o snippet do CRM (`forms-snippet/index.ts`) **efetivamente faz** no DOM.
3. O que o endpoint do CRM (`forms-ingest/index.ts`) **efetivamente persiste**.
4. O que a documentação interna do CRM (`docs/integracao/03-tracking-eventos.md`, `05-atribuicao-leads.md`) **promete ao usuário final**.

Cada conflito abaixo lista: **sintoma no CRM → causa técnica (referência ao código) → impacto → quem corrige**.

---

## 3. Conflitos detalhados

### P0.1 — `tracking-pixel` não está instalado no site

**Sintoma no CRM:**
- `tracking_identity_links` permanentemente vazio para `clinic_id` da Clínica ÓR.
- Todo `form_submissions.visitor_id = NULL` e `session_id = NULL`.
- Dashboard de "Origem dos leads" 100 % vazio (sem UTM, sem referrer, sem gclid/fbclid).

**Causa técnica:**
- `integracao-crm.md` seção 0 lista **apenas** o snippet `forms-snippet?token=mkf_3a2f5dd0…` no `<head>` do site.
- A doc do site, seção 6.1, declara **explicitamente removidos** todos os trackers e o cookie `_mk_vid`.
- `forms-snippet/index.ts:16-17` lê `_mk_vid` e `_mk_sid` de cookie/storage:
  ```js
  function readVid(){...getCookie("_mk_vid")||localStorage.getItem("_mk_vid")...}
  function readSid(){...sessionStorage.getItem("_mk_sid")...}
  ```
- Esses valores são gravados **somente** pelo `tracking-pixel` (que não está no site). Logo, `forms-snippet` sempre envia `visitor_id: null`.
- `forms-ingest/index.ts:194-202` só faz upsert em `tracking_identity_links` **se** `visitor_id` vier preenchido → branch nunca executa.

**Impacto:** atribuição multi-touch, ROI por canal, e qualquer relatório de "por onde veio o lead" estão zerados.

**Quem corrige:** **site** (instalar `tracking-pixel`) + **CRM** (documentar dependência no onboarding).

---

### P0.2 — Etapa 2 do quiz (`submit-test-result`) é invisível ao CRM

**Sintoma no CRM:**
- Para todo lead `phq9`/`gad7`: existe `form_submissions` da Etapa 1, mas **nenhum** evento subsequente registrando o `score`, o `result_label` ou se o teste foi concluído.
- Automações "se score ≥ 16 disparar alerta clínico" **não têm dado para rodar**.

**Causa técnica:**
- `integracao-crm.md` seção 1.1 e A4 mostram que a Etapa 2 do quiz é enviada por `supabase.functions.invoke("submit-test-result", …)` direto, **sem passar por `<form>`**.
- `forms-snippet/index.ts:59-63` escuta **apenas** `document.addEventListener("submit", …)`. Não intercepta `fetch` nem XHR.
- Resultado: o CRM nunca recebe `{score, result_label, answers}`.

**Impacto:** o produto "teste de saúde mental" é o canal mais relevante de aquisição da clínica, e o CRM perde justamente o sinal qualitativo (severidade) — só sabe que o lead "começou".

**Quem corrige:** **CRM** (adicionar interceptor de `fetch` no snippet OU criar `track-event` endpoint genérico) OU **site** (emitir `window.dispatchEvent(new CustomEvent('mk:test:completed', {detail:{...}}))` conforme proposta da seção 7.1 da doc deles).

---

### P0.3 — Cliques em WhatsApp não são capturados

**Sintoma no CRM:**
- `lead_events` não tem nenhum evento `whatsapp_click` para esse cliente.
- "Conversão por canal" no dashboard mostra WhatsApp = 0, mesmo sendo o CTA principal do site.

**Causa técnica:**
- `forms-snippet/index.ts` não registra `click` listener.
- `integracao-crm.md` seção 6.2 confirma: WhatsApp CTAs usam `useWhatsAppHref()` que é "literalmente um no-op" em termos de tracking.

**Impacto:** WhatsApp é, em clínicas, tipicamente 40–70 % das conversões. Estamos cegos.

**Quem corrige:** **CRM** — adicionar `document.addEventListener('click', …)` delegado para `a[href*="wa.me"], a[href*="api.whatsapp"]` no `forms-snippet`.

---

### P1.4 — Inputs sem `name=` em TestLeadForm e WebinarLP

**Sintoma no CRM:**
- Funciona hoje, mas qualquer renomeação de `id` no site quebra **silenciosamente** (lead chega com `name`/`email`/`phone` em branco).

**Causa técnica:**
- `integracao-crm.md` seção 2.2 e 2.4: inputs do `TestLeadForm` e `WebinarLP` **não têm atributo `name`**, só `id`.
- `forms-snippet/index.ts:30` faz fallback: `var name = el.name || el.getAttribute("data-mk-field") || el.id`. OK.
- `forms-ingest/index.ts:28-52` faz match por aliases + **substring** (`k.toLowerCase().includes(a)`).
  - `WebinarLP` usa IDs prefixados (`webinar-name`, `webinar-email`, `webinar-phone`). O `includes("name")`, `includes("email")`, `includes("phone")` pega. OK por sorte.
  - **Mas**: o alias `"tel"` em `phone` é perigoso. Qualquer campo com "tel" no id seria classificado como telefone. Hoje passa, mas é mina futura.
- O snippet **silencia falhas** (`try/catch` vazio em `send()`), então um campo perdido nunca aparece em log.

**Impacto:** dívida técnica latente. Funciona até alguém renomear um input.

**Quem corrige:** **site** (adicionar `name=` ou `data-mk-field=` explícito) OU **CRM** (configurar `field_map` explícito por form via UI — ver P2.11).

---

### P1.5 — `allowed_domains` do token nunca foi validado

**Sintoma no CRM:**
- Possíveis 403 silenciosos em submissões vindas do domínio de preview Lovable.

**Causa técnica:**
- `forms-ingest/index.ts:62-72, 100-102` valida `Origin` contra `integration.allowed_domains`. Se a lista estiver vazia → libera tudo; se estiver populada sem `mindscape-revive.lovable.app` → bloqueia preview.
- Não temos histórico de qual configuração foi salva para o token `mkf_3a2f5dd0…`.

**Impacto:** se bloqueado, leads do ambiente de preview/staging do site nunca chegam ao CRM.

**Quem corrige:** **CRM** — checar via SQL (`SELECT allowed_domains FROM form_integrations WHERE token = 'mkf_3a2f5dd0...'`) e ajustar.

---

### P1.6 — Formato de telefone divergente

**Sintoma no CRM:**
- Lookup cruzado por telefone entre o banco do site (`leads.phone_e164 = '+5511987654321'`) e o banco do CRM (`leads.phone = '5511987654321'`) **não bate**.

**Causa técnica:**
- Site: `integracao-crm.md` seção 4.1 e A1 → `phone_e164` armazenado **com `+`**.
- CRM: `forms-ingest/index.ts:54-60` → `normalizePhone` retorna **sem `+`** (`"55" + d` sem prefixar `+`).

**Impacto:** qualquer reconciliação manual ou export combinado precisa de regex para normalizar. Dedup entre fontes não acontece automaticamente.

**Quem corrige:** **CRM** — padronizar para `+E.164` (com `+`) e fazer migration retroativa.

---

### P1.7 — Sem chave canônica entre `leads` do site e `leads` do CRM

**Sintoma no CRM:**
- O lead nasce com UUID `lead_id` no banco do site.
- O snippet captura o submit **antes** de saber o `lead_id` do site (o snippet roda antes do `await supabase.functions.invoke(...)` retornar).
- No CRM, o lead é criado com outro UUID, sem referência ao do site.
- Resultado: **dois UUIDs para o mesmo paciente**, sem ligação.

**Causa técnica:**
- `forms-snippet/index.ts:42-58`: `send(form)` é chamado no `submit` event, em capture phase, **antes** do código React do site fazer o `invoke`. Logo, snippet não tem como conhecer `lead_id` retornado pelo endpoint do site.
- Não existe campo `external_lead_id` em `public.leads` do CRM.

**Impacto:** impede webhook reverso futuro (P4 do roadmap) de fazer match. Qualquer "evento posterior" enviado pelo site precisaria fazer match por `(email, phone)` em vez de UUID.

**Quem corrige:** **ambos** — site precisa emitir evento `mk:lead:created` com `lead_id` (proposta seção 7.1 da doc deles) e CRM precisa adicionar coluna `external_lead_id` em `leads`.

---

### P2.8 — Snippet trafega PII em claro; site trafega hash

**Sintoma no CRM:**
- E-mail e telefone aparecem em texto puro em `form_submissions.payload` e `lead_events.payload`.

**Causa técnica:**
- Site (`integracao-crm.md` política de dados): só armazena `email_sha256` / `phone_sha256` além dos campos normalizados.
- CRM (`forms-ingest/index.ts:227-239`): grava `payload: data.fields` integralmente. Sem hashing.

**Impacto:** inconsistência com a política LGPD declarada pelo site. Auditoria pode apontar.

**Quem corrige:** **CRM** — decidir se queremos hash redundante; se sim, gravar `email_sha256` em `leads` e omitir PII de `form_submissions.payload`.

---

### P2.9 — SPA navigation sem hook de `pushState`/`popstate`

**Sintoma no CRM:**
- Mesmo se o `tracking-pixel` fosse instalado, page-views internos do React Router (`/contato → /webinar`) não seriam contados.

**Causa técnica:**
- `tracking-pixel/index.ts` (e o snippet) leem `location.pathname` no carregamento. Não há listener para `history.pushState`.
- `integracao-crm.md` seção 6.3 confirma: roteamento é SPA, e detecção depende de hook explícito.

**Impacto:** sub-contagem de visitas. Métricas de funil dentro de uma sessão ficam quebradas.

**Quem corrige:** **CRM** — adicionar monkey-patch de `history.pushState` no `tracking-pixel`.

---

### P2.10 — `source_page` divergente entre os dois lados

**Sintoma no CRM:**
- Para o mesmo submit, o snippet manda `source_page: "https://clinicaohrpsiquiatria.com/teste-de-depressao-quiz?utm_source=fb"`. O banco do site grava `source_page: "/teste-de-depressao-quiz"`.
- Relatórios "leads por página" diferem entre os dois sistemas.

**Causa técnica:**
- Snippet (`forms-snippet/index.ts:48`): `source_page: location.href` (URL completa).
- Site (`integracao-crm.md` seção 2.1): manda apenas `window.location.pathname` ou string hardcoded.

**Impacto:** comparações cruzadas exigem normalização. Pequena fricção operacional.

**Quem corrige:** **CRM** — padronizar para `location.pathname` no snippet ou guardar URL completa **e** path separados.

---

### P2.11 — `form_key` auto-descoberto, sem `field_map`

**Sintoma no CRM:**
- `treatmentInterest` (do form `contato`) e `accepts_marketing` ficam só em `custom_fields.form_submission`, não em colunas dedicadas. Filtros/relatórios precisam abrir JSON.

**Causa técnica:**
- `forms-ingest/index.ts:118-132`: auto-cria `form_definition` com `field_map: {}` vazio.
- Nenhum operador configurou mapping manual depois.

**Impacto:** consultas no CRM precisam usar `payload->>'treatmentInterest'`. Funciona mas é ruim para usuário não-técnico.

**Quem corrige:** **CRM** — UI de configuração de `field_map` por formulário (existe rota `/settings/forms`; falta o editor).

---

### P3.12 — `accepts_marketing = false` é silenciado

**Sintoma no CRM:**
- O CRM nunca registra "usuário **desmarcou** opt-in" — só registra quando marcou.

**Causa técnica:**
- `forms-snippet/index.ts:34`: `if(type==="checkbox"||type==="radio"){if(!el.checked)continue;}` → pula o campo se não estiver marcado.
- Site (`integracao-crm.md` seção 2.4): manda `accepts_marketing: true|false` explicitamente. Snippet manda **só `true`**.

**Impacto:** para LGPD não importa muito (default = false), mas para auditoria perde o sinal explícito.

**Quem corrige:** **CRM** — capturar sempre, codificando `"0"`/`"1"`.

---

### P3.13 — Sem retry / sem observabilidade de falha de envio

**Causa técnica:**
- `forms-snippet/index.ts:56`: `fetch(...).catch(function(){})` — engole erro.
- `sendBeacon` retorna boolean mas não é instrumentado.

**Impacto:** se o `forms-ingest` ficar down ou o `Origin` for bloqueado, perdemos leads **silenciosamente**.

**Quem corrige:** **CRM** — fila local em `localStorage` + retry exponencial; reportar status em `window.MKForms.lastError`.

---

### P3.14 — Snippet sem versionamento de cache

**Causa técnica:**
- `forms-snippet/index.ts:75`: `Cache-Control: public, max-age=300` → mudanças propagam em até 5 min, e CDN/proxy pode estender.

**Impacto:** rollout de fix demora; sem hash na URL, não há "pin" de versão por cliente.

**Quem corrige:** **CRM** — aceitar `?v=<hash>` no `src` e setar `Cache-Control: immutable` quando `v` presente.

---

## 4. Matriz de impacto

| Feature do CRM                          | P0.1 | P0.2 | P0.3 | P1.4 | P1.5 | P1.6 | P1.7 | P2.8 | P2.9 | P2.10 | P2.11 | P3.12 | P3.13 | P3.14 |
|-----------------------------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:----:|:----:|:----:|:----:|:----:|
| Atribuição por UTM / canal              |  X  |     |     |     |     |     |     |     |  x  |   x  |      |      |      |      |
| Funil por página (`source_page`)        |  X  |     |     |     |     |     |     |     |  x  |   X  |      |      |      |      |
| Dedup automático site↔CRM               |     |     |     |     |     |  X  |  X  |     |     |      |      |      |      |      |
| Automação por severidade do teste       |     |  X  |     |     |     |     |     |     |     |      |      |      |      |      |
| ROI por canal (WhatsApp)                |  x  |     |  X  |     |     |     |     |     |     |      |      |      |      |      |
| Captura confiável de leads do form      |     |     |     |  X  |  X  |     |     |     |     |      |      |      |      |  X   |
| Conformidade LGPD                       |     |     |     |     |     |     |     |  X  |     |      |      |  x   |      |      |
| Filtros no CRM por interesse/tratamento |     |     |     |     |     |     |     |     |     |      |  X   |      |      |      |
| Observabilidade de falha                |     |     |     |     |     |     |     |     |     |      |      |      |  X   |      |

Legenda: **X** = quebra a feature; **x** = degrada parcialmente.

---

## 5. Diagnóstico do lado do site (prompt pronto)

Cole no chat do Lovable do site da Clínica ÓR:

> ```
> Preciso de um diagnóstico da integração com o CRM MK. Por favor:
>
> 1. Confirme que o seguinte script está presente em `index.html` **dentro do `<head>`** e que carrega em produção (domínios reais: `clinicaohrpsiquiatria.com` em produção, `mindscape-revive.lovable.app` em preview):
>    <script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-snippet?token=mkf_3a2f5dd057a3314e39829f5e1c56868c"></script>
>
> 2. Abra cada uma destas páginas em produção, no DevTools console, e rode estes comandos. Cole o resultado:
>    - /teste-de-depressao-quiz   → `document.querySelectorAll('[data-mk-form]').length`  (esperado: 1)
>    - /teste-ansiedade-gad7      → idem (esperado: 1)
>    - /contato                   → idem (esperado: 1)
>    - /webinar                   → idem (esperado: 1)
>    - qualquer página            → `typeof window.MKForms` (esperado: "object")
>    - qualquer página            → `document.cookie.includes('_mk_vid')` (esperado: false hoje — confirma que tracking-pixel não está instalado)
>
> 3. Verifique se há **CSP (Content-Security-Policy)** em `<meta>` ou nos headers HTTP que possa estar bloqueando script de `hrbhmqckzjxjbhpzpqeo.supabase.co` ou requisições `fetch`/`sendBeacon` para esse domínio.
>
> 4. Confirme que **nenhum** dos formulários (`phq9`, `gad7`, `contato`, `webinar`) tem `e.stopPropagation()` antes do `preventDefault` (isso quebraria a captura em capture phase do snippet).
>
> 5. Em `/teste-de-depressao-quiz`, preencha e submeta o form de Etapa 1. Cole no chat:
>    - O payload do POST para `hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-ingest` que aparece na aba Network.
>    - Os headers da requisição (especialmente `Origin`).
>    - O status code da resposta.
>
> Não mude nenhum código. Só relatório.
> ```

---

## 6. Diagnóstico do lado do CRM (SQL pronto)

Substituir `<INTEGRATION_TOKEN>` por `mkf_3a2f5dd057a3314e39829f5e1c56868c` e `<CLINIC_ID>` pelo `clinic_id` da Clínica ÓR.

```sql
-- 6.1 Configuração do token
SELECT id, clinic_id, status, allowed_domains, previous_token,
       previous_token_expires_at, total_submissions, last_submission_at
FROM form_integrations
WHERE token = '<INTEGRATION_TOKEN>' OR previous_token = '<INTEGRATION_TOKEN>';

-- 6.2 Submissões últimas 24h
SELECT date_trunc('hour', created_at) AS hora,
       count(*) AS total,
       count(*) FILTER (WHERE status = 'ok') AS ok,
       count(*) FILTER (WHERE status = 'error') AS erro,
       count(*) FILTER (WHERE status = 'no_contact') AS sem_contato
FROM form_submissions
WHERE integration_id = (SELECT id FROM form_integrations WHERE token = '<INTEGRATION_TOKEN>')
  AND created_at >= now() - interval '24 hours'
GROUP BY 1 ORDER BY 1 DESC;

-- 6.3 Confirma que visitor_id está sempre NULL (esperado dado P0.1)
SELECT count(*) AS total,
       count(*) FILTER (WHERE payload ? 'visitor_id') AS com_visitor,
       count(*) FILTER (WHERE (payload->>'visitor_id') IS NOT NULL) AS visitor_nao_nulo
FROM form_submissions
WHERE clinic_id = '<CLINIC_ID>';

-- 6.4 Tracking identity links (esperado: 0 linhas)
SELECT count(*) FROM tracking_identity_links WHERE clinic_id = '<CLINIC_ID>';

-- 6.5 Form definitions auto-descobertos
SELECT form_key, name, total_submissions, last_submission_at, field_map
FROM form_definitions
WHERE integration_id = (SELECT id FROM form_integrations WHERE token = '<INTEGRATION_TOKEN>');

-- 6.6 Amostra de leads vindos do site
SELECT id, name, email, phone, form_source, landing_page, tags, custom_fields
FROM leads
WHERE clinic_id = '<CLINIC_ID>'
  AND form_source LIKE 'form:%'
ORDER BY created_at DESC LIMIT 20;

-- 6.7 Eventos de timeline (esperado: só form_submission, nenhum whatsapp_click)
SELECT type, count(*) FROM lead_events
WHERE clinic_id = '<CLINIC_ID>'
GROUP BY type ORDER BY 2 DESC;
```

---

## 7. Conclusão

A integração **está operando bem abaixo do que tanto a doc do site quanto a doc do CRM prometem**. O caminho de menor resistência para destravar valor é:

1. **Curto prazo (CRM-only):** interceptar `fetch` para `/submit-test-result` e capturar clicks em `wa.me` no `forms-snippet`. Resolve P0.2 e P0.3 sem depender do time do site.
2. **Médio prazo (coordenação):** pedir ao site para instalar `tracking-pixel`. Resolve P0.1 e abre P2.9/P2.10.
3. **Longo prazo (contrato):** implementar a proposta da seção 7 do `integracao-crm.md` — eventos DOM customizados + webhook reverso — para ter captura 100 % independente de snippet.

Detalhamento dos passos e estimativas em `12-roadmap-correcao.md`.
