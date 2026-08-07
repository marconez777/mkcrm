// supabase/functions/pipeline-auto-finalize-or/index.ts
//
// Cron job exclusivo para Clínica ÓR (cf038458-457d-4c1a-9ac4-c88c3c8353a1).
// Roda a cada 15 minutos via pg_cron.
// Atualiza o status de appointments 'agendado' no passado para 'realizado'.
// O trigger 'trg_appointments_auto_sync' cuidará do resto (invocando
// pipeline-deterministic para mover o card e limpar campos/tags).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CLINIC_ID = "cf038458-457d-4c1a-9ac4-c88c3c8353a1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();

  // Busca agendamentos no passado
  const { data: appointments, error: selectErr } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", CLINIC_ID)
    .eq("status", "agendado")
    .lte("scheduled_at", now)
    .limit(100);

  if (selectErr) {
    console.error("Erro ao buscar appointments:", selectErr);
    return new Response(JSON.stringify({ ok: false, error: selectErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!appointments || appointments.length === 0) {
    return new Response(JSON.stringify({ ok: true, updated: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ids = appointments.map((a) => a.id);

  // Atualiza para 'realizado'
  const { error: updateErr } = await supabase
    .from("appointments")
    .update({ status: "realizado" })
    .in("id", ids);

  if (updateErr) {
    console.error("Erro ao atualizar appointments:", updateErr);
    return new Response(JSON.stringify({ ok: false, error: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, updated: ids.length, ids }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
