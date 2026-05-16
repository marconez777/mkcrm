import type { EmailBlock, ParagraphBlock, HeadingBlock, ImageBlock, CtaBlock, DividerBlock, SpacerBlock, RawBlock } from "./types";
import { newBlock } from "./types";

/**
 * Importa HTML legado para blocos do editor.
 * - Tolera HTML completo (com <html>/<body>) ou fragmentos.
 * - Atravessa tabelas (padrão de email): desce em <tr>/<td> recursivamente.
 * - Heurísticas para detectar CTAs (links estilizados como botão).
 * - Detecta espaçadores (<td height=N>&nbsp;</td>).
 * - Mantém estilos inline em parágrafos (sanitização ocorre no render).
 * - Fallback: bloco "raw" preservando o HTML original.
 */
export function htmlToBlocks(html: string): EmailBlock[] {
  if (typeof window === "undefined" || !html || !html.trim()) return [];

  // Parse robusto: aceita tanto fragmentos quanto documentos completos
  const wrapped = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`;
  const doc = new DOMParser().parseFromString(wrapped, "text/html");
  const root = doc.body;
  if (!root) return [];

  const blocks: EmailBlock[] = [];
  walk(root, blocks);

  // Mescla parágrafos vazios consecutivos e remove blocos vazios
  return cleanup(blocks);
}

function walk(node: Element, out: EmailBlock[]) {
  for (const child of Array.from(node.children)) {
    handleNode(child, out);
  }
}

function handleNode(el: Element, out: EmailBlock[]) {
  const tag = el.tagName.toLowerCase();

  // Containers: descer
  if (tag === "table" || tag === "tbody" || tag === "thead" || tag === "tfoot" || tag === "tr" ||
      tag === "center" || tag === "main" || tag === "section" || tag === "article") {
    walk(el, out);
    return;
  }

  // <td>: pode ser espaçador, conter texto direto, ou conter mais elementos
  if (tag === "td" || tag === "th") {
    const heightAttr = el.getAttribute("height");
    const styleHeight = parseInt((el.getAttribute("style") || "").match(/height:\s*(\d+)px/i)?.[1] || "0", 10);
    const h = heightAttr ? parseInt(heightAttr, 10) : styleHeight;
    const onlyWs = !el.textContent || el.textContent.replace(/\u00a0/g, " ").trim() === "";
    if (h > 0 && onlyWs && el.children.length === 0) {
      const sp = newBlock("spacer") as SpacerBlock;
      sp.height = h;
      out.push(sp);
      return;
    }
    // td com filhos: desce
    if (el.children.length > 0) {
      walk(el, out);
      // Se tem TAMBÉM texto solto, captura como parágrafo
      const directText = directTextContent(el);
      if (directText.trim()) pushParagraph(out, escapeHtml(directText));
      return;
    }
    // td só com texto
    const t = (el.textContent || "").trim();
    if (t) pushParagraph(out, escapeHtml(t));
    return;
  }

  // <div>: trata como container, mas se for "folha" com só texto → parágrafo
  if (tag === "div") {
    if (hasBlockChildren(el)) {
      walk(el, out);
    } else {
      const inner = el.innerHTML.trim();
      if (inner) pushParagraph(out, inner, alignFromStyle(el));
    }
    return;
  }

  // Headings
  if (/^h[1-6]$/.test(tag)) {
    const h = newBlock("heading") as HeadingBlock;
    h.text = (el.textContent || "").trim();
    const lvl = Math.min(3, Math.max(1, Number(tag[1]))) as 1 | 2 | 3;
    h.level = lvl;
    h.align = (alignFromStyle(el) || "left") as HeadingBlock["align"];
    const color = colorFromStyle(el);
    if (color) h.color = color;
    if (h.text) out.push(h);
    return;
  }

  // Parágrafo
  if (tag === "p") {
    const inner = el.innerHTML.trim();
    if (!inner) return;
    pushParagraph(out, inner, alignFromStyle(el), colorFromStyle(el));
    return;
  }

  // Imagem
  if (tag === "img") {
    pushImage(el as HTMLImageElement, out);
    return;
  }

  // Link: pode ser CTA (estilizado como botão) ou link contendo imagem
  if (tag === "a") {
    const onlyImg = el.children.length === 1 && el.children[0].tagName.toLowerCase() === "img";
    if (onlyImg) {
      const img = pushImage(el.children[0] as HTMLImageElement, out);
      if (img) img.href = el.getAttribute("href") || "";
      return;
    }
    if (looksLikeButton(el)) {
      const cta = newBlock("cta") as CtaBlock;
      cta.text = (el.textContent || "Clique aqui").trim();
      cta.href = el.getAttribute("href") || "#";
      const style = el.getAttribute("style") || "";
      const bg = style.match(/background(?:-color)?:\s*([^;]+)/i)?.[1]?.trim();
      const col = style.match(/(?:^|;)\s*color:\s*([^;]+)/i)?.[1]?.trim();
      if (bg) cta.bg = bg;
      if (col) cta.color = col;
      cta.align = (alignFromStyle(el.parentElement) || "center") as CtaBlock["align"];
      out.push(cta);
      return;
    }
    // Link normal vira parágrafo com link
    pushParagraph(out, el.outerHTML);
    return;
  }

  // Divisor
  if (tag === "hr") {
    const d = newBlock("divider") as DividerBlock;
    const style = el.getAttribute("style") || "";
    const c = style.match(/border-(?:top-)?color:\s*([^;]+)/i)?.[1]?.trim()
           ?? style.match(/border(?:-top)?:\s*\d+px\s+\w+\s+([#\w()]+)/i)?.[1]?.trim();
    if (c) d.color = c;
    out.push(d);
    return;
  }

  // <br>: vira espaço pequeno se solto
  if (tag === "br") {
    return; // ignorar — só faz sentido inline
  }

  // Listas
  if (tag === "ul" || tag === "ol") {
    pushParagraph(out, el.outerHTML);
    return;
  }

  // Blockquote
  if (tag === "blockquote") {
    pushParagraph(out, `<em>${el.innerHTML}</em>`);
    return;
  }

  // Span/strong/em soltos → parágrafo
  if (tag === "span" || tag === "strong" || tag === "em" || tag === "b" || tag === "i") {
    const t = el.innerHTML.trim();
    if (t) pushParagraph(out, t);
    return;
  }

  // Desconhecido: fallback "raw" preservando markup
  const raw = newBlock("raw") as RawBlock;
  raw.html = el.outerHTML;
  out.push(raw);
}

function pushImage(el: HTMLImageElement, out: EmailBlock[]): ImageBlock | null {
  const src = el.getAttribute("src") || "";
  if (!src) return null;
  const img = newBlock("image") as ImageBlock;
  img.src = src;
  img.alt = el.getAttribute("alt") || "";
  const w = parseInt(el.getAttribute("width") || "0", 10);
  if (w > 0) img.width = Math.min(w, 600);
  img.align = (alignFromStyle(el.parentElement) || "center") as ImageBlock["align"];
  out.push(img);
  return img;
}

function pushParagraph(out: EmailBlock[], innerHtml: string, align?: string | null, color?: string | null) {
  const p = newBlock("paragraph") as ParagraphBlock;
  // garante que o conteúdo esteja envolvido em <p> ou similar
  const trimmed = innerHtml.trim();
  if (!trimmed) return;
  p.html = /^<(p|ul|ol|blockquote|div|h\d)/i.test(trimmed) ? trimmed : `<p>${trimmed}</p>`;
  if (align === "left" || align === "center" || align === "right") p.align = align;
  if (color) p.color = color;
  out.push(p);
}

function looksLikeButton(el: Element): boolean {
  const style = (el.getAttribute("style") || "").toLowerCase();
  if (/background(?:-color)?:/.test(style) && /padding/.test(style)) return true;
  if (/display\s*:\s*inline-block/.test(style) && /padding/.test(style)) return true;
  if (/border-radius:/.test(style) && /padding/.test(style)) return true;
  const cls = el.getAttribute("class") || "";
  if (/\b(btn|button|cta)\b/i.test(cls)) return true;
  return false;
}

function alignFromStyle(el: Element | null): string | null {
  if (!el) return null;
  const a = el.getAttribute?.("align");
  if (a) return a.toLowerCase();
  const style = el.getAttribute?.("style") || "";
  const m = style.match(/text-align:\s*([^;]+)/i);
  return m ? m[1].trim().toLowerCase() : null;
}

function colorFromStyle(el: Element): string | null {
  const style = el.getAttribute("style") || "";
  const m = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
  return m ? m[1].trim() : null;
}

function directTextContent(el: Element): string {
  let s = "";
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) s += n.textContent ?? "";
  }
  return s;
}

function hasBlockChildren(el: Element): boolean {
  for (const c of Array.from(el.children)) {
    const t = c.tagName.toLowerCase();
    if (/^(div|table|tr|td|p|h[1-6]|hr|img|a|ul|ol|blockquote|section|article|center|main)$/.test(t)) return true;
  }
  return false;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cleanup(blocks: EmailBlock[]): EmailBlock[] {
  // Remove parágrafos completamente vazios
  return blocks.filter((b) => {
    if (b.type === "paragraph") {
      const txt = b.html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      return txt.length > 0;
    }
    if (b.type === "heading") return (b.text || "").trim().length > 0;
    return true;
  });
}
