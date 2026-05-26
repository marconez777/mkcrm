# 02 — Instalação dos snippets

> **Antes de começar:** vá ao CRM → **Configurações → Forms** → escolha sua integração → aba **"Como instalar"**. Os snippets abaixo aparecem lá já com seu **token** e **project_id** preenchidos.

---

## Os 2 snippets

| Snippet | O que faz | Necessário? |
|---|---|---|
| **tracker** (`tracking-pixel`) | Rastreia visitas, UTMs, page_views, eventos custom | Recomendado |
| **forms** (`forms-snippet`) | Captura submits de `<form>` automaticamente | Necessário se você usa formulários |

> 💡 **Ordem importa:** **tracker** deve vir **antes** do **forms**. Assim o `forms-snippet` consegue ler o `visitor_id` e linkar o lead ao visitante.

---

## Snippet padrão (universal)

Cole **no `<head>` de todas as páginas**:

```html
<!-- MK Tracker -->
<script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=SEU_PROJECT_ID"></script>

<!-- MK Forms -->
<script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-snippet?token=SEU_TOKEN_PUBLICO"></script>
```

Substitua:
- `SEU_PROJECT_ID` → slug da clínica (ex.: `clinica-or`).
- `SEU_TOKEN_PUBLICO` → token da integração (não é segredo, mas é protegido por `allowed_domains`).

---

## Por plataforma

### WordPress (sem plugin)

1. Tema clássico: **Aparência → Editor de tema → `header.php`** → cole os `<script>` dentro do `<head>`.
2. Tema com block editor: use o plugin **Insert Headers and Footers** (WPCode) — cole na seção "Header".
3. Plugin oficial MK-CRM: baixe em **Configurações → Forms → Plugin WP** e ative.

### Elementor

1. **Site Settings → Custom Code → Add New**.
2. Location: **`<head>`** | Status: **Published**.
3. Cole os dois `<script>`.

### Wix

1. **Settings → Custom Code → Add Custom Code**.
2. Place code in: **Head** | Apply to: **All pages**.

### Webflow

1. **Project Settings → Custom Code → Head Code**.
2. Cole e publique.

### Shopify

1. **Online Store → Themes → Edit Code**.
2. Abra `theme.liquid` → cole antes do `</head>`.

### Google Tag Manager

1. **Tags → New → Custom HTML**.
2. Cole os `<script>` no campo HTML.
3. Trigger: **All Pages**.
4. **Publish** o container.

### Next.js (App Router)

Em `app/layout.tsx`:

```tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=SEU_PROJECT_ID"
          strategy="afterInteractive"
        />
        <Script
          src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/forms-snippet?token=SEU_TOKEN"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Next.js (Pages Router)

Em `pages/_document.tsx` use `<Script>` da mesma forma dentro de `<Head>`.

### React SPA (Vite/CRA)

Cole no `index.html` (raiz do projeto), antes de `</head>`. **Não** use `<script>` dentro de componente React (corre risco de duplicar a cada render).

### HTML puro

Veja [exemplos/html-puro.html](./exemplos/html-puro.html).

---

## Atributos `data-mk-*` (opcionais nos forms)

Você pode adicionar atributos no `<form>` ou nos `<input>` para refinar a captura:

| Atributo | Onde | O que faz | Exemplo |
|---|---|---|---|
| `data-mk-form="X"` | `<form>` | Define o `form_key` (senão o snippet infere) | `<form data-mk-form="phq9">` |
| `data-mk-name="X"` | `<form>` | Nome humano do form (aparece no painel) | `<form data-mk-name="Teste PHQ-9">` |
| `data-mk-ignore` | `<form>` | Snippet ignora este form | `<form data-mk-ignore>` |
| `data-mk-field="email"` | `<input>` | Força mapeamento do campo, mesmo com `name` esquisito | `<input name="x_42" data-mk-field="email">` |
| `data-mk-redirect="/obrigado"` | `<form>` | Redireciona após submit (opcional) | `<form data-mk-redirect="/obrigado">` |
| `data-mk-disable-observer` | `<form>` | Desabilita MutationObserver (debug) | — |

Valores aceitos para `data-mk-field`: `name`, `email`, `phone`, `message`.

---

## Como saber se está funcionando?

1. Abra o site, clique F12 (DevTools) → aba **Network** → filtre por `tracking-event` ou `forms-ingest`.
2. Navegue uma página → deve aparecer um POST `tracking-event` com status **200**.
3. No CRM, vá em **Configurações → Forms** → sua integração → contador de "Envios totais" sobe quando você manda form.

Se algo der errado: [09 — Troubleshooting](./09-troubleshooting.md).

---

## Próximo passo

➡ [03 — Tracking & eventos](./03-tracking-eventos.md)
