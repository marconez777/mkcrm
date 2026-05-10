## Visão geral

Construir um sistema de tracking de origem em 4 camadas:

1. **Pixel JS** (snippet para colar no site do Dr. Ivan) que envia pageviews/cliques para um endpoint do CRM.
2. **Botão WhatsApp com `?ref=`** que carrega a sessão de tracking até o WhatsApp.
3. **Casamento automático** sessão ↔ lead na primeira mensagem (extrai `ref` do texto enviado).
4. **Aba "Origem & Navegação"** no detalhe do lead com timeline + ferramenta de curadoria manual para a secretária.

---

## 1. Banco de dados (migration)

Novas tabelas (todas com `clinic_id` e RLS `clinic_scoped`):

- **`tracking_sites`** — um registro por site monitorado da clínica.
  - `id`, `name`, `domain`, `ingest_token` (default = `gen_random_bytes`), `created_at`.
  - Token público usado pelo pixel; sem ele, o site não pode mandar eventos.

- **`tracking_sessions`** — uma sessão por visitante anônimo.
  - `id` (uuid, gerado pelo pixel e salvo em `localStorage`), `site_id`, `ref` (o código do `?ref=` no link do WhatsApp), `utm_source/medium/campaign/term/content`, `first_url`, `first_referrer`, `landing_title`, `user_agent`, `device`, `country` (via header), `lead_id` (nullable, set quando casado), `claimed_at`, `created_at`.

- **`tracking_events`** — eventos da sessão.
  - `id`, `session_id`, `type` (`pageview`, `click`, `wa_click`, `form_submit`, `custom`), `url`, `title`, `referrer`, `payload jsonb`, `occurred_at`.
  - Índice por `session_id, occurred_at`.

Adições em `leads`:
- `origin_source text` (preenchido por agente OU secretária — ex.: `google_ads`, `meta_ads`, `organic`, `direct`, `referral`).
- `origin_confidence text` (`tracking` | `conversation` | `manual` | `null`).
- `tracking_session_id uuid` (link rápido para a sessão principal).

---

## 2. Edge functions (todas com CORS, sem JWT — chamadas pelo pixel público)

- **`tracking-ingest`** (público): recebe `POST { siteToken, sessionId, event }`. Cria a sessão se não existir; insere o evento. Rate-limit por IP+session.
- **`tracking-resolve-ref`**: dado um `ref`, retorna a sessão (usado pelo botão wa.me se quisermos enriquecer link).
- **`tracking-claim`**: chamada pelo `whatsapp-webhook` quando chega 1ª mensagem do lead. Extrai `ref=XXX` do texto (regex), procura sessão com aquele `ref` nas últimas 72h, faz `UPDATE leads SET tracking_session_id, origin_source, origin_confidence='tracking'` e `UPDATE tracking_sessions SET lead_id, claimed_at`.

Hook no `whatsapp-webhook` existente: após criar/atualizar lead, se `from_me=false` e for primeira mensagem, chama `tracking-claim` internamente.

---

## 3. Pixel JS (entregue como snippet)

Servido via edge function `tracking-pixel` (retorna JS) ou hospedado no próprio site dele:

```html
<script>
(function(){
  var SITE_TOKEN = 'xxxxx';
  var INGEST = 'https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-ingest';
  var sid = localStorage.getItem('mk_sid') || crypto.randomUUID();
  localStorage.setItem('mk_sid', sid);
  // captura UTMs da URL e salva na sessão
  // envia pageview
  // intercepta cliques em links wa.me e adiciona ?ref=<sid_curto>
})();
</script>
```

A parte chave: **todo link `wa.me` na página é reescrito** para incluir `?ref=ABC123` (8 chars do sessionId). O cliente cola esse texto no WhatsApp → chega na 1ª mensagem → `tracking-claim` casa.

Página nova **`/settings/tracking`** com:
- Lista de sites (CRUD).
- Snippet pronto para copiar.
- Instrução: "Coloque qualquer link `wa.me/55...` na página — o script adiciona o ref automaticamente."

---

## 4. Aba "Origem & Navegação" no detalhe do lead

Nova aba no painel do lead (Inbox), ao lado das existentes (Conversa, Campos, Notas, etc.):

- **Cabeçalho:** Origem detectada (badge: `Tráfego pago — Google` etc.) + nível de confiança + botão "Editar".
- **Sessão de captura:** primeira página, referrer, UTMs, dispositivo, data.
- **Timeline:** lista cronológica de pageviews e eventos com URL, título, tempo na página, ícone por tipo.
- **Curadoria:** botão "Linkar outra sessão" (busca por `ref` ou últimas sessões não casadas da clínica) para a secretária corrigir manualmente. Marca `origin_confidence='manual'`.
- **Em branco:** se sem dados, mostra estado vazio com instrução para a secretária preencher origem manualmente.

---

## 5. Comportamento do agente classificador

Atualizar `system_prompt` do agente classificador da clínica ÓR:

- Regra adicionada: **só preencher o campo `origem`** quando:
  - O contexto do lead tiver `tracking_session_id` (já casado) — usar `origin_source` da sessão.
  - OU o próprio cliente disser claramente na conversa ("vi seu Instagram", "cliquei no Google", "indicação da Maria").
- Caso contrário, **deixar em branco** para a secretária preencher.

Injeção em `ai-chat/index.ts`: incluir no `leadCtx` a sessão de tracking (se houver) com origem + páginas visitadas, para o agente ter contexto sem precisar inferir.

---

## Detalhes técnicos

- **Privacidade:** IP só guardado como hash (sha256). User-agent armazenado bruto (necessário para device).
- **Retenção:** sessões sem `lead_id` mais antigas que 30 dias podem ser purgadas em job de cleanup.
- **`ref` curto:** primeiros 8 chars do uuid da sessão são suficientes (colisão desprezível em janela de 72h por clínica).
- **Reescrita de wa.me:** o pixel intercepta cliques e dispara também um evento `wa_click` antes de redirecionar — assim sabemos qual CTA gerou o lead.
- **Sem JWT** nas funções de ingest (pixel é público); segurança via `siteToken` + rate-limit.

---

## Entregáveis desta primeira leva

1. Migration com as 3 tabelas + colunas em `leads`.
2. Edge functions: `tracking-ingest`, `tracking-claim`.
3. Hook em `whatsapp-webhook` para chamar `tracking-claim`.
4. Página `/settings/tracking` com CRUD de sites e snippet.
5. Aba "Origem & Navegação" no painel do lead com timeline + curadoria manual.
6. Atualização do prompt do classificador + injeção de contexto de tracking em `ai-chat`.

Não inclui (próximas levas): integração com GA4/Meta CAPI, dashboard agregado de origem, atribuição multi-touch, exportação.
