// outreach-recovery-tick — cron diário (04:00 BRT).
//
// Mantém 3 cohorts de leads que perderam o ciclo de outreach/reativação,
// expondo-os como (a) tags em leads.tags e (b) contatos em
// email_segment_contacts. Isso permite plugar diretamente em:
//   - email_automations (trigger_type='lead_tag_added' ou 'segment_contact_added')
//   - message_sequences (trigger_type='lead_tag_added' via tag espelho)
//
// Cohorts (por clínica, leads não arquivados, não-internos, sem manual_lock_until ativo):
//
//   B22 — audit:b22_form_no_outreach
//     form_source IS NOT NULL
//     E NUNCA recebeu mensagem outbound real (is_auto_reply=false).
//
//   B23 — audit:b23_hot_leads_buried
//     stage ∈ {Paciente antigo, Nutrição de Leads Inativos}
//     E custom_fields->>procedimento_interesse ∈ {cetamina, emt}
//     E NUNCA enviou mensagem (from_me=false) — nunca conversou com a gente.
//
//   B28 — audit:b28_no_initial_outreach
//     stage ∈ {lead parou de responder, Não respondeu}
//     E NUNCA recebeu mensagem outbound real.
//
// Sincronização idempotente:
//   - novos matches → adiciona tag + (se tem email) row em email_segment_contacts
//   - leads que saíram do match → remove tag + remove row
//
// Trigger: cron diário OU POST { clinic_id?, dry_run? }.

import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const TAG_PREFIX = "audit:";
const MAX_PER_COHORT = 2000;

interface Cohort {
  key: "b22" | "b23" | "b28";
  systemKey: string;
  tag: string;
  stageNames: string[] | null;
  matchFn: (lead: LeadCandidate) => boolean;
}

interface LeadCandidate {
  id: string;
  clinic_id: string;
  stage_name: string | null;
  custom_fields: Record<string, unknown> | null;
  email: string | null;
  name: string | null;
  form_source: string | null;
  tags: string[] | null;
  has_outbound_real: boolean;
  has_inbound: boolean;
}

const COHORTS: Cohort[] = [
  {
    key: "b22",
    systemKey: "audit:b22_form_no_outreach",
    tag: `${TAG_PREFIX}b22`,
    stageNames: null,
    matchFn: (l) => !!l.form_source && !l.has_outbound_real,
  },
  {
    key: "b23",
    systemKey: "audit:b23_hot_leads_buried",
    tag: `${TAG_PREFIX}b23`,
    stageNames: ["Paciente antigo", "Nutrição de Leads Inativos"],
    matchFn: (l) => {
      const interesse = String((l.custom_fields ?? {})["procedimento_interesse"] ?? "").toLowerCase();
      return (interesse === "cetamina" || interesse === "emt") && !l.has_inbound;
    },
  },
  {
    key: "b28",
    systemKey: "audit:b28_no_initial_outreach",
    tag: `${TAG_PREFIX}b28`,
    stageNames: ["lead parou de responder", "Não respondeu"],
    matchFn: (l) => !l.has_outbound_real,
  },
];

async function loadSegmentMap(supabase: ReturnType<typeof sb>, clinicId: string) {
  const { data } = await supabase
    .from("email_segments")
    .select("id, system_key")
    .eq("clinic_id", clinicId)
    .eq("is_system", true)
    .in("system_key", COHORTS.map((c) => c.systemKey));
  const map = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ id: string; system_key: string }>) {
    map.set(r.system_key, r.id);
  }
  return map;
}

async function loadStageIds(supabase: ReturnType<typeof sb>, clinicId: string) {
  const { data } = await supabase
    .from("pipeline_stages")
    .select("id, name, pipelines!inner(clinic_id)")
    .eq("pipelines.clinic_id", clinicId);
  const byName = new Map<string, string[]>();
  for (const s of (data ?? []) as Array<{ id: string; name: string }>) {
    const arr = byName.get(s.name) ?? [];
    arr.push(s.id);
    byName.set(s.name, arr);
  }
  return byName;
}

