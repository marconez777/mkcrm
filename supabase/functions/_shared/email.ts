// Helpers compartilhados entre as edge functions de email.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

export function sanitizeTagValue(input: string): string {
  if (!input) return "unknown";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 256) || "unknown";
}

export function isInternalContext(related_lead_table?: string | null): boolean {
  if (!related_lead_table) return true;
  if (related_lead_table === "leads_internal") return true;
  if (related_lead_table.startsWith("quick_test_")) return true;
  if (related_lead_table.startsWith("campaign_test_")) return true;
  return false;
}
