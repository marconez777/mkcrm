// Edge Function: email-automations-tick
// Cron 5min: lê email_automations ativas, detecta novos triggers
// (lead_created / lead_stage_changed) desde o último tick e enrola leads
// novos enfileirando todos os steps em email_queue.
//
// Suppression / idempotência / cota / verificação de domínio ficam por
// conta do send-email no momento do envio — aqui só enfileiramos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

type Step = { template_slug: string; delay_minutes: number };

type Automation = {
  id: string;
  clinic_id: string;
  name: string;
  active: boolean;
  trigger_type: "lead_created" | "lead_stage_changed" | "lead_tag_added" | "segment_contact_added";
  trigger_config: Record<string, unknown>;
  steps: Step[];
  last_run_at: string | null;
  updated_at: string;
};

type LeadRow = {
  id: string;
  clinic_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();

  const { data: automations, error: aErr } = await supabase
    .from("email_automations")
    .select("id, clinic_id, name, active, trigger_type, trigger_config, steps, last_run_at, updated_at")
    .eq("active", true);

  if (aErr) return jsonResponse({ error: aErr.message }, { status: 500 });
  if (!automations?.length) return jsonResponse({ processed: 0, enrolled: 0, enqueued: 0 });

  let enrolledTotal = 0;
  let enqueuedTotal = 0;
  const perAutomation: Array<{ id: string; enrolled: number; enqueued: number; skipped: number }> = [];

  // R-9: processa automações em paralelo (semáforo simples por concurrency)
  const CONCURRENCY = 10;
  const processAutomation = async (auto: Automation) => {
    const result = { id: auto.id, enrolled: 0, enqueued: 0, skipped: 0 };

    const steps: Step[] = Array.isArray(auto.steps)
      ? auto.steps.filter((s) => s && typeof s.template_slug === "string" && s.template_slug.length > 0)
      : [];
    if (steps.length === 0) {
      await supabase.from("email_automations").update({ last_run_at: nowIso }).eq("id", auto.id);
      return result;
    }

    // cursor: desde o último tick (ou desde a criação efetiva da automação)
    // Para automações novas, começa a contar a partir de agora — assim não
    // re-enrola leads antigos quando uma automação é editada/ativada.
    const since = auto.last_run_at ?? nowIso;

    // 1) busca leads candidatos para este trigger
    let candidates: Array<{ lead: LeadRow; source_event: string }> = [];

    try {
      if (auto.trigger_type === "lead_created") {
        const segmentId = (auto.trigger_config?.segment_id ?? null) as string | null;
        let leadIdsFilter: string[] | null = null;
        let emailsFilter: string[] | null = null;
        if (segmentId) {
          // restringe aos leads pertencentes ao segmento — match por
          // lead_id OU por email (segmentos estáticos podem ter só email)
          const { data: scs, error: scErr } = await supabase
            .from("email_segment_contacts")
            .select("lead_id, email")
            .eq("clinic_id", auto.clinic_id)
            .eq("segment_id", segmentId)
            .limit(10000);
          if (scErr) throw scErr;
          leadIdsFilter = Array.from(new Set(
            (scs ?? []).map((r: any) => r.lead_id).filter((x: any) => !!x)
          ));
          emailsFilter = Array.from(new Set(
            (scs ?? [])
              .map((r: any) => (r.email ?? "").toString().trim().toLowerCase())
              .filter((x: string) => x.length > 0)
          ));
          if (leadIdsFilter.length === 0 && emailsFilter.length === 0) {
            // segmento vazio — nada a enrolar
            await supabase.from("email_automations").update({ last_run_at: nowIso }).eq("id", auto.id);
            return result;
          }
        }
        const leadIdSet = new Set(leadIdsFilter ?? []);
        const emailSet = new Set(emailsFilter ?? []);
        const hasSegmentFilter = !!segmentId;

        // Busca leads recentes e filtra em memória (segmentos grandes
        // estouram o tamanho da URL se usarmos id.in / email.in via OR).
        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, clinic_id, name, email, phone, created_at")
          .eq("clinic_id", auto.clinic_id)
          .gt("created_at", since)
          .not("email", "is", null)
          .order("created_at", { ascending: true })
          .limit(1000);
        if (error) throw error;
        candidates = (leads ?? [])
          .filter((l: any) => {
            if (!hasSegmentFilter) return true;
            if (leadIdSet.has(l.id)) return true;
            const em = (l.email ?? "").toString().trim().toLowerCase();
            return em.length > 0 && emailSet.has(em);
          })
          .map((l: any) => ({
            lead: { id: l.id, clinic_id: l.clinic_id, name: l.name, email: l.email, phone: l.phone },
            source_event: `lead_created:${l.created_at}`,
          }));
      } else if (auto.trigger_type === "segment_contact_added") {
        // dispara quando um contato é adicionado ao segmento (independente da idade do lead)
        const segmentId = (auto.trigger_config?.segment_id ?? null) as string | null;
        if (!segmentId) {
          // sem segmento configurado, não há como filtrar — pula
          await supabase.from("email_automations").update({ last_run_at: nowIso }).eq("id", auto.id);
          return result;
        }
        const { data: scs, error: scErr } = await supabase
          .from("email_segment_contacts")
          .select("id, lead_id, email, name, created_at")
          .eq("clinic_id", auto.clinic_id)
          .eq("segment_id", segmentId)
          .gt("created_at", since)
          .order("created_at", { ascending: true })
          .limit(500);
        if (scErr) throw scErr;
        const rows = scs ?? [];
        const leadIds = Array.from(new Set(
          rows.map((r: any) => r.lead_id).filter((x: any) => !!x)
        ));
        const emails = Array.from(new Set(
          rows
            .filter((r: any) => !r.lead_id)
            .map((r: any) => (r.email ?? "").toString().trim().toLowerCase())
            .filter((x: string) => x.length > 0)
        ));
        const byId = new Map<string, LeadRow>();
        const byEmail = new Map<string, LeadRow>();
        if (leadIds.length) {
          const { data: leads } = await supabase
            .from("leads")
            .select("id, clinic_id, name, email, phone")
            .in("id", leadIds)
            .eq("clinic_id", auto.clinic_id)
            .not("email", "is", null);
          for (const l of (leads ?? []) as any[]) byId.set(l.id, l);
        }
        if (emails.length) {
          const { data: leads } = await supabase
            .from("leads")
            .select("id, clinic_id, name, email, phone")
            .in("email", emails)
            .eq("clinic_id", auto.clinic_id);
          for (const l of (leads ?? []) as any[]) {
            const em = (l.email ?? "").toString().trim().toLowerCase();
            if (em && !byEmail.has(em)) byEmail.set(em, l);
          }
        }
        candidates = rows
          .map((r: any) => {
            const lead = r.lead_id
              ? byId.get(r.lead_id)
              : byEmail.get((r.email ?? "").toString().trim().toLowerCase());
            if (!lead) return null;
            return { lead, source_event: `segment_contact:${r.id}` };
          })
          .filter((x: any): x is { lead: LeadRow; source_event: string } => !!x);
      } else if (auto.trigger_type === "lead_stage_changed") {
        const toStageId = (auto.trigger_config?.to_stage_id ?? auto.trigger_config?.stage_id) as string | undefined;
        let q = supabase
          .from("lead_stage_history")
          .select("id, lead_id, to_stage_id, moved_at")
          .eq("clinic_id", auto.clinic_id)
          .gt("moved_at", since)
          .order("moved_at", { ascending: true })
          .limit(500);
        if (toStageId) q = q.eq("to_stage_id", toStageId);
        const { data: moves, error } = await q;
        if (error) throw error;
        const leadIds = Array.from(new Set((moves ?? []).map((m: any) => m.lead_id)));
        if (leadIds.length) {
          const { data: leads } = await supabase
            .from("leads")
            .select("id, clinic_id, name, email, phone")
            .in("id", leadIds)
            .eq("clinic_id", auto.clinic_id)
            .not("email", "is", null);
          const byId = new Map((leads ?? []).map((l: any) => [l.id, l]));
          candidates = (moves ?? [])
            .filter((m: any) => byId.has(m.lead_id))
            .map((m: any) => ({
              lead: byId.get(m.lead_id) as LeadRow,
              source_event: `stage_history:${m.id}`,
            }));
        }
      } else if (auto.trigger_type === "lead_tag_added") {
        // Hoje não há histórico de tags por lead; depende de um emissor
        // futuro em lead_events (type='tag_added', payload.tag).
        const wantedTag = auto.trigger_config?.tag as string | undefined;
        let q = supabase
          .from("lead_events")
          .select("id, lead_id, payload, created_at")
          .eq("clinic_id", auto.clinic_id)
          .eq("type", "tag_added")
          .gt("created_at", since)
          .order("created_at", { ascending: true })
          .limit(500);
        const { data: events, error } = await q;
        if (error) throw error;
        const matching = (events ?? []).filter((e: any) =>
          !wantedTag || (e.payload?.tag === wantedTag)
        );
        const leadIds = Array.from(new Set(matching.map((e: any) => e.lead_id)));
        if (leadIds.length) {
          const { data: leads } = await supabase
            .from("leads")
            .select("id, clinic_id, name, email, phone")
            .in("id", leadIds)
            .eq("clinic_id", auto.clinic_id)
            .not("email", "is", null);
          const byId = new Map((leads ?? []).map((l: any) => [l.id, l]));
          candidates = matching
            .filter((e: any) => byId.has(e.lead_id))
            .map((e: any) => ({
              lead: byId.get(e.lead_id) as LeadRow,
              source_event: `lead_event:${e.id}`,
            }));
        }
      }
    } catch (e) {
      console.error(`[automation ${auto.id}] candidate query failed:`, e);
      return result;
    }

    // 2) deduplica candidatos por lead — basta o primeiro evento
    const uniqueByLead = new Map<string, { lead: LeadRow; source_event: string }>();
    for (const c of candidates) if (!uniqueByLead.has(c.lead.id)) uniqueByLead.set(c.lead.id, c);

    for (const { lead, source_event } of uniqueByLead.values()) {
      // 3) tenta enrolar (1 enrollment por automation+lead)
      const { data: enrollment, error: enrollErr } = await supabase
        .from("email_automation_enrollments")
        .insert({
          clinic_id: auto.clinic_id,
          automation_id: auto.id,
          lead_id: lead.id,
          recipient_email: lead.email!,
          source_event,
        })
        .select("id")
        .single();

      if (enrollErr) {
        // unique violation = já estava enrolado, normal — pula em silêncio
        if ((enrollErr as any).code !== "23505") {
          console.error(`[automation ${auto.id}] enroll failed for lead ${lead.id}:`, enrollErr.message);
        }
        result.skipped++;
        continue;
      }

      // 4) enfileira todos os steps de uma vez com o delay relativo a agora
      let enqueuedForLead = 0;
      const baseTs = Date.now();
      for (const step of steps) {
        const scheduledAt = new Date(baseTs + (step.delay_minutes ?? 0) * 60_000).toISOString();
        const { error: qErr } = await supabase.rpc("enqueue_email", {
          _clinic_id: auto.clinic_id,
          _template_slug: step.template_slug,
          _recipient_email: lead.email!,
          _recipient_name: lead.name ?? null,
          _variables: {
            name: lead.name ?? "",
            lead_id: lead.id,
            automation_id: auto.id,
            automation_name: auto.name,
          },
          _scheduled_at: scheduledAt,
          _related_lead_id: lead.id,
          _related_lead_table: `automation_${auto.id}`,
          _force_send: false,
        });
        if (qErr) {
          console.error(`[automation ${auto.id}] enqueue failed (lead ${lead.id}, slug ${step.template_slug}):`, qErr.message);
        } else {
          enqueuedForLead++;
        }
      }

      await supabase
        .from("email_automation_enrollments")
        .update({ steps_enqueued: enqueuedForLead })
        .eq("id", (enrollment as any).id);

      result.enrolled++;
      result.enqueued += enqueuedForLead;
    }

    // 5) avança o cursor da automação
    await supabase.from("email_automations").update({ last_run_at: nowIso }).eq("id", auto.id);

    return result;
  };

  // executa em chunks paralelos
  const list = automations as Automation[];
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const slice = list.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((a) => processAutomation(a).catch((e) => {
      console.error(`[automation ${a.id}] crashed:`, e);
      return { id: a.id, enrolled: 0, enqueued: 0, skipped: 0 };
    })));
    for (const r of results) {
      perAutomation.push(r);
      enrolledTotal += r.enrolled;
      enqueuedTotal += r.enqueued;
    }
  }

  return jsonResponse({
    processed: automations.length,
    enrolled: enrolledTotal,
    enqueued: enqueuedTotal,
    per_automation: perAutomation,
  });
});
