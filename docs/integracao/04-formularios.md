---
title: 04 — Formulários
topic: tracking
kind: reference
audience: user
updated: 2026-06-07
summary: "O `forms-snippet` adiciona **um listener global** em `document.addEventListener(\\\\\\\"submit\\\\\\\", ..., true)`. Quando qualquer `<form>` da página é submetido:"
---
# 04 — Formulários

> **Pré-requisito:** `forms-snippet` instalado ([02](./02-instalacao-snippets.md)).

---

## Como funciona

O `forms-snippet` adiciona **um listener global** em `document.addEventListener("submit", ..., true)`. Quando qualquer `<form>` da página é submetido:

1. Pula se tiver `data-mk-ignore`.
2. Detecta o `form_key` (atributo `data-mk-form`, ou `id`, ou `name`, ou heurística pela action).
3. Coleta os campos (`input`, `textarea`, `select`).
4. Resolve `email`, `phone`, `name`, `message` por:
   - Atributo `data-mk-field`.
   - Aliases de `name=` (lista abaixo).
   - Substring no nome.
5. Envia POST para `forms-ingest` via `navigator.sendBeacon` (fallback `fetch keepalive`).
6. O `<form>` segue seu fluxo normal (não fazemos `preventDefault`).

> ⚠ **Limite conhecido (v1):** se o seu form usa um **botão custom (`<button type="button">`)** que chama `fetch()` em vez de fazer submit nativo, o snippet **não** captura. Veja o [09 — Troubleshooting](./09-troubleshooting.md) para alternativas.

---

## Aliases automáticos

| Campo lógico | Aliases reconhecidos (em `name=`, `id=`, `data-mk-field=`) |
|---|---|
| `name` | name, nome, fullname, full_name, your-name, first_name, firstname |
| `email` | email, e-mail, your-email, mail |
| `phone` | phone, telefone, tel, celular, whatsapp, wpp, your-phone, your-tel, mobile |
| `message` | message, mensagem, your-message, msg, comments, comentario |

Comparação **case-insensitive**, com fallback de substring (`includes`).

---

## Forçar mapeamento

Se o campo tem nome esquisito (ex.: gerado por plugin):

```html
<input name="cf_7_abc123" data-mk-field="email" type="email" />
```

---

## Normalização

| Campo | Tratamento |
|---|---|
| `email` | `trim` + `toLowerCase` + validação regex (`^[^\s@]+@[^\s@]+\.[^\s@]+$`) — inválido vira `null` |
| `phone` | Só dígitos. Se 10 ou 11 dígitos → prepende `55`. Resultado: `5511999998888` |
| `name` | `trim`, sem outras alterações |

Se nem `email` nem `phone` puderem ser extraídos, **a submission é gravada** com `status="no_contact"` mas **nenhum lead é criado**.

---

## Atributos no `<form>`

| Atributo | Comportamento |
|---|---|
| `data-mk-form="phq9"` | Define `form_key=phq9` (vira o identificador no painel). Recomendado. |
| `data-mk-name="Teste PHQ-9"` | Nome humano que aparece no CRM. |
| `data-mk-ignore` | Snippet ignora o form completamente. |
| `data-mk-redirect="/obrigado"` | Redireciona após submit. Se omitido, o form segue o `action` normal. |

---

## Forms gerados automaticamente

Na primeira submissão de um `form_key` ainda não cadastrado, o `forms-ingest` cria sozinho um registro em `form_definitions` com:
- `name = data-mk-name || form_key`
- `source_page = location.href`
- `field_map = {}`

Depois você pode editar no painel: rename, definir `default_pipeline_stage_id`, adicionar `default_tags`, etc.

---

## Plugins WordPress

### Plugin oficial MK-CRM (recomendado)

1. CRM → **Configurações → Forms → Plugin WP** → clique em "Baixar plugin".
2. O servidor gera um `.zip` parametrizado com o seu token.
3. WordPress → **Plugins → Adicionar novo → Enviar plugin** → ative.
4. Pronto: ele integra com **Contact Form 7**, **WPForms**, **Forminator** automaticamente.

### Contact Form 7 manual

Se preferir, adicione no `functions.php`:

```php
add_action('wpcf7_mail_sent', function($contact_form) {
  $submission = WPCF7_Submission::get_instance();
  if (!$submission) return;
  $data = $submission->get_posted_data();
  wp_remote_post('https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-ingest', [
    'headers' => [
      'Content-Type' => 'application/json',
      'x-form-token' => 'SEU_TOKEN',
    ],
    'body' => json_encode([
      'form_key' => 'cf7_' . $contact_form->id(),
      'form_name' => $contact_form->title(),
      'source_page' => $_SERVER['HTTP_REFERER'] ?? '',
      'fields' => $data,
    ]),
    'timeout' => 5,
  ]);
});
```

Veja [exemplos/wordpress-cf7.php](./exemplos/wordpress-cf7.php).

### Elementor Forms

Use a action **Webhook**:
- URL: `https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-ingest?token=SEU_TOKEN`
- Adicione um campo escondido `form_key` com valor único por form.

Detalhes em [exemplos/wordpress-elementor.txt](./exemplos/wordpress-elementor.txt).

---

## Schema do POST `forms-ingest`

```json
{
  "form_key": "phq9",                          // obrigatório, max 128 chars
  "form_name": "Teste PHQ-9",                  // opcional, max 200
  "source_page": "https://site.com/teste",     // opcional, max 500
  "fields": {                                  // obrigatório (pode ser {})
    "name": "Ana",
    "email": "ana@example.com",
    "phone": "11999998888",
    "score": 18,
    "...qualquer outro campo...": "..."
  },
  "visitor_id": "v_abc123",                    // opcional, vem do tracker
  "session_id": "s_xyz789"                     // opcional, vem do tracker
}
```

Headers:
- `Content-Type: application/json`
- `x-form-token: SEU_TOKEN` (ou via query `?token=...`)

Resposta:
```json
{ "ok": true, "status": "ok", "lead_id": "uuid", "is_new_lead": true }
```

---

## Próximo passo

➡ [05 — Atribuição & identidade do lead](./05-atribuicao-leads.md)
