// Sends spend-limit alert emails via Resend (no auth required: invoked from DB trigger via pg_net).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://mkcrm.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    const body = await req.json();
    const { clinic_id, threshold, spent_usd, limit_usd } = body ?? {};
    if (!clinic_id || !threshold) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: cfg }, { data: clinic }] = await Promise.all([
      supabase.from("ai_spend_limits").select("notify_emails").eq("clinic_id", clinic_id).maybeSingle(),
      supabase.from("clinics").select("name").eq("id", clinic_id).maybeSingle(),
    ]);

    const emails: string[] = Array.isArray(cfg?.notify_emails) ? cfg!.notify_emails : [];
    if (emails.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no recipients" }), { headers: corsHeaders });
    }

    const clinicName = clinic?.name ?? "Clínica";
    const isBlock = Number(threshold) >= 100;
    const subject = isBlock
      ? `[CRM] ⛔ Gasto IA atingiu 100% — ${clinicName} BLOQUEADA`
      : `[CRM] ⚠️ Gasto IA atingiu ${threshold}% — ${clinicName}`;

    const spent = Number(spent_usd ?? 0).toFixed(4);
    const limit = Number(limit_usd ?? 0).toFixed(2);
    const percent = limit_usd ? ((Number(spent_usd) / Number(limit_usd)) * 100).toFixed(1) : "0";

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#0f172a">
        <h2 style="margin:0 0 12px;color:${isBlock ? "#b91c1c" : "#b45309"}">
          ${isBlock ? "Limite diário de IA atingido" : `Aviso: ${threshold}% do limite diário de IA`}
        </h2>
        <p style="margin:0 0 16px;line-height:1.5;color:#334155">
          Clínica <strong>${clinicName}</strong> ${isBlock ? "atingiu o limite diário e as chamadas de IA foram <strong>bloqueadas</strong> até o próximo reset (00:00 horário de Brasília)." : `está em <strong>${percent}%</strong> do limite diário configurado.`}
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:8px 0;color:#64748b">Gasto hoje</td><td style="padding:8px 0;text-align:right;font-weight:600">US$ ${spent}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Limite diário</td><td style="padding:8px 0;text-align:right;font-weight:600">US$ ${limit}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">% consumido</td><td style="padding:8px 0;text-align:right;font-weight:600">${percent}%</td></tr>
        </table>
        ${isBlock ? `<p style="margin:16px 0 8px;line-height:1.5;color:#334155">Para reativar agora (sem esperar o reset), acesse o painel:</p>` : ""}
        <p style="margin:24px 0 0">
          <a href="${SITE_URL}/ai/usage" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Abrir painel de Custos IA</a>
        </p>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Você está recebendo isto porque seu e-mail está na lista de avisos de gasto IA desta clínica.</p>
      </div>
    `;

    const results: any[] = [];
    for (const to of emails) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "CRM Alertas <alerts@mkcrm.lovable.app>",
            to: [to],
            subject,
            html,
          }),
        });
        const j = await r.json().catch(() => ({}));
        results.push({ to, ok: r.ok, status: r.status, id: j?.id });
        await supabase.from("ai_spend_events").insert({
          clinic_id,
          kind: r.ok ? "notify_sent" : "notify_failed",
          spent_usd,
          limit_usd,
          notes: r.ok ? `Email enviado a ${to}` : `Falha (${r.status}) ${JSON.stringify(j)}`,
        });
      } catch (e) {
        results.push({ to, ok: false, error: (e as Error).message });
        await supabase.from("ai_spend_events").insert({
          clinic_id, kind: "notify_failed", notes: `Erro envio ${to}: ${(e as Error).message}`,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-spend-notify error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
