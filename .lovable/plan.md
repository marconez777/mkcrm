## Objetivo

Permitir que qualquer site de clínica (WordPress, HTML estático ou React/Lovable) envie leads diretamente para o CRM, disparando automaticamente as automações de e-mail já existentes ("Lead criado", segmentos, sequências).

Hoje já existe a infraestrutura de tracking pixel (`tracking_sites` + `tracking-ingest`) e os triggers de e-mail (`tg_email_on_lead_created`, `lead_matches_segment`). Falta a "ponte" pública: um endpoint que recebe POST de formulários externos, cria o lead na clínica certa e amarra a sessão de tracking — o resto (e-mails) já acontece sozinho.

## Arquitetura

```text
 Site da clínica (WP/HTML/React)
        │
        │  1) pixel.js (já existe) → tracking-ingest  → tracking_sessions
        │
        │  2) <form> submit  → POST /lead-capture
        │           { siteToken, sessionId?, email, name, phone, tags, customFields }
        ▼
   Edge Function: lead-capture  (nova, pública, sem JWT)
        │
        ├─ valida siteToken em tracking_sites  → clinic_id
        ├─ dedup por (clinic_id, email|phone)
        ├─ INSERT em leads (com origin_source, tracking_session_id)
        ├─ adiciona tags ("site", "form:contato", etc)
        └─ retorna { ok, lead_id }
        │
        ▼
  Trigger SQL tg_email_on_lead_created  → enqueue_email (já implementado)
```

Reusa o `ingest_token` já existente em `tracking_sites` — o mesmo token serve para o pixel e para o formulário. Nada novo no banco.

## O que vai ser implementado

### 1. Edge Function `lead-capture` (pública, `verify_jwt = false`)

- POST `{ siteToken, sessionId?, email?, phone?, name?, tags?, customFields?, source? }`
- CORS aberto (`Access-Control-Allow-Origin: *`) para funcionar em qualquer domínio.
- Valida `siteToken` → resolve `clinic_id`.
- Exige pelo menos `email` ou `phone`.
- Dedup: se já existe lead com mesmo email/phone na clínica → atualiza (merge de tags, custom_fields, último `tracking_session_id`) ao invés de criar duplicado.
- Se `sessionId` veio, marca `tracking_sessions.lead_id` e copia `utm_*` para `origin_source`/`origin_confidence` (mesma lógica do `tracking-claim`).
- Tags default: `["site"]` + tags vindas do form.
- Retorna `{ ok: true, lead_id }` (ou `{ ok: true, already: true }` no merge).
- Rate limit simples por `ip_hash` (ex.: 30 req/min) para evitar spam de bot.
- Opcional: campo `honeypot` no body — se preenchido, retorna 200 silencioso sem criar lead.

### 2. UI: aba "Integração de site" em `SettingsEmailDomain` (ou nova em `/email/sites`)

Para cada `tracking_site` da clínica, mostrar 3 abas com snippets prontos para copiar:

**a) WordPress** — bloco HTML/JS que pode ser colado em qualquer página via "Custom HTML" do Gutenberg, ou num shortcode/Elementor:
```html
<form id="mk-lead-form">
  <input name="name"  placeholder="Nome" required>
  <input name="email" type="email" placeholder="E-mail" required>
  <input name="phone" placeholder="WhatsApp">
  <input name="_hp" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Quero contato</button>
</form>
<script>
(function(){
  var f = document.getElementById('mk-lead-form');
  f.addEventListener('submit', async function(e){
    e.preventDefault();
    var fd = new FormData(f);
    if (fd.get('_hp')) return;
    await fetch('https://<edge>/lead-capture', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        siteToken: '<TOKEN_DA_CLINICA>',
        sessionId: window.MK_SESSION_ID || null,
        name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'),
        tags: ['form:contato'],
      })
    });
    f.reset(); alert('Recebido!');
  });
})();
</script>
```

**b) HTML puro** — mesmo snippet acima, standalone.

**c) React/Lovable** — componente `<LeadForm token="..." />` que faz o mesmo fetch, com TypeScript:
```tsx
await fetch(`${import.meta.env.VITE_LEAD_CAPTURE_URL}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ siteToken, email, name, phone, tags: ['lovable-site'] }),
});
```

Cada aba mostra também:
- URL do endpoint
- `siteToken` da clínica (com botão "copiar")
- Instrução de como instalar também o pixel (já documentado em outra tela)

### 3. Plugin WordPress (opcional, fase 2)

Plugin `.zip` minúsculo que:
- Adiciona página de settings onde o admin cola só o `siteToken`.
- Registra shortcode `[mk_lead_form]`.
- Hook em Contact Form 7 / WPForms / Elementor Forms para repassar submissões automaticamente sem precisar trocar o form.

Fica para uma segunda etapa — o snippet acima já cobre 90% dos casos hoje.

## Como o e-mail é disparado

Não muda nada no fluxo de e-mail. Assim que `lead-capture` faz `INSERT INTO leads`:
1. `tg_email_on_lead_created` roda.
2. Itera nas `email_automations` ativas com `trigger_type='lead_created'`.
3. Aplica filtro de segmento via `lead_matches_segment` (já implementado).
4. Chama `enqueue_email` para cada step com seu delay.
5. `process-email-queue` dispara via Resend.

Ou seja: o usuário cria a automação na UI, gruda o snippet no site, e leads do site entram na sequência de e-mail automaticamente.

## Segurança

- `siteToken` é semi-público (vai no JS do site) — por isso usamos rate limit + honeypot + validação de origem opcional (`tracking_sites.domain` pode ser comparado com o header `Origin`).
- Sem service_role no client.
- RLS de `leads` continua intocada — só o edge function (service_role) escreve.

## Detalhes técnicos

- Função em `supabase/functions/lead-capture/index.ts`, deploy automático.
- Sem migration nova (reusa tabelas existentes). Se quiser auditoria futura, dá pra adicionar `leads.capture_source text` numa migration mínima.
- Rate limit: tabela leve `lead_capture_rate (ip_hash, window_start, count)` ou em memória do edge (suficiente para começo).
- Resposta sempre 200 (mesmo em erro de validação leve) para não vazar informação para spammers; logs internos via `console.error`.

## Entregáveis

1. `supabase/functions/lead-capture/index.ts` (novo)
2. Componente `SiteIntegrationSnippets.tsx` com as 3 abas, plugado em `SettingsEmailDomain` ou nova rota `/email/sites`
3. Documentação curta no próprio painel (passo a passo: criar site → copiar token → colar snippet)
