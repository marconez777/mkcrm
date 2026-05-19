import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a","b","strong","i","em","u","p","br","span","div","img","table","tbody","tr","td","th",
      "h1","h2","h3","h4","h5","h6","ul","ol","li","blockquote","hr","center","font","small","sup","sub","code",
    ],
    ALLOWED_ATTR: ["href","target","rel","src","alt","width","height","style","align","valign","bgcolor","border","cellpadding","cellspacing","colspan","rowspan","color","face","size","class"],
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeInlineHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a","b","strong","i","em","u","s","span","br","p","div",
      "ul","ol","li","blockquote","h1","h2","h3","h4","h5","h6",
      "small","sup","sub","code","mark",
    ],
    ALLOWED_ATTR: ["href","target","rel","style","color","class"],
  });
}
