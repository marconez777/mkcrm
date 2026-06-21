// supabase/functions/report-finalizados-mensal-or/index.ts
//
// Cron Dia 1, 06:00 UTC — Clínica ÓR.
// Conta leads que ENTRARAM em "Consulta finalizada" e "1ª Sessão Finalizada"
// no mês anterior (via lead_stage_history) e:
//   1. Salva/atualiza linha em clinic_monthly_reports.
//   2. Envia email aos owners da clínica.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CLINIC_ID    = "cf038458-457d-4c1a-9ac4-c88c3c8353a1";
const STAGE_CONS   = "7584241f-6e4b-4824-aaea-e271e865227d"; // Consulta finalizada
const STAGE_TRAT   = "2a352661-01e2-41f8-be10-032f803e2387"; // 1ª Sessão Finalizada
const APP_URL      = Deno.env.get("PUBLIC_SITE_URL") ?? "https://mkcrm.lovable.app";
const TEMPLATE_SLUG = "or-monthly-finalizados-report";

function previousMonthRange(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // current month idx
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end   = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { start, end };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { start, end } = previousMonthRange(new Date());
  const monthLabel = start.toISOString().slice(0, 7); // "YYYY-MM"
  const reportMonth = `${monthLabel}-01`;

  async function countStage(stageId: string) {
    const { count, error } = await supabase
      .from("lead_stage_history")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", CLINIC_ID)
      .eq("to_stage_id", stageId)
      .gte("moved_at", start.toISOString())
      .lt("moved_at", end.toISOString());
    if (error) throw error;
    return count ?? 0;
  }

  const countConsulta   = await countStage(STAGE_CONS);
  const countTratamento = await countStage(STAGE_TRAT);
  const total           = countConsulta + countTratamento;

  const payload = {
    month_label: monthLabel,
    count_consulta: countConsulta,
    count_tratamento: countTratamento,
    total,
    range: { start: start.toISOString(), end: end.toISOString() },
  };

  // upsert into clinic_monthly_reports
  await supabase.from("clinic_monthly_reports").upsert({
    clinic_id: CLINIC_ID,
    report_kind: "finalizados_mensal_or",
    report_month: reportMonth,
    payload,
  }, { onConflict: "clinic_id,report_kind,report_month" });

  // recipients = owners/admins da clínica
  const { data: members } = await supabase
    .from("clinic_members")
    .select("user_id, role")
    .eq("clinic_id", CLINIC_ID)
    .in("role", ["owner", "admin"]);

  const userIds = (members ?? []).map((m: any) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, email")
    .in("user_id", userIds);

  const recipients = (profiles ?? []).map((p: any) => p.email).filter(Boolean);

  const sendResults: Array<{ to: string; ok: boolean; detail?: string }> = [];
  for (const to of recipients) {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        clinic_id: CLINIC_ID,
        template_slug: TEMPLATE_SLUG,
        recipient_email: to,
        variables: {
          month_label: monthLabel,
          count_consulta: countConsulta,
          count_tratamento: countTratamento,
          total,
          app_url: APP_URL,
        },
      },
    });
    if (error) sendResults.push({ to, ok: false, detail: error.message });
    else sendResults.push({ to, ok: true, detail: JSON.stringify(data).slice(0, 200) });
  }

  await supabase.from("clinic_monthly_reports")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("clinic_id", CLINIC_ID)
    .eq("report_kind", "finalizados_mensal_or")
    .eq("report_month", reportMonth);

  return new Response(JSON.stringify({ ok: true, month: monthLabel, payload, sent: sendResults }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