async function loadCandidates(
  supabase: ReturnType<typeof sb>,
  clinicId: string,
  stageIds: string[] | null,
): Promise<LeadCandidate[]> {
  let q = supabase
    .from("leads")
    .select("id, clinic_id, stage_id, custom_fields, email, name, form_source, tags, archived_at, is_internal_contact")
    .eq("clinic_id", clinicId)
    .is("archived_at", null)
    .eq("is_internal_contact", false)
    .limit(MAX_PER_COHORT);
  if (stageIds) q = q.in("stage_id", stageIds);
  const { data: leads } = await q;
  const rows = (leads ?? []) as Array<{
    id: string; clinic_id: string; stage_id: string | null;
    custom_fields: Record<string, unknown> | null;
    email: string | null; name: string | null; form_source: string | null;
    tags: string[] | null;
  }>;
  // PR4 — manual_lock_until removido; sem filtro de lock.
  const filtered = rows;
  if (filtered.length === 0) return [];

  const ids = filtered.map((l) => l.id);
  // Bulk: descobre quem tem outbound real e quem tem inbound.
  const { data: msgs } = await supabase
    .from("messages")
    .select("lead_id, from_me, is_auto_reply")
    .in("lead_id", ids)
    .limit(50000);
  const outboundReal = new Set<string>();
  const inbound = new Set<string>();
  for (const m of (msgs ?? []) as Array<{ lead_id: string; from_me: boolean; is_auto_reply: boolean }>) {
    if (m.from_me === true && m.is_auto_reply === false) outboundReal.add(m.lead_id);
    if (m.from_me === false) inbound.add(m.lead_id);
  }

  // Mapa stage_id → stage_name (apenas as stages relevantes — pego do nosso lookup).
  // Aqui simplificamos: passamos stage_name=null e cada cohort filtra por stageIds antes.
  return filtered.map((l) => ({
    id: l.id,
    clinic_id: l.clinic_id,
    stage_name: null,
    custom_fields: l.custom_fields,
    email: l.email,
    name: l.name,
    form_source: l.form_source,
    tags: l.tags,
    has_outbound_real: outboundReal.has(l.id),
    has_inbound: inbound.has(l.id),
  }));
}

interface SyncResult {
  cohort: string;
  matches: number;
  tags_added: number;
  tags_removed: number;
  segment_added: number;
  segment_removed: number;
  no_segment?: boolean;
}

