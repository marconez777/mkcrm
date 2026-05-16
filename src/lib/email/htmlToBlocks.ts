import type { EmailBlock } from "./types";
import { newBlock } from "./types";

export function htmlToBlocks(html: string): EmailBlock[] {
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const blocks: EmailBlock[] = [];

  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) {
      const h = newBlock("heading") as Extract<EmailBlock, { type: "heading" }>;
      h.text = node.textContent || "";
      h.level = Number(tag[1]) as 1 | 2 | 3;
      blocks.push(h);
    } else if (tag === "p") {
      const p = newBlock("paragraph") as Extract<EmailBlock, { type: "paragraph" }>;
      p.html = node.innerHTML;
      blocks.push(p);
    } else if (tag === "img") {
      const img = newBlock("image") as Extract<EmailBlock, { type: "image" }>;
      img.src = (node as HTMLImageElement).getAttribute("src") || "";
      img.alt = (node as HTMLImageElement).getAttribute("alt") || "";
      blocks.push(img);
    } else if (tag === "hr") {
      blocks.push(newBlock("divider"));
    } else if (tag === "a") {
      const cta = newBlock("cta") as Extract<EmailBlock, { type: "cta" }>;
      cta.text = node.textContent || "Clique aqui";
      cta.href = (node as HTMLAnchorElement).getAttribute("href") || "#";
      blocks.push(cta);
    } else {
      const raw = newBlock("raw") as Extract<EmailBlock, { type: "raw" }>;
      raw.html = node.outerHTML;
      blocks.push(raw);
    }
  }
  return blocks;
}
