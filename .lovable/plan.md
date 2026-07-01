# Preview de vídeo (YT Shorts / Instagram Reels) — Disparo em massa + Inbox

## O que a pesquisa mostrou

Vasculhei os repos do **Evolution API** e **Baileys** e discussões relacionadas:

- Evolution v2 expõe apenas `options.linkPreview: boolean` no `/message/sendText`. Tem **bug crônico e reaberto** (issues #1859, #2101, #2262): mesmo com `true`, preview simplesmente não aparece em muitos casos — depende da versão do Evolution, do estado do Baileys e do OG do site.
- Baileys internamente aceita um **objeto rico** `{title, description, canonical-url, matched-text, jpegThumbnail}` (arquivo `Utils/link-preview.ts`), mas a API REST do Evolution **não expõe** esses campos — então não dá pra "empurrar" um preview custom via sendText.
- **YouTube**: OG é público → `linkPreview:true` funciona _às vezes_. Thumbnail direto via `https://img.youtube.com/vi/<id>/hqdefault.jpg` (ou `maxresdefault.jpg`) é 100% confiável sem auth. Cobre Shorts também (`youtube.com/shorts/<id>`, `youtu.be/<id>`).
- **Instagram**: bloqueia scraping do OG para bots (retorna login wall). oEmbed oficial exige App Token do Graph. Devs no ecossistema Baileys (repos tipo `neoxr/wb`, `Zapstream-bot`, threads no fórum Evolution) convergem para **um mesmo workaround**: buscar a thumbnail (via oEmbed com token OU baixar o próprio vídeo/thumb de um serviço público) e **enviar como imagem com caption contendo o link** — visualmente vira um card grande com play, muito melhor que o preview minúsculo do WhatsApp.

**Conclusão sobre acertividade**: `linkPreview:true` sozinho é frágil. O modo "card de vídeo" (`sendMedia` image + caption com link) é o único caminho consistente para Reels e Shorts. Vamos usar os dois em cascata:

```
video_card (sendMedia img + caption) ─┐
   fallback ↓ (thumb não encontrada)  │
link_preview (sendText + linkPreview) │  ← default automático inteligente
   fallback ↓ (Evolution não gerou)   │
text_only  (envio cru, comportamento antigo)
```

## Escopo (agora cobrindo Inbox também)

### 1. Helper compartilhado — `supabase/functions/_shared/link-preview.ts` (novo)
- `detectVideoLink(text)` → `{ kind, url, videoId? }` reconhecendo:
  - `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`
  - `instagram.com/(reel|reels|p|tv)/…`
  - domínios genéricos com `og:image` (opcional, para "auto")
- `resolveThumbnail(link, { instagramToken? })`:
  - YouTube/Shorts: monta URL `img.youtube.com/vi/<id>/maxresdefault.jpg` (HEAD; se 404 → `hqdefault.jpg`).
  - Instagram:
    1. Se `INSTAGRAM_OEMBED_TOKEN` disponível → `graph.facebook.com/v18.0/instagram_oembed?url=…&access_token=…`.
    2. Senão → fetch do HTML da URL com `User-Agent` de browser (Chrome desktop) e regex de `<meta property="og:image">` (muitas vezes falha, mas é grátis).
    3. Falhou → `null`.
  - Cache 24h em memória (`Map<url, {thumb, exp}>`).
- `resolveTitle(link)`: idem (oEmbed do YouTube: `https://www.youtube.com/oembed?url=…&format=json` — não requer auth; oEmbed do Insta via token).
- `buildSendPayloads({ instance, phone, text, mode, quotedId })` → array de `{ endpoint, body, waFor:number }` (para permitir o "card + follow-up de texto" quando o texto tem mais do que só o link).

### 2. Backend — envios

**`supabase/functions/broadcast-tick/index.ts`**
- Onde hoje faz `sendText`, chamar `buildSendPayloads(...)` respeitando `part.preview_mode`.
- Manter drip de 1s entre payloads dentro da mesma parte (quando modo `video_card` gerar 2: imagem+link e depois texto adicional, se houver).

**`supabase/functions/evolution-send/index.ts` (Inbox)**
- Aceitar novos parâmetros opcionais no body: `preview_mode?: 'auto'|'text_only'|'link_preview'|'video_card'` (default `auto`).
- Mesma refatoração via `buildSendPayloads`.
- Idempotência (`client_message_id`) permanece; se gerar 2 payloads, o segundo usa `client_message_id + ':2'`.
- `messages.message_type` = `image` quando `video_card` for usado, com o link salvo em `content` para preservar timeline.

### 3. Schema

Migração:
```sql
ALTER TABLE broadcast_message_parts
  ADD COLUMN preview_mode text NOT NULL DEFAULT 'auto'
  CHECK (preview_mode IN ('auto','text_only','link_preview','video_card'));
```
Sem coluna extra em `messages` (o modo é comportamento de envio, não persistente).

### 4. Frontend

**`src/pages/Broadcasts.tsx` — aba Mensagens**
- Em cada parte: `<Select>` "Preview do link" com 4 opções + tooltip explicando cada uma.
- Mini preview visual quando o texto contém link YT/Insta (usando `img.youtube.com/...` no client — instantâneo, sem edge).
- Aviso amarelo quando escolher `video_card` e a thumbnail não puder ser resolvida no client (Insta): "Preview será tentado no envio; se falhar cai para link simples."

**`src/components/inbox/Composer.tsx`**
- Quando detectar URL de YT/Insta ao digitar, mostrar chip embaixo do input: **[✓ Enviar como card de vídeo]** (toggle rápido). Default ON para Shorts/Reels, OFF para links genéricos.
- Se OFF → payload manda `preview_mode:'text_only'` (comportamento atual). Se ON → `video_card`.

### 5. Secrets (opcional, mas melhora Insta)

Se o usuário aceitar, adicionar `INSTAGRAM_OEMBED_TOKEN` (App Token do Facebook Graph) via `add_secret`. Sem ele, funciona só para posts públicos cujo OG vaza no HTML.

### 6. Docs

- `docs/maps/BROADCASTS.md`: §2 (novo campo `preview_mode`), §5 (invariante: fallback cascata é obrigatório), §7 (novo secret opcional).
- `docs/maps/EVOLUTION_EDGES.md`: nota sobre `_shared/link-preview.ts` e comportamento do `evolution-send` refatorado.

## Fases de execução

1. `_shared/link-preview.ts` + migração `preview_mode`.
2. Refatorar `broadcast-tick` e `evolution-send` para usar o helper (com fallback cascata).
3. UI: select em Broadcasts + toggle no Composer.
4. (Opcional) Secret `INSTAGRAM_OEMBED_TOKEN`.
5. Docs.

## Resumo — vale a pena?

Sim. `linkPreview:true` sozinho é loteria (bug histórico). O modo `video_card` via `sendMedia` é o que os devs no ecossistema Baileys/Evolution estão de fato usando e resolve Reels/Shorts com preview grande e clicável. Vou implementar os dois em cascata para maximizar acertividade sem penalizar quem só quer texto puro.

Confirma que sigo assim?