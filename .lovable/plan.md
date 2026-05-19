# Filtrar visitas do robô do Lovable (e demais bots) do tracking

## Confirmado pelo usuário
1. ✅ Limpeza retroativa dos dados já contaminados
2. ✅ Filtrar **todos os bots conhecidos** (não só Lovable)

## Mudanças

### 1. `supabase/functions/tracking-event/index.ts`
Adicionar helper de detecção de bot e descartar o evento antes de qualquer escrita.

```ts
const BOT_UA_RE = /lovable|lovablebot|headlesschrome|prerender|phantomjs|puppeteer|playwright|bot\b|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|semrush|ahrefs|mj12bot|dotbot|pingdom|uptimerobot|gtmetrix|lighthouse|chrome-lighthouse|petalbot|seznambot|sogou|exabot|ia_archiver|archive\.org/i;

function isBotUA(ua: string): boolean {
  if (!ua) return true;          // UA vazio = bot
  return BOT_UA_RE.test(ua);
}
```

No loop `for (const ev of events)`, logo após o cálculo de `ua` (linha ~244):
```ts
if (isBotUA(ua) || ev.is_webdriver === true) continue;
```

Resposta segue 200 normal (não gera erro nos logs do bot).

### 2. `supabase/functions/tracking-pixel/index.ts` (tracker.js)
Adicionar guarda no início do IIFE, antes do `start()`:
```js
var UA=navigator.userAgent||"";
if(/lovable|lovablebot|headlesschrome|prerender|phantomjs|puppeteer|playwright|bot\b|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|semrush|ahrefs/i.test(UA))return;
if(navigator.webdriver===true)return;
```
Também enviar `is_webdriver: navigator.webdriver===true` no `baseEvent` como segunda linha de defesa.

### 3. Deploy
Deploy de `tracking-event` e `tracking-pixel`.

### 4. Limpeza retroativa (migration)
Apaga dados já gravados de bots, em cascata correta (filhos antes de pais):

```sql
-- 1) Eventos com UA de bot OU sem UA
DELETE FROM public.tracking_events
WHERE user_agent IS NULL
   OR user_agent ~* '(lovable|headlesschrome|prerender|phantomjs|puppeteer|playwright|bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|semrush|ahrefs|mj12bot|dotbot|pingdom|uptimerobot|gtmetrix|lighthouse|petalbot|seznambot|sogou|exabot|ia_archiver|archive\.org)';

-- 2) Sessões idem
DELETE FROM public.tracking_sessions
WHERE user_agent IS NULL
   OR user_agent ~* '(lovable|headlesschrome|prerender|phantomjs|puppeteer|playwright|bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|twitterbot|linkedinbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|applebot|semrush|ahrefs|mj12bot|dotbot|pingdom|uptimerobot|gtmetrix|lighthouse|petalbot|seznambot|sogou|exabot|ia_archiver|archive\.org)';

-- 3) Visitantes sem sessões nem eventos remanescentes
DELETE FROM public.tracking_visitors v
WHERE NOT EXISTS (SELECT 1 FROM public.tracking_sessions s WHERE s.visitor_id = v.visitor_id AND s.clinic_id = v.clinic_id)
  AND NOT EXISTS (SELECT 1 FROM public.tracking_events  e WHERE e.visitor_id = v.visitor_id AND e.clinic_id = v.clinic_id);
```

Obs: vou ajustar os nomes exatos de colunas (`user_agent`, `visitor_id`, `clinic_id`) conforme o schema real ao executar a migration.

## Resultado esperado
- Robôs (Lovable prerender, Googlebot, WhatsApp preview, etc.) deixam de aparecer em Visitantes / Eventos / Páginas.
- Dados antigos contaminados são removidos.
- Site humano continua rastreado normalmente.

**Aprove o plano para eu implementar (precisa do modo build).**
