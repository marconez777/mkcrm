// Captures recent console errors and failed network requests for the support agent.
// Lightweight, no external deps. Installed once at app boot.

export type RuntimeError = {
  ts: number;
  kind: "console" | "fetch" | "unhandled";
  message: string;
  detail?: string;
  url?: string;
  status?: number;
  route?: string;
};

const MAX = 25;
const buffer: RuntimeError[] = [];
let installed = false;

function push(e: RuntimeError) {
  buffer.push(e);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
}

function truncate(s: string, n = 400) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function installSupportRuntimeWatcher() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // 1) console.error
  const origErr = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const msg = args
        .map((a) => {
          if (a instanceof Error) return a.message;
          if (typeof a === "string") return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        })
        .join(" ");
      // ignore noisy/irrelevant
      if (!/^(Warning: |\[vite\])/i.test(msg)) {
        push({
          ts: Date.now(),
          kind: "console",
          message: truncate(msg, 300),
          route: window.location.pathname,
        });
      }
    } catch { /* noop */ }
    origErr(...args);
  };

  // 2) window errors
  window.addEventListener("error", (e) => {
    push({
      ts: Date.now(),
      kind: "unhandled",
      message: truncate(e.message ?? "Error", 300),
      detail: e.filename ? `${e.filename}:${e.lineno}` : undefined,
      route: window.location.pathname,
    });
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unhandled rejection";
    push({
      ts: Date.now(),
      kind: "unhandled",
      message: truncate(message, 300),
      route: window.location.pathname,
    });
  });

  // 3) fetch failures (>=400) — skip the support agent itself to avoid feedback loops
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const [input] = args;
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    try {
      const res = await origFetch(...args);
      if (!res.ok && !/support-(chat|kb-sync|test-connection)/.test(url)) {
        push({
          ts: Date.now(),
          kind: "fetch",
          message: `HTTP ${res.status} ${res.statusText || ""}`.trim(),
          url: truncate(url, 200),
          status: res.status,
          route: window.location.pathname,
        });
      }
      return res;
    } catch (err: any) {
      if (!/support-(chat|kb-sync|test-connection)/.test(url)) {
        push({
          ts: Date.now(),
          kind: "fetch",
          message: truncate(err?.message ?? "Network error", 200),
          url: truncate(url, 200),
          route: window.location.pathname,
        });
      }
      throw err;
    }
  };
}

export function getRuntimeErrors(opts?: { sinceMs?: number; route?: string }) {
  const since = opts?.sinceMs ? Date.now() - opts.sinceMs : 0;
  return buffer
    .filter((e) => e.ts >= since)
    .filter((e) => (opts?.route ? e.route === opts.route : true))
    .slice(-10);
}

export function clearRuntimeErrors() {
  buffer.length = 0;
}
