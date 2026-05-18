# Bloco extra — Captura de lead parcial no preenchimento do formulário do site

## Objetivo
Quando o visitante começa a preencher um formulário no site da Clínica Ór e **sai (blur) de um campo de telefone ou e-mail**, o CRM já recebe um lead identificado, com a maior quantidade possível de dados, ligado ao `visitor_id` que veio do tracking.

Se o usuário continuar preenchendo, cada blur atualiza/enriquece o mesmo lead. Se abandonar, o lead permanece com os dados parciais. Se enviar de fato, o `submit-test-lead` atual continua funcionando e o lead já existirá (será atualizado, não duplicado).

## Arquitetura

```
SITE CLÍNICA (projeto: Clinica Ór OFICIAL)
  └─ TestLeadForm.tsx (onBlur de cada campo)
       │
       ▼  fetch direto + shared secret + visitor_id
CRM (este projeto)
  └─ edge: external-lead-capture (NOVO, verify_jwt=false, público)
       │
       ▼ valida + upsert
  ├─ leads          (idempotente por clinic_id + phone OR email)
  ├─ tracking_identity_links  (linka visitor_id ↔ lead_id)
  └─ lead_events    (snapshot 'partial_form_capture')
```

## Implementação — CRM (este projeto)

### 1. Secret novo
`EXTERNAL_LEAD_CAPTURE_TOKEN` — token compartilhado que o site coloca no header `x-capture-token`. Será solicitado via `secrets--add_secret` antes de mexer no código.

### 2. Edge function nova: `supabase/functions/external-lead-capture/index.ts`
- `verify_jwt = false` (em config.toml)
- CORS aberto (precisa aceitar o domínio do site)
- Body Zod:
  ```ts
  z.object({
    clinic_id: z.string().uuid(),
    visitor_id: z.string().min(1).max(64).optional(),
    session_id: z.string().min(1).max(64).optional(),
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(32).optional(),
    source_page: z.string().max(255).optional(),
    form_kind: z.string().max(64).optional(),   // ex: "phq-9", "contact"
    extra: z.record(z.unknown()).optional(),
  }).refine(d => d.email || d.phone, { message: "email OR phone required" })
  ```
- Header check: `x-capture-token` deve bater com `EXTERNAL_LEAD_CAPTURE_TOKEN`. Retorna 401 senão.
- Normaliza phone (só dígitos, com DDI 55 quando faltar).
- Usa cliente service-role (SUPABASE_SERVICE_ROLE_KEY) para escrever ignorando RLS, mas filtrando explicitamente pelo `clinic_id` recebido.
- **Match do lead**:
  1. Procura lead existente nesse `clinic_id` por phone (igualdade) → se achar, atualiza name/email se vierem e estiverem vazios.
  2. Senão, por email (case-insensitive) → mesma regra.
  3. Senão, cria novo lead.
- Após resolver `lead_id`:
  - Se veio `visitor_id`, faz upsert em `tracking_identity_links (clinic_id, visitor_id, lead_id, link_source='form_partial')`.
  - Insere `lead_events` com `type='partial_form_capture'` e payload `{ form_kind, source_page, fields_present: ['name','email','phone'].filter(present), extra }`. (Evita duplicar se o último evento do mesmo lead/form_kind for igual nos últimos 60s.)
- Retorna `{ lead_id }`.

### 3. config.toml
Adicionar bloco `[functions.external-lead-capture] verify_jwt = false`.

### 4. CORS
Aceitar `*` (público) ou restringir aos domínios `clinicaohrpsiquiatria.com` e `mindscape-revive.lovable.app` via lista.

## Implementação — Site Clínica (projeto Clinica Ór OFICIAL)

### 5. Novo helper `src/lib/crmCapture.ts`
- Lê `visitor_id` do cookie/localStorage (já existe no site para tracking).
- Função `captureLeadPartial(payload)` que faz `fetch` para
  `https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/external-lead-capture`
  com `x-capture-token` (VITE env), `apikey` (anon key já existente) e body JSON.
- Mantém em memória o último snapshot enviado; **só dispara se algum campo mudou e (email || phone) preenchidos**.

### 6. `TestLeadForm.tsx` — onBlur
- `onBlur` em cada `<Input />`: chama `captureLeadPartial({ name, email, phone, form_kind: testType, source_page: sourcePage, clinic_id: VITE_CRM_CLINIC_ID })`.
- Continua chamando `submit-test-lead` normalmente no submit (que já cria o lead no banco *do site* + envia para o CRM).

### 7. Variáveis novas no site
- `VITE_CRM_CAPTURE_URL` (URL do edge)
- `VITE_CRM_CAPTURE_TOKEN` (mesmo valor do secret no CRM)
- `VITE_CRM_CLINIC_ID` (UUID da clínica no CRM)

## Detalhes técnicos

- **Sem duplicação**: a função é idempotente por `(clinic_id, phone)` e `(clinic_id, email)`. Cada blur é seguro.
- **Privacidade**: rejeita payloads sem email nem phone; valida domínio do email; trim em tudo.
- **Throttle**: cliente só envia se mudou; servidor deduplica `lead_events` em janela de 60s.
- **Rastreio**: o lead aparece no Kanban com origem do `tracking_lead_sources` se o site já registrar via tracking-identify; e na nova **Linha do tempo** (bloco #4) já mostra o evento `partial_form_capture` automaticamente.
- **Segurança**: token compartilhado evita spam externo; o body é validado e o `clinic_id` confere com o token caso queiramos amarrar (por enquanto basta token global).

## Fora do escopo
- Não vamos guardar histórico de cada keystroke; só snapshot no blur.
- Não vamos gravar nada na DB do site além do que já existe — a fonte de verdade do "lead parcial" é o CRM.
- Bloco #3 (redirects /r/:token) e #5 (deals/revenue) continuam pendentes para depois.
