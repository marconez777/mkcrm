// dedup-leads-tick — Onda 6, B13.
// Detecta leads duplicados por telefone normalizado (sem mexer nos cards) e
// emite um lead_events.type='duplicate_detected' no PRIMEIRO lead de cada
// grupo, com a lista dos demais para o time auditar e mesclar manualmente.
// Idempotente — só emite quando o grupo muda (assinatura por phone+ids).
//
// Trigger: cron diário OU POST manual { clinic_id?, dry_run? }.

import { corsHeaders, json, sb } from "../_shared/evolution.ts";

interface DupRow {
  normalized_phone: string;
  lead_count: number;
  lead_ids: string[];
  names: string[];
  stage_ids: (string | null)[];
  last_message_ats: (string | null)[];
}

async function processClinic(clinicId: string, dryRun: boolean) {
  const supabase = sb();
  const { data, error } = await supabase
    .rpc("find_duplicate_leads_by_phone", { p_clinic_id: clinicId });
  if (error) return { clinic_id: clinicId, error: error.message };
  const groups = (data ?? []) as DupRow[];
  let emitted = 0;
  let skipped = 0;
  for (const g of groups) {
    const [primary, ...rest] = g.lead_ids;
    if (!primary) continue;
    const signature = `dedup:${g.normalized_phone}:${g.lead_ids.slice().sort().join(",")}`;
    // Evita re-emitir: olha o último evento dedup do lead primary
    const { data: existing } = await supabase
      .from("lead_events")
      .select("payload")
      .eq("lead_id", primary)
      .eq("type", "duplicate_detected")
      .order("created_at", { ascending: false })
      .limit(1);
    if ((existing?.[0]?.payload as { signature?: string } | undefined)?.signature === signature) {
      skipped++;
      continue;
    }
    if (dryRun) { emitted++; continue; }
    await supabase.from("lead_events").insert({
      clinic_id: clinicId,
      lead_id: primary,
      type: "duplicate_detected",
      payload: {
        signature,
        normalized_phone: g.normalized_phone,
        lead_count: g.lead_count,
        primary_lead_id: primary,
        duplicate_lead_ids: rest,
        names: g.names,
        stage_ids: g.stage_ids,
        last_message_ats: g.last_message_ats,
      },
    });
    emitted++;
  }
  return { clinic_id: clinicId, groups: groups.length, emitted, skipped };
}

interface Body { clinic_id?: string; dry_run?: boolean }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }
  const supabase = sb();
  let q = supabase.from("clinics").select("id");
  if (body.clinic_id) q = q.eq("id", body.clinic_id);
  const { data: clinics, error } = await q;
  if (error) return json({ error: error.message }, 500);
  const results: unknown[] = [];
  for (const c of (clinics ?? []) as Array<{ id: string }>) {
    results.push(await processClinic(c.id, !!body.dry_run));
  }
  return json({ ok: true, results });
});