async function syncCohort(
  supabase: ReturnType<typeof sb>,
  clinicId: string,
  cohort: Cohort,
  segmentId: string | undefined,
  stageNameMap: Map<string, string[]>,
  dryRun: boolean,
): Promise<SyncResult> {
  const stageIds = cohort.stageNames
    ? cohort.stageNames.flatMap((n) => stageNameMap.get(n) ?? [])
    : null;
  if (cohort.stageNames && (!stageIds || stageIds.length === 0)) {
    return { cohort: cohort.key, matches: 0, tags_added: 0, tags_removed: 0, segment_added: 0, segment_removed: 0 };
  }
  const candidates = await loadCandidates(supabase, clinicId, stageIds);
  const matches = candidates.filter((c) => cohort.matchFn(c));
  const result: SyncResult = {
    cohort: cohort.key,
    matches: matches.length,
    tags_added: 0,
    tags_removed: 0,
    segment_added: 0,
    segment_removed: 0,
  };

  const matchIds = new Set(matches.map((m) => m.id));

  // 1) leads que precisam GANHAR a tag
  for (const lead of matches) {
    const hasTag = (lead.tags ?? []).includes(cohort.tag);
    if (hasTag) continue;
    result.tags_added++;
    if (dryRun) continue;
    const nextTags = Array.from(new Set([...(lead.tags ?? []), cohort.tag]));
    await supabase.from("leads").update({ tags: nextTags }).eq("id", lead.id);
  }

  // 2) leads atualmente tagueados que NÃO estão mais no match → remover tag
  const { data: currentlyTagged } = await supabase
    .from("leads")
    .select("id, tags")
    .eq("clinic_id", clinicId)
    .contains("tags", [cohort.tag])
    .limit(MAX_PER_COHORT * 2);
  for (const lead of (currentlyTagged ?? []) as Array<{ id: string; tags: string[] | null }>) {
    if (matchIds.has(lead.id)) continue;
    result.tags_removed++;
    if (dryRun) continue;
    const nextTags = (lead.tags ?? []).filter((t) => t !== cohort.tag);
    await supabase.from("leads").update({ tags: nextTags }).eq("id", lead.id);
  }

  // 3) email_segment_contacts (apenas leads com email)
  if (!segmentId) {
    result.no_segment = true;
    return result;
  }
  const withEmail = matches.filter((m) => !!m.email && m.email.includes("@"));
  const { data: existing } = await supabase
    .from("email_segment_contacts")
    .select("id, lead_id, email")
    .eq("segment_id", segmentId)
    .limit(MAX_PER_COHORT * 2);
  const existingByLead = new Map<string, { id: string; email: string }>();
  const existingByEmail = new Set<string>();
  for (const r of (existing ?? []) as Array<{ id: string; lead_id: string | null; email: string }>) {
    if (r.lead_id) existingByLead.set(r.lead_id, { id: r.id, email: r.email });
    existingByEmail.add(r.email.toLowerCase());
  }
  // add
  const toInsert: Array<{ clinic_id: string; segment_id: string; lead_id: string; email: string; name: string | null }> = [];
  for (const lead of withEmail) {
    if (existingByLead.has(lead.id)) continue;
    if (existingByEmail.has(lead.email!.toLowerCase())) continue;
    toInsert.push({
      clinic_id: clinicId,
      segment_id: segmentId,
      lead_id: lead.id,
      email: lead.email!,
      name: lead.name,
    });
  }
  result.segment_added = toInsert.length;
  if (!dryRun && toInsert.length > 0) {
    // batch em chunks de 500
    for (let i = 0; i < toInsert.length; i += 500) {
      await supabase.from("email_segment_contacts").insert(toInsert.slice(i, i + 500));
    }
  }
  // remove (lead saiu do match)
  const toRemove: string[] = [];
  for (const [leadId, row] of existingByLead) {
    if (!matchIds.has(leadId)) toRemove.push(row.id);
  }
  result.segment_removed = toRemove.length;
  if (!dryRun && toRemove.length > 0) {
    for (let i = 0; i < toRemove.length; i += 500) {
      await supabase.from("email_segment_contacts").delete().in("id", toRemove.slice(i, i + 500));
    }
  }

  return result;
}

async function processClinic(clinicId: string, dryRun: boolean) {
  const supabase = sb();
  const segMap = await loadSegmentMap(supabase, clinicId);
  const stageMap = await loadStageIds(supabase, clinicId);
  const out: SyncResult[] = [];
  for (const cohort of COHORTS) {
    out.push(await syncCohort(supabase, clinicId, cohort, segMap.get(cohort.systemKey), stageMap, dryRun));
  }
  return { clinic_id: clinicId, cohorts: out };
}

interface Body { clinic_id?: string; dry_run?: boolean; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }
  const supabase = sb();
  let cq = supabase.from("email_segments").select("clinic_id").eq("is_system", true).like("system_key", "audit:%");
  if (body.clinic_id) cq = cq.eq("clinic_id", body.clinic_id);
  const { data, error } = await cq;
  if (error) return json({ error: error.message }, 500);
  const clinicIds = Array.from(new Set((data ?? []).map((r: { clinic_id: string }) => r.clinic_id)));
  const dryRun = !!body.dry_run;
  const results: unknown[] = [];
  for (const cid of clinicIds) {
    try { results.push(await processClinic(cid, dryRun)); }
    catch (e) { results.push({ clinic_id: cid, error: e instanceof Error ? e.message : String(e) }); }
  }
  return json({ ok: true, dry_run: dryRun, results });
});
