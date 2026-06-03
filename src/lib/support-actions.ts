// Support agent action tokens.
// The agent embeds these in its markdown responses; the chat UI parses them
// into interactive chips. Keep this list short and well-defined.
//
//   [[go:/route|Label]]                       → navigate to in-app route
//   [[click:<selector>|Label]]                → highlight a DOM element (selector or "text=...")
//   [[step:Texto do passo]]                   → one step in a guided walkthrough
//
// Anything else stays as plain markdown.

export type SupportAction =
  | { kind: "go"; label: string; route: string }
  | { kind: "click"; label: string; selector: string }
  | { kind: "step"; label: string };

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "action"; action: SupportAction };

const TOKEN_RE = /\[\[(go|click|step):([^\]]+)\]\]/g;

export function parseAssistantContent(input: string): ContentPart[] {
  if (!input) return [];
  const out: ContentPart[] = [];
  let last = 0;
  for (const m of input.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "text", text: input.slice(last, idx) });
    const kind = m[1] as "go" | "click" | "step";
    const body = m[2];
    if (kind === "step") {
      out.push({ type: "action", action: { kind: "step", label: body.trim() } });
    } else {
      const [first, ...rest] = body.split("|");
      const label = (rest.join("|") || first).trim();
      const target = first.trim();
      if (kind === "go") out.push({ type: "action", action: { kind, label, route: target } });
      else out.push({ type: "action", action: { kind, label, selector: target } });
    }
    last = idx + m[0].length;
  }
  if (last < input.length) out.push({ type: "text", text: input.slice(last) });
  return out;
}

/** Find element by CSS selector or `text=<visible label>`. */
export function findActionTarget(selector: string): HTMLElement | null {
  const s = selector.trim();
  if (s.startsWith("text=")) {
    const needle = s.slice(5).trim().toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>("button, a, [role='button'], [role='link'], [role='menuitem']"),
    );
    return candidates.find((el) => (el.textContent ?? "").trim().toLowerCase().includes(needle)) ?? null;
  }
  try { return document.querySelector<HTMLElement>(s); } catch { return null; }
}

/** Scroll to and highlight an element with a temporary ring. */
export function highlightElement(selector: string): boolean {
  const el = findActionTarget(selector);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const prev = el.style.cssText;
  el.style.cssText = `${prev};outline:3px solid hsl(var(--primary));outline-offset:3px;border-radius:8px;transition:outline 0.2s;box-shadow:0 0 0 6px hsl(var(--primary) / 0.25);`;
  window.setTimeout(() => { el.style.cssText = prev; }, 3500);
  return true;
}
