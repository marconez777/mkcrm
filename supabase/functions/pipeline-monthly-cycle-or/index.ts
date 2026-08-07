// supabase/functions/pipeline-monthly-cycle-or/index.ts
//
// Cron mensal — Dia 1, 03:00 UTC — para a Clínica ÓR.
// Move todos os leads em "1ª Sessão Finalizada" → "Paciente Antigo".
// Idempotente: pipelineMove já trava por idempotencyKey por mês.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { pipelineMove } from "../_shared/pipeline-move.ts";

const CLINIC_ID = "cf038458-457d-4c1a-9ac4-c88c3c8353a1";
const STAGE_FROM = "2a352661-01e2-41f8-be10-032f803e2387"; // 1ª Sessão Finalizada
const STAGE_TO   = "7fea97d7-c2af-4e6f-8f39-af8375bb4468"; // Paciente Antigo

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const result = { moved: 0, skipped: 0, errors: [] as Array<{ leadId: string; reason: string }> };

  let from = 0;
  const pageSize = 200;

  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("id")
      .eq("clinic_id", CLINIC_ID)
      .eq("stage_id", STAGE_FROM)
      .is("archived_at", null)
      .range(from, from + pageSize - 1);

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data || data.length === 0) break;

    for (const lead of data) {
      const r = await pipelineMove(supabase, {
        leadId: lead.id,
        toStageId: STAGE_TO,
        source: "auto:monthly-cycle-or",
        reason: `Ciclo mensal ÓR — Dia 1 (${monthKey})`,
        ruleKey: "automation.or_monthly_cycle.enabled",
        idempotencyKey: `or_monthly_cycle:${monthKey}:${lead.id}`,
        metadata: { month_key: monthKey },
      });
      if (r.moved) result.moved += 1;
      else {
        result.skipped += 1;
        if ((r as { reason?: string }).reason) {
          result.errors.push({ leadId: lead.id, reason: (r as { reason: string }).reason });
        }
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return new Response(JSON.stringify({ ok: true, month: monthKey, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
