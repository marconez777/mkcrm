// Validates that every route mentioned in the support KB markdown files
// actually exists in src/App.tsx. Catches dead/invented routes early.
//
// Run via: deno test --allow-read supabase/functions/_shared/support-kb/kb-routes.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

const KB_DIR = new URL("./", import.meta.url).pathname;
const APP_TSX = new URL("../../../../src/App.tsx", import.meta.url).pathname;

// Placeholders / examples that are not real app routes
const IGNORE = new Set([
  "/...",
  "/rota",
  "/atalho",
]);

function extractAppRoutes(src: string): Set<string> {
  const routes = new Set<string>();
  const re = /path="(\/[^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) routes.add(m[1]);
  routes.add("/"); // root
  return routes;
}

function normalize(route: string): string {
  // Replace any :param with a placeholder for matching
  return route.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ":x");
}

function matches(kbRoute: string, appRoutes: Set<string>): boolean {
  if (IGNORE.has(kbRoute)) return true;
  const norm = normalize(kbRoute);
  for (const r of appRoutes) {
    if (normalize(r) === norm) return true;
  }
  // Dynamic segment match: KB says /email/templates/new, App has /email/templates/:id
  // -> walk app routes and treat :x as wildcard for a single non-slash segment
  for (const r of appRoutes) {
    const pattern = "^" + normalize(r)
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:x/g, "[^/]+") + "$";
    if (new RegExp(pattern).test(kbRoute)) return true;
  }
  return false;
}

Deno.test("KB routes all exist in src/App.tsx", async () => {
  const appSrc = await Deno.readTextFile(APP_TSX);
  const appRoutes = extractAppRoutes(appSrc);

  const kbRouteRe = /`(\/[A-Za-z0-9/_:.\-]+)`/g;
  const invalid: Array<{ file: string; route: string }> = [];

  for await (const entry of walk(KB_DIR, { exts: [".md"] })) {
    const txt = await Deno.readTextFile(entry.path);
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = kbRouteRe.exec(txt)) !== null) {
      const route = m[1];
      if (seen.has(route)) continue;
      seen.add(route);
      if (!matches(route, appRoutes)) {
        invalid.push({ file: entry.path.split("/support-kb/")[1], route });
      }
    }
  }

  if (invalid.length > 0) {
    const msg = invalid
      .map((i) => `  ${i.file}  →  ${i.route}`)
      .join("\n");
    throw new Error(
      `Found ${invalid.length} KB route(s) that do not exist in src/App.tsx:\n${msg}`,
    );
  }
  assertEquals(invalid.length, 0);
});
