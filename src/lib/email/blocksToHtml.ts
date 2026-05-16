import type { EmailBlock } from "./types";
import { sanitizeInlineHtml } from "./sanitize";

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function escapeAttr(s: string) {
  return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderBlock(b: EmailBlock): string {
  switch (b.type) {
    case "heading": {
      const tag = `h${b.level}`;
      const size = b.level === 1 ? 28 : b.level === 2 ? 22 : 18;
      return `<tr><td align="${b.align}" style="padding:8px 0;"><${tag} style="margin:0;color:${b.color};font-size:${size}px;font-weight:700;line-height:1.3;font-family:Arial,Helvetica,sans-serif;text-align:${b.align};">${escapeAttr(b.text)}</${tag}></td></tr>`;
    }
    case "paragraph": {
      const inner = sanitizeInlineHtml(b.html);
      return `<tr><td align="${b.align}" style="padding:8px 0;color:${b.color};font-size:${b.fontSize}px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;text-align:${b.align};">${inner}</td></tr>`;
    }
    case "image": {
      const img = `<img src="${escapeAttr(b.src)}" alt="${escapeAttr(b.alt)}" width="${b.width}" style="display:block;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`;
      const wrapped = b.href ? `<a href="${escapeAttr(b.href)}" target="_blank" rel="noopener">${img}</a>` : img;
      return `<tr><td align="${b.align}" style="padding:8px 0;">${wrapped}</td></tr>`;
    }
    case "cta": {
      return `<tr><td align="${b.align}" style="padding:16px 0;">
        <a href="${escapeAttr(b.href)}" target="_blank" rel="noopener"
           style="display:inline-block;background:${b.bg};color:${b.color};text-decoration:none;
           padding:${b.paddingY}px ${b.paddingX}px;border-radius:${b.radius}px;font-weight:600;
           font-family:Arial,Helvetica,sans-serif;font-size:14px;">${escapeAttr(b.text)}</a>
      </td></tr>`;
    }
    case "divider":
      return `<tr><td style="padding:12px 0;"><hr style="border:0;border-top:${b.thickness}px solid ${b.color};margin:0;" /></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${b.height}px;line-height:${b.height}px;font-size:0;">&nbsp;</td></tr>`;
    case "avatar": {
      const img = b.src
        ? `<img src="${escapeAttr(b.src)}" width="${b.size}" height="${b.size}" alt="" style="display:inline-block;border-radius:50%;width:${b.size}px;height:${b.size}px;object-fit:cover;" />`
        : `<div style="display:inline-block;width:${b.size}px;height:${b.size}px;border-radius:50%;background:#e5e7eb;color:#374151;line-height:${b.size}px;text-align:center;font-weight:700;font-family:Arial;">${escapeAttr(b.initials)}</div>`;
      return `<tr><td align="${b.align}" style="padding:8px 0;">${img}</td></tr>`;
    }
    case "signature": {
      const avatar = b.avatarSrc
        ? `<img src="${escapeAttr(b.avatarSrc)}" width="48" height="48" alt="" style="border-radius:50%;display:block;" />`
        : "";
      return `<tr><td style="padding:16px 0;border-top:1px solid #e5e7eb;font-family:Arial;font-size:13px;color:#374151;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
        ${avatar ? `<td style="padding-right:12px;vertical-align:top;">${avatar}</td>` : ""}
        <td style="vertical-align:top;">
          <div style="font-weight:700;color:#111;">${escapeAttr(b.name)}</div>
          ${b.role ? `<div style="color:#6b7280;">${escapeAttr(b.role)}</div>` : ""}
          ${b.extra ? `<div style="margin-top:4px;">${escapeAttr(b.extra)}</div>` : ""}
          ${b.site ? `<div style="margin-top:4px;"><a href="${escapeAttr(b.site)}" style="color:#2563eb;text-decoration:none;">${escapeAttr(b.site)}</a></div>` : ""}
        </td></tr></table>
      </td></tr>`;
    }
    case "youtube": {
      const id = youtubeId(b.url);
      if (!id) return "";
      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const link = `https://www.youtube.com/watch?v=${id}`;
      return `<tr><td align="center" style="padding:12px 0;">
        <a href="${link}" target="_blank" rel="noopener" style="display:inline-block;position:relative;">
          <img src="${thumb}" width="${b.width}" alt="${escapeAttr(b.caption || "YouTube")}" style="display:block;max-width:100%;height:auto;border-radius:8px;" />
        </a>
        ${b.caption ? `<div style="font-family:Arial;font-size:12px;color:#6b7280;margin-top:6px;">${escapeAttr(b.caption)}</div>` : ""}
      </td></tr>`;
    }
    case "columns": {
      const colW = Math.floor(600 / b.cols);
      const cells = b.children
        .map(
          (col) =>
            `<td valign="top" width="${colW}" style="padding:0 8px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${col.map(renderBlock).join("")}</table></td>`,
        )
        .join("");
      return `<tr><td style="padding:8px 0;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`;
    }
    case "raw":
      return `<tr><td>${b.html}</td></tr>`;
  }
}

export interface EmailRenderOptions {
  preheader?: string;
  footerAddress?: string;
  includeUnsubscribeFooter?: boolean; // default true
}

export function blocksToHtml(blocks: EmailBlock[], opts: EmailRenderOptions = {}): string {
  const includeUnsub = opts.includeUnsubscribeFooter !== false;
  const inner = blocks.map(renderBlock).join("\n");

  const footer = includeUnsub
    ? `<tr><td style="padding:24px 0 8px;border-top:1px solid #e5e7eb;color:#9ca3af;font-family:Arial;font-size:11px;line-height:1.5;text-align:center;">
        ${opts.footerAddress ? `<div style="margin-bottom:6px;">${opts.footerAddress}</div>` : ""}
        <div>Não quer mais receber? <a href="{{unsubscribe_url}}" style="color:#6b7280;text-decoration:underline;">Cancelar inscrição</a></div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>Email</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;-webkit-text-size-adjust:100%;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;max-width:600px;width:100%;">
      <tr><td style="padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
${inner}
${footer}
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function htmlContainsUnsubscribeVar(html: string): boolean {
  return /\{\{\s*unsubscribe_url\s*\}\}/i.test(html);
}
