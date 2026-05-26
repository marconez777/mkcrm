# Fase 1 revisada — destravar integração ÓR com mudanças mínimas

## Contexto novo (do diagnóstico do site)

O site Or **já é cooperativo**:
- Forms têm `data-mk-form`, `data-mk-name`, `name=` (snippet captura ok)
- Site emite `CustomEvent` no `window`: `mk:lead:created`, `mk:test:started`, `mk:test:completed`
- Score final do PHQ-9/GAD-7 sai por `supabase.functions.invoke('submit-test-result')` (não é form submit), mas o site dispara `mk:test:completed` no mesmo momento — basta o CRM escutar
- Botões WhatsApp são `<a href="wa.me/...">` normais

O CRM **já tem** quase tudo construído:
- `tracking-pixel` (374 linhas): seta `_mk_vid` cookie + `_mk_sid` session, captura page_view incluindo SPA (`pushState`/`replaceState`/`popstate`), captura `whatsapp_click` automaticamente via click listener (linhas 200-291), faz `session_start`, captura UTM
- `tracking-event`: recebe e persiste
- `tracking-identify`: liga `visitor_id` a `lead_id`

**O único gap real**: o `tracking-pixel` não escuta os CustomEvents `mk:*` que o site já emite. Sem isso, `mk:test:completed` (que contém o score do PHQ-9) cai no vazio.

## Mudanças (3 itens pequenos)

### 1. CRM — adicionar listener de CustomEvents `mk:*` no `tracking-pixel`

Em `supabase/functions/tracking-pixel/index.ts`, perto do `start()` final, adicionar ~12 linhas:

```js
// Bridge: site-emitted CustomEvents → tracking-event
var MK_EVENTS = ["mk:lead:created","mk:test:started","mk:test:completed","mk:wa:click"];
MK_EVENTS.forEach(function(name){
  window.addEventListener(name, function(ev){
    var detail = (ev && ev.detail) || {};
    // mk:test:completed → "test_completed", mk:lead:created → "lead_created", etc.
    var eventName = name.replace(/^mk:/,"").replace(/:/g,"_");
    track(eventName, detail);
  }, false);
});
```

Isso reaproveita a função `track()` existente, que já injeta `visitor_id`, `session_id`, `url`, etc. O backend `tracking-event` já aceita `event_type:'custom'` (já é o default para nomes desconhecidos — ver `index.ts:151`).

**Deploy:** automático ao salvar (o pixel é gerado dinamicamente, próxima request do site já pega).

### 2. Site — instalar `tracking-pixel` no `<head>`

Ação no **projeto do site (mindscape-revive)**, não no CRM. Documentar no `12-roadmap-correcao.md` o snippet exato que o time do site precisa colar antes do `forms-snippet`:

```html
<script async src="https://hrbhmqckzjxjbhpzpqeo.supabase.co/functions/v1/tracking-pixel?project_id=cf038458-457d-4c1a-9ac4-c88c3c8353a1"></script>
```

> `project_id` aqui = `clinic_id` da ÓR. Confirmar via `tracking-config?project_id=...` que retorna config válida antes de pedir o deploy.

Resultado esperado:
- Todo visitante ganha `_mk_vid` persistente (cookie 365d)
- Page_views (incl. SPA) chegam em `tracking_events`
- UTMs chegam em `tracking_visitors`
- Clicks em `wa.me` viram `whatsapp_click` automaticamente
- Próximo form submit traz `visitor_id` populado → `forms-ingest` faz `link_source='form_submission'` em `tracking_identity_links` → resolve P0.1

### 3. CRM — migration de telefone para E.164

Inalterado do plano anterior:
- `forms-ingest/index.ts:54-60`: prefixar `+` ao normalizar
- Migration retroativa: `UPDATE leads SET phone = '+' || phone WHERE phone ~ '^[0-9]+$' AND length(phone) >= 12` (afeta ~1479 leads da ÓR + outras clínicas)

## Não fazer agora

- ❌ Criar endpoint `track-event` novo (o existente `tracking-event` cobre)
- ❌ Interceptar `fetch` no `forms-snippet` para pegar `submit-test-result` (o site já dispara `mk:test:completed` no mesmo instante — listener é mais limpo)
- ❌ Mexer em `forms-snippet` (continua igual; só forms HTML nativos)
- ❌ Field map UI / retry queue / external_lead_id (Fase 3/4)

## Pré-requisitos manuais (você)

Ordem obrigatória:
1. Em `/settings/forms` → "Site Or" → trocar `allowed_domains` para `clinicaohrpsiquiatria.com, mindscape-revive.lovable.app` (sem `https://`, sem `/`)
2. Após o deploy da mudança #1 acima, **avisar o time do site para colar o `<script>` da mudança #2**
3. Validar com 1 submit de teste no PHQ-9 → conferir em `form_submissions` (`status=ok`, `lead_id` preenchido) e em `lead_events` (deve aparecer `test_completed` com o score)

## Entregáveis

- `supabase/functions/tracking-pixel/index.ts`: +12 linhas (listener `mk:*`)
- `supabase/functions/forms-ingest/index.ts`: normalizador de telefone com `+`
- Migration retroativa de telefone
- `docs/integracao/12-roadmap-correcao.md`: substituir Fase 1.1/1.2 (fetch intercept + WA listener) pela nova abordagem "listener de CustomEvents `mk:*`"; adicionar seção "Snippet do tracking-pixel para o site" com o `<script>` exato
- `docs/integracao/13-baseline-fase0.md`: nota no final sobre a mudança de estratégia

## Riscos / atenção

- **Migration de telefone**: rodar em janela de baixo tráfego. Triggers de WhatsApp inbound (`evolution-webhook` etc.) precisam aceitar tanto `+5511…` quanto `5511…` no lookup durante a transição — verificar antes.
- **CustomEvent timing**: se o site disparar `mk:test:completed` antes do `tracking-pixel` carregar (async), evento é perdido. Mitigação: site usa pattern `(window.mkQueue=window.mkQueue||[]).push(['event','test_completed',data])` que o pixel drena no boot. **Opcional** nesta fase — se ficarem perdendo eventos, adicionar fila depois.
- **CORS**: `tracking-event` já tem `Access-Control-Allow-Origin: <origin>` dinâmico, então funciona de qualquer domínio.

## Detalhes técnicos

- Mapeamento de nomes: `mk:test:completed` → `test_completed` (replace `:` por `_`, strip `mk:`)
- `tracking-event` salva em `tracking_events` com `event_type='custom'` e `event_name='test_completed'`; o payload (`detail`) vai pra coluna `properties` JSONB
- Para fazer aparecer em `lead_events` (timeline do lead), precisa ter `visitor_id` resolvido — daí a importância do pixel estar no site **antes** do submit
