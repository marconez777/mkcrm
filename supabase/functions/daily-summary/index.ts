// Edge Function: daily-summary
// Cron 08:00 BRT — envia resumo das últimas 24h aos owners/admins de cada clínica
// com feature email_marketing ativa. Bypassa supressão via force_send.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
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

    for (const c of clinics as any[]) {
      const features = c.settings?.features ?? {};
      if (features.email_marketing === false) continue;

      // Métricas
      const [{ count: leadsNew }, { data: logs }, { data: queueFailed }] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true })
          .eq("clinic_id", c.id).gte("created_at", since),
        supabase.from("email_logs").select("status, opened_at, clicked_at, bounced_at, template_slug")
          .eq("clinic_id", c.id).gte("sent_at", since).limit(5000),
      supabase.from("email_queue").select("id", { count: "exact", head: true })
          .eq("clinic_id", c.id).eq("status", "failed").gte("updated_at", since),
      ]);

      const sent = logs?.length ?? 0;
      const opened = logs?.filter((l: any) => l.opened_at).length ?? 0;
      const clicked = logs?.filter((l: any) => l.clicked_at).length ?? 0;
      const bounced = logs?.filter((l: any) => l.bounced_at).length ?? 0;
      const failed = queueFailed ?? 0;

      const topMap = new Map<string, number>();
      for (const l of logs ?? []) {
        topMap.set(l.template_slug, (topMap.get(l.template_slug) ?? 0) + 1);
      }
      const top3 = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

      // Nada relevante? pula
      if (sent === 0 && (leadsNew ?? 0) === 0 && failed === 0) continue;

      // Destinatários: owners + admins
      const { data: members } = await supabase
        .from("clinic_members")
        .select("user_id, role")
        .eq("clinic_id", c.id)
        .in("role", ["owner", "admin"]);
      if (!members?.length) continue;

      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds);
      const recipients = (profiles ?? []).filter((p: any) => p.email);
      if (!recipients.length) continue;

      const html = renderHtml({
        clinicName: c.name,
        leadsNew: leadsNew ?? 0,
        sent, opened, clicked, bounced, failed,
        openRate: sent ? Math.round((opened / sent) * 100) : 0,
        clickRate: sent ? Math.round((clicked / sent) * 100) : 0,
        top3,
      });

      // Enfileira para cada admin com force_send=true (bypass supressão)
      for (const r of recipients) {
        await supabase.from("email_queue").insert({
          clinic_id: c.id,
          template_slug: "__internal_daily_summary__",
          recipient_email: r.email,
          recipient_name: r.full_name ?? null,
          variables: { html, subject: `Resumo diário — ${c.name}` },
          scheduled_at: new Date().toISOString(),
          related_lead_table: "internal_daily_summary",
          force_send: true,
        });
      }
      processed++;
    }

    return jsonResponse({ ok: true, processed });
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
