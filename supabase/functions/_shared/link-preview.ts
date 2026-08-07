// Detecção de links de vídeo + resolução de thumbnail + construção de payload
// para envio via Evolution API com fallback em cascata:
//   video_card  → /message/sendMedia (image + caption com link)
//   link_preview → /message/sendText com options.linkPreview:true
//   text_only    → /message/sendText puro (comportamento antigo)
//
// Ver docs/maps/BROADCASTS.md §"Preview de link".

export type PreviewMode = "auto" | "text_only" | "link_preview" | "video_card";
export type LinkKind = "youtube" | "shorts" | "instagram" | "generic";

const YT_RE =
  /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/|embed\/|v\/)([\w-]{6,})|youtu\.be\/([\w-]{6,}))([^\s]*)?/i;
const IG_RE =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/([\w-]{5,})/i;
const GENERIC_URL_RE = /https?:\/\/[^\s]+/i;

export type DetectedLink = {
  kind: LinkKind;
  url: string;
  videoId?: string;
  isShorts?: boolean;
};

/** Detecta o primeiro link "com potencial de preview" no texto. */
export function detectVideoLink(text: string | null | undefined): DetectedLink | null {
  if (!text) return null;
  const yt = text.match(YT_RE);
  if (yt) {
    const id = yt[1] ?? yt[2];
    const isShorts = /\/shorts\//i.test(yt[0]);
    return {
      kind: isShorts ? "shorts" : "youtube",
      url: yt[0],
      videoId: id,
      isShorts,
    };
  }
  const ig = text.match(IG_RE);
  if (ig) return { kind: "instagram", url: ig[0], videoId: ig[1] };
  const g = text.match(GENERIC_URL_RE);
  if (g) return { kind: "generic", url: g[0] };
  return null;
}

// Cache in-memory por 24h (thumbnails são estáveis)
const THUMB_CACHE = new Map<string, { thumb: string | null; exp: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;
function cacheGet(url: string): string | null | undefined {
  const c = THUMB_CACHE.get(url);
  if (!c) return undefined;
  if (c.exp < Date.now()) {
    THUMB_CACHE.delete(url);
    return undefined;
  }
  return c.thumb;
}
function cacheSet(url: string, thumb: string | null) {
  THUMB_CACHE.set(url, { thumb, exp: Date.now() + TTL_MS });
}

async function headOk(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(to);
    return r.ok;
  } catch {
    return false;
  }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8",
      },
    });
    clearTimeout(to);
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 200_000);
    const m =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Retorna URL de thumbnail apropriada ou null se não conseguir resolver. */
export async function resolveThumbnail(link: DetectedLink): Promise<string | null> {
  const hit = cacheGet(link.url);
  if (hit !== undefined) return hit;

  let thumb: string | null = null;

  if ((link.kind === "youtube" || link.kind === "shorts") && link.videoId) {
    const max = `https://i.ytimg.com/vi/${link.videoId}/maxresdefault.jpg`;
    const hq = `https://i.ytimg.com/vi/${link.videoId}/hqdefault.jpg`;
    thumb = (await headOk(max)) ? max : (await headOk(hq)) ? hq : null;
  } else if (link.kind === "instagram") {
    const token = Deno.env.get("INSTAGRAM_OEMBED_TOKEN");
    if (token) {
      try {
        const r = await fetch(
          `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(
            link.url,
          )}&fields=thumbnail_url,title&access_token=${encodeURIComponent(token)}`,
        );
        if (r.ok) {
          const j = await r.json().catch(() => null);
          thumb = j?.thumbnail_url ?? null;
        }
      } catch { /* ignore */ }
    }
    if (!thumb) thumb = await fetchOgImage(link.url);
  } else if (link.kind === "generic") {
    thumb = await fetchOgImage(link.url);
  }

  cacheSet(link.url, thumb);
  return thumb;
}

export type EvoPayload = {
  endpoint: string; // path relativo, ex: /message/sendText/<inst>
  body: Record<string, unknown>;
};

/** Constrói o(s) payload(s) para envio baseado no modo escolhido, com fallback. */
export async function buildSendPayloads(opts: {
  instanceName: string;
  phone: string;
  text: string;
  mode: PreviewMode;
  quotedId?: string | null;
}): Promise<EvoPayload[]> {
  const { instanceName, phone, text, quotedId } = opts;
  const inst = encodeURIComponent(instanceName);

  const link = detectVideoLink(text);
  let effective: PreviewMode = opts.mode;
  if (effective === "auto") {
    if (link?.kind === "shorts" || link?.kind === "instagram") effective = "video_card";
    else if (link) effective = "link_preview";
    else effective = "text_only";
  }

  const quoted = quotedId ? { key: { id: quotedId } } : undefined;

  const textPayload = (linkPreview: boolean): EvoPayload => ({
    endpoint: `/message/sendText/${inst}`,
    body: {
      number: phone,
      text,
      ...(linkPreview ? { options: { linkPreview: true } } : {}),
      ...(quoted ? { quoted } : {}),
    },
  });

  if (effective === "text_only" || !link) return [textPayload(false)];
  if (effective === "link_preview") return [textPayload(true)];

  // video_card: tenta resolver thumb; se falhar, cai para link_preview
  const thumb = await resolveThumbnail(link);
  if (!thumb) return [textPayload(true)];

  const mediaPayload: EvoPayload = {
    endpoint: `/message/sendMedia/${inst}`,
    body: {
      number: phone,
      mediatype: "image",
      mimetype: "image/jpeg",
      media: thumb,
      fileName: "preview.jpg",
      caption: text, // caption contém o link + texto original — clicável no WhatsApp
      ...(quoted ? { quoted } : {}),
    },
  };
  return [mediaPayload];
}
