# Fix — WhatsApp redirect `unknown_project` + tracking não grava

## Causa raiz

O site instalou o pixel passando `?project_id=cf038458-457d-4c1a-9ac4-c88c3c8353a1` (o **UUID** da clínica). As edge functions, porém, fazem o lookup por **slug** (`or`):

```ts
.from("clinics").select(...).eq("slug", projectId)
```

Quando o site clica no WhatsApp, o pixel chama `wa-redirect?p=<UUID>`, a query não acha clínica nenhuma e a função devolve **`unknown_project`** (a tela preta do print).

Mesmo problema afeta:
- `tracking-event` (POST do pixel a cada page_view/click) → eventos descartados silenciosamente, por isso o banco está zerado mesmo com pixel instalado
- `tracking-identify`
- `tracking-config` (não trava porque devolve defaults, mas sem achar clínica)

`forms-ingest` funciona porque ele usa **token** (mkf_…), não project_id.

## Fix — aceitar UUID OU slug nas 5 functions

Trocar:
```ts
.eq("slug", projectId)
```
por:
```ts
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
.or(isUuid ? `id.eq.${projectId},slug.eq.${projectId}` : `slug.eq.${projectId}`)
```

Arquivos:
- `supabase/functions/wa-redirect/index.ts` (linha 57) — destrava o WhatsApp
- `supabase/functions/tracking-event/index.ts` (linha 210) — destrava ingest de eventos
- `supabase/functions/tracking-identify/index.ts` (linha 101)
- `supabase/functions/tracking-config/index.ts` (linha 34)
- `supabase/functions/tracking-pixel/index.ts` — atualizar comentário/doc só (não muda lookup)

Sem migration. Sem mudança de schema. Só edge functions.

## Validação pós-deploy

1. `curl -I ".../wa-redirect?p=cf038458-...&to=5511999999999"` → deve retornar 302 com `Location: https://wa.me/...?text=...mk_src=...` (não mais `unknown_project`)
2. Usuário clica no botão WhatsApp do site → abre o WhatsApp normalmente
3. `SELECT * FROM tracking_events WHERE clinic_id='cf038458-...' AND created_at > now() - interval '5 min'` → deve aparecer `session_start` + `page_view` no próximo refresh do site
4. `SELECT * FROM whatsapp_intents WHERE clinic_id='cf038458-...' ORDER BY created_at DESC LIMIT 3` → deve registrar o clique

## Alternativa que NÃO vou seguir

Pedir pro site trocar `project_id=<UUID>` por `project_id=or` (slug). Funcionaria, mas:
- O site já está em produção com UUID e o `tracking-config` deu OK pra eles
- Outras clínicas no futuro podem cair no mesmo problema
- Aceitar os dois formatos é mais robusto e backward-compatible
