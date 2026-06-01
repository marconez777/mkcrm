// Edge Function: daily-summary
// Cron 08:00 BRT — envia resumo das últimas 24h aos owners/admins de cada clínica
// com feature email_marketing ativa. Envia direto via Resend (bypass de queue/supressão).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

const RESEND_URL = "https://api.resend.com/emails";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return jsonResponse({ error: "RESEND_API_KEY missing" }, { status: 503 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clinics } = await supabase
      .from("clinics")
      .select("id, name, settings");
    if (!clinics?.length) return jsonResponse({ processed: 0 });

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let processed = 0;
    let sent = 0;

    for (const c of clinics as any[]) {
      const features = c.settings?.features ?? {};
      if (features.email_marketing === false) continue;

      const [{ count: leadsNew }, { data: logs }, { count: failed }, { data: formLeadsRaw }] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("clinic_id", c.id).gte("created_at", since),
        supabase.from("email_logs").select("status, opened_at, clicked_at, bounced_at, template_slug")
          .eq("clinic_id", c.id).gte("sent_at", since).limit(5000),
        supabase.from("email_queue").select("id", { count: "exact", head: true })
          .eq("clinic_id", c.id).eq("status", "failed").gte("updated_at", since),
        supabase.from("leads").select("id, stage_id, last_message_at")
          .eq("clinic_id", c.id).gte("created_at", since)
          .not("form_source", "is", null).limit(5000),
      ]);

      const totalSent = logs?.length ?? 0;
      const opened = logs?.filter((l: any) => l.opened_at).length ?? 0;
      const clicked = logs?.filter((l: any) => l.clicked_at).length ?? 0;
      const bounced = logs?.filter((l: any) => l.bounced_at).length ?? 0;
      const failedCount = failed ?? 0;

      // Métricas de formulário
      const formLeads = formLeadsRaw ?? [];
      const formLeadsCount = formLeads.length;
      const formNoWhatsapp = formLeads.filter((l: any) => !l.last_message_at).length;
      const buckets = (c.settings?.tracking_stage_buckets ?? {}) as {
        consulta?: string[]; tratamento?: string[]; nutricao?: string[];
      };
      const bucketsConfigured = !!(buckets.consulta?.length || buckets.tratamento?.length);
      const formToConsulta = bucketsConfigured
        ? formLeads.filter((l: any) => l.stage_id && (buckets.consulta || []).includes(l.stage_id)).length
        : 0;
      const formToTratamento = bucketsConfigured
        ? formLeads.filter((l: any) => l.stage_id && (buckets.tratamento || []).includes(l.stage_id)).length
        : 0;

      const topMap = new Map<string, number>();
      for (const l of logs ?? []) topMap.set(l.template_slug, (topMap.get(l.template_slug) ?? 0) + 1);
      const top3 = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

      if (totalSent === 0 && (leadsNew ?? 0) === 0 && failedCount === 0 && formLeadsCount === 0) continue;

      // From: pega domínio verificado da clínica ou fallback
      const { data: domain } = await supabase
        .from("email_domains")
        .select("domain, status")
        .eq("clinic_id", c.id)
        .eq("status", "verified")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const from = domain?.domain
        ? `${c.name} <no-reply@${domain.domain}>`
        : `Resumo <onboarding@resend.dev>`;

      // Destinatários
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", c.id)
        .in("role", ["owner", "admin"]);
      if (!members?.length) continue;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email, full_name")
        .in("user_id", members.map((m: any) => m.user_id));
      const recipients = (profiles ?? []).filter((p: any) => p.email).map((p: any) => p.email);
      if (!recipients.length) continue;

      const html = renderHtml({
        clinicName: c.name,
        leadsNew: leadsNew ?? 0,
        sent: totalSent, opened, clicked, bounced, failed: failedCount,
        openRate: totalSent ? Math.round((opened / totalSent) * 100) : 0,
        clickRate: totalSent ? Math.round((clicked / totalSent) * 100) : 0,
        top3,
        formLeads: formLeadsCount,
        formNoWhatsapp,
        formToConsulta,
        formToTratamento,
        bucketsConfigured,
      });

      const subject = `Resumo diário — ${c.name}`;
      try {
        const resp = await fetch(RESEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({ from, to: recipients, subject, html }),
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          console.error("daily-summary resend error", c.id, result);
          continue;
        }
        sent++;
        // Log
        await supabase.from("email_logs").insert({
          clinic_id: c.id,
          template_slug: "__internal_daily_summary__",
          recipient_email: recipients[0],
          subject,
          status: "sent",
          resend_id: (result as any).id ?? null,
          related_lead_table: "internal_daily_summary",
        });
      } catch (e) {
        console.error("daily-summary send error", c.id, e);
      }
      processed++;
    }

    return jsonResponse({ ok: true, processed, sent });
  } catch (e) {
    console.error("daily-summary error:", e);
    return jsonResponse({ error: String(e) }, { status: 500 });
  }
});

function renderHtml(d: {
  clinicName: string; leadsNew: number; sent: number; opened: number; clicked: number;
  bounced: number; failed: number; openRate: number; clickRate: number; top3: [string, number][];
}) {
  const row = (label: string, val: number | string) => `
    <tr><td style="padding:8px 0;color:#555;font-size:14px">${label}</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;font-size:14px">${val}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:-apple-system,Segoe UI,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:24px">
      <tr><td>
        <h1 style="margin:0 0 4px;font-size:20px">Resumo diário</h1>
        <p style="margin:0 0 16px;color:#888;font-size:13px">${d.clinicName} — últimas 24h</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row("Novos leads", d.leadsNew)}
          ${row("Emails enviados", d.sent)}
          ${row("Abertura", `${d.openRate}% (${d.opened})`)}
          ${row("Cliques", `${d.clickRate}% (${d.clicked})`)}
          ${row("Bounces", d.bounced)}
          ${row("Falhas na fila", d.failed)}
        </table>
        ${d.top3.length ? `<h3 style="margin:24px 0 8px;font-size:14px">Top templates</h3>
          <ul style="margin:0;padding-left:18px;color:#444;font-size:13px">
            ${d.top3.map(([s, n]) => `<li>${s} — ${n}</li>`).join("")}
          </ul>` : ""}
        <p style="margin:24px 0 0;color:#999;font-size:12px">Email interno automático.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
