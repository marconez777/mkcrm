// pipeline-shadow-build — F3 da reestruturação do pipeline da Clínica ÓR.
// Ver docs/roadmap/PIPELINE_RESTRUCTURE_2026_06.md §6 (Estratégia pipeline-sombra).
//
// O que faz:
//   - "create": para cada lead do pipeline ORIGEM (shadow_of_lead_id IS NULL) que ainda
//     não tenha shadow no pipeline DESTINO, cria 1 shadow clonado com
//     shadow_of_lead_id=original.id, pipeline_id=destino e stage_id inicial
//     derivado deterministicamente do stage atual (mapa §3).
//   - "extract": enfileira os shadows "não-óbvios" (pacientes/qualificação) para o
//     extractor-tick e roda em batches, respeitando teto de custo (US$ aproximado
//     via #runs * cost_per_run_usd). Mensagens são lidas do lead original.
//   - "rules": chama field-rules-tick com force=true sobre os shadows criados,
//     para que as regras prio≥80 do pipeline novo reposicionem os cards.
//   - "all": create → extract → rules (em sequência, com batching).
//
// Segurança:
//   - apenas service-role (chamadas internas) ou super-admin podem invocar.
//   - dry_run=true não escreve nada.
//   - idempotente: re-rodar "create" não duplica shadows.

import { corsHeaders, json, sb } from "../_shared/evolution.ts";

interface Body {
  clinic_id: string;
  source_pipeline_id: string;
  target_pipeline_id: string;
  mode?: "create" | "extract" | "rules" | "all";
  batch_size?: number;     // default 30 (limite do extractor por chamada)
  max_leads?: number;      // default 9999 — total a processar nesta invocação
  cost_limit_usd?: number; // default 2.80 — halt em "extract" quando ultrapassa
  cost_per_run_usd?: number; // default 0.0015 — estimativa por extração
  dry_run?: boolean;
}

// Mapa nome-do-stage-atual → nome-do-stage-novo (vê §3 do roadmap).
const STAGE_NAME_MAP: Record<string, string> = {
  "Leads de entrada": "Leads de entrada",
  "Paciente antigo": "Paciente antigo",
  "Retorno Tratamento Finalizado": "Paciente antigo",
  "Qualificação": "Qualificação",
  "Fechamento pendente consulta": "Qualificação",
  "Fechamento pendente procedimento": "Qualificação",
  "Consulta Agendada": "Consulta agendada",
  "Consulta finalizada": "Consulta finalizada",
  "Procedimento Agendado": "Procedimento agendado",
  "Procedimento pago": "Procedimento pago",
  "Antigo Consulta/procedimento agendado": "Consulta agendada",
  "lead parou de responder": "Sem resposta",
  "Lead não qualificado": "Desqualificado / Fora de escopo",
  "Nutrição de Leads Inativos": "Nutrição inativa",
  "Administrativo": "B2B / Stakeholders",
};

// Stages cujos shadows DEVEM passar pelo extractor (não-óbvios).
const NEEDS_EXTRACTION_FROM = new Set<string>([
  "Leads de entrada",
  "Paciente antigo",
  "Qualificação",
  "Fechamento pendente consulta",
  "Fechamento pendente procedimento",
  "Retorno Tratamento Finalizado",
  "Antigo Consulta/procedimento agendado",
  "Consulta finalizada",
]);

interface SourceLead {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  custom_fields: Record<string, unknown> | null;
  stage_id: string | null;
  tags: string[];
  is_internal_contact: boolean;
  whatsapp_instance_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  attendant_id: string | null;
}

async function doCreate(
  supabase: ReturnType<typeof sb>,
  body: Required<Pick<Body, "clinic_id" | "source_pipeline_id" | "target_pipeline_id">> & { dry_run: boolean; max_leads: number },
) {
  // 1) carrega stages de origem e destino, por nome
  const [{ data: srcStages }, { data: dstStages }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name").eq("pipeline_id", body.source_pipeline_id),
    supabase.from("pipeline_stages").select("id, name").eq("pipeline_id", body.target_pipeline_id),
  ]);
  if (!srcStages?.length) return { error: "source pipeline has no stages" };
  if (!dstStages?.length) return { error: "target pipeline has no stages" };

  const srcById = new Map((srcStages as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const dstByName = new Map((dstStages as { id: string; name: string }[]).map((s) => [s.name, s.id]));

  // valida mapeamento
  const missing: string[] = [];
  for (const target of new Set(Object.values(STAGE_NAME_MAP))) {
    if (!dstByName.has(target)) missing.push(target);
  }
  if (missing.length) return { error: `missing target stages: ${missing.join(", ")}` };

  // 2) leads do pipeline origem sem shadow ainda — pagina em chunks de 1000
  //    (PostgREST limita por max-rows ~1000 por request).
  const PAGE = 1000;
  const leads: SourceLead[] = [];
  let from = 0;
  while (leads.length < body.max_leads) {
    const to = from + PAGE - 1;
    const { data: page, error: leadsErr } = await supabase
      .from("leads")
      .select("id, phone, name, email, custom_fields, stage_id, tags, is_internal_contact, whatsapp_instance_id, utm_source, utm_medium, utm_campaign, attendant_id")
      .eq("clinic_id", body.clinic_id)
      .eq("pipeline_id", body.source_pipeline_id)
      .is("shadow_of_lead_id", null)
      .order("created_at", { ascending: true })
      .range(from, to);
    if (leadsErr) return { error: leadsErr.message };
    const rows = (page ?? []) as SourceLead[];
    leads.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }


  const { data: existingShadows } = await supabase
    .from("leads")
    .select("shadow_of_lead_id")
    .eq("clinic_id", body.clinic_id)
    .eq("pipeline_id", body.target_pipeline_id)
    .not("shadow_of_lead_id", "is", null);
  const alreadyShadowed = new Set(
    (existingShadows ?? []).map((r: any) => r.shadow_of_lead_id as string),
  );

  const toInsert: any[] = [];
  const perStage: Record<string, number> = {};
  let unmapped = 0;

  for (const l of leads as SourceLead[]) {
    if (alreadyShadowed.has(l.id)) continue;
    const srcName = l.stage_id ? srcById.get(l.stage_id) : null;
    if (!srcName) { unmapped++; continue; }
    const dstName = STAGE_NAME_MAP[srcName];
    if (!dstName) { unmapped++; continue; }
    const dstStageId = dstByName.get(dstName)!;
    perStage[dstName] = (perStage[dstName] ?? 0) + 1;

    toInsert.push({
      clinic_id: body.clinic_id,
      pipeline_id: body.target_pipeline_id,
      stage_id: dstStageId,
      shadow_of_lead_id: l.id,
      phone: l.phone,
      name: l.name,
      email: l.email,
      custom_fields: l.custom_fields ?? {},
      tags: Array.from(new Set([...(l.tags ?? []), "shadow"])),
      is_internal_contact: l.is_internal_contact,
      whatsapp_instance_id: l.whatsapp_instance_id,
      utm_source: l.utm_source,
      utm_medium: l.utm_medium,
      utm_campaign: l.utm_campaign,
      attendant_id: l.attendant_id,
      // marca pra extractor decidir depois (filtrado pelo NEEDS_EXTRACTION_FROM)
      needs_ai_review: NEEDS_EXTRACTION_FROM.has(srcName) && !l.is_internal_contact,
      ai_review_queued_at: NEEDS_EXTRACTION_FROM.has(srcName) && !l.is_internal_contact
        ? new Date().toISOString() : null,
      ai_review_reasons: NEEDS_EXTRACTION_FROM.has(srcName) ? ["shadow_build_2026_06"] : [],
    });
  }

  if (body.dry_run) {
    return {
      mode: "create", dry_run: true,
      source_total: leads.length,
      already_shadowed: alreadyShadowed.size,
      to_insert: toInsert.length,
      unmapped, per_target_stage: perStage,
    };
  }

  // insert em batches de 200 (limite seguro do PostgREST)
  let inserted = 0;
  const insertedIds: string[] = [];
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { data, error } = await supabase
      .from("leads").insert(chunk).select("id, custom_fields, needs_ai_review");
    if (error) return { error: error.message, inserted };
    inserted += data?.length ?? 0;
    for (const r of (data ?? []) as { id: string; needs_ai_review: boolean }[]) {
      if (r.needs_ai_review) insertedIds.push(r.id);
    }
  }

  return {
    mode: "create",
    inserted,
    queued_for_extraction: insertedIds.length,
    unmapped,
    per_target_stage: perStage,
    enqueued_ids: insertedIds,
  };
}

async function doExtract(
  supabase: ReturnType<typeof sb>,
  body: Required<Pick<Body, "clinic_id" | "target_pipeline_id">> & {
    batch_size: number; max_leads: number; cost_limit_usd: number; cost_per_run_usd: number; dry_run: boolean;
  },
) {
  // Pega shadows enfileirados pra extração no pipeline destino
  const { data: queued, error } = await supabase
    .from("leads")
    .select("id")
    .eq("clinic_id", body.clinic_id)
    .eq("pipeline_id", body.target_pipeline_id)
    .not("shadow_of_lead_id", "is", null)
    .eq("needs_ai_review", true)
    .order("ai_review_queued_at", { ascending: true })
    .limit(body.max_leads);
  if (error) return { error: error.message };

  const ids = (queued ?? []).map((r: any) => r.id as string);
  if (ids.length === 0) return { mode: "extract", processed: 0, batches: 0, cost_estimate_usd: 0 };

  if (body.dry_run) {
    return {
      mode: "extract", dry_run: true,
      pending: ids.length,
      planned_batches: Math.ceil(ids.length / body.batch_size),
      estimated_cost_usd: Number((ids.length * body.cost_per_run_usd).toFixed(4)),
      cost_limit_usd: body.cost_limit_usd,
    };
  }

  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/extractor-tick`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let processed = 0;
  let batches = 0;
  let estCost = 0;
  const errors: string[] = [];

  for (let i = 0; i < ids.length; i += body.batch_size) {
    if (estCost + body.batch_size * body.cost_per_run_usd > body.cost_limit_usd) {
      return {
        mode: "extract", halted_for_budget: true,
        processed, batches, cost_estimate_usd: Number(estCost.toFixed(4)),
        remaining: ids.length - i,
      };
    }
    const slice = ids.slice(i, i + body.batch_size);
    const r = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({ clinic_id: body.clinic_id, lead_ids: slice, force: true }),
    });
    const txt = await r.text();
    batches++;
    if (!r.ok) {
      errors.push(`batch ${batches}: HTTP ${r.status} ${txt.slice(0, 200)}`);
      continue;
    }
    processed += slice.length;
    estCost += slice.length * body.cost_per_run_usd;
  }

  return {
    mode: "extract", processed, batches,
    cost_estimate_usd: Number(estCost.toFixed(4)),
    errors,
  };
}

async function doRules(
  supabase: ReturnType<typeof sb>,
  body: Required<Pick<Body, "clinic_id" | "target_pipeline_id">> & { max_leads: number; dry_run: boolean },
) {
  const { data: shadows, error } = await supabase
    .from("leads")
    .select("id")
    .eq("clinic_id", body.clinic_id)
    .eq("pipeline_id", body.target_pipeline_id)
    .not("shadow_of_lead_id", "is", null)
    .limit(body.max_leads);
  if (error) return { error: error.message };

  const ids = (shadows ?? []).map((r: any) => r.id as string);
  if (ids.length === 0) return { mode: "rules", evaluated: 0 };
  if (body.dry_run) return { mode: "rules", dry_run: true, would_evaluate: ids.length };

  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/field-rules-tick`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // field-rules-tick limita a 500 leads por clínica por chamada; chunkamos.
  let totalMoved = 0;
  let totalEvaluated = 0;
  const errors: string[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const r = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({ clinic_id: body.clinic_id, lead_ids: slice }),
    });
    const txt = await r.text();
    if (!r.ok) { errors.push(`HTTP ${r.status} ${txt.slice(0, 200)}`); continue; }
    try {
      const j = JSON.parse(txt);
      for (const res of (j.results ?? [])) {
        totalMoved += res.moved ?? 0;
        totalEvaluated += res.evaluated ?? 0;
      }
    } catch { /* ignore */ }
  }

  return { mode: "rules", evaluated: totalEvaluated, moved: totalMoved, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // requer service-role OU usuário autenticado da própria clínica
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  let authorized = !!token && token === serviceKey;

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }

  if (!authorized && token) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      anonKey,
      { global: { headers: { Authorization: `Bearer ${token}`, apikey: anonKey } } },
    );
    const { data: userRes } = await userClient.auth.getUser(token);
    const userId = userRes?.user?.id ?? null;
    if (userId && body?.clinic_id) {
      // valida via service-role (evita depender de RLS / RPC com auth.uid()):
      const svc = sb();
      const [{ data: mem }, { data: isAdmin }] = await Promise.all([
        svc.from("clinic_members").select("user_id").eq("clinic_id", body.clinic_id).eq("user_id", userId).maybeSingle(),
        svc.rpc("is_super_admin", { _user_id: userId }).then((r) => r).catch(() => ({ data: null })),
      ]);
      if (mem || isAdmin === true) authorized = true;
    }
  }

  if (!authorized) return json({ error: "service-role token or clinic member required" }, 401);



  if (!body.clinic_id || !body.source_pipeline_id || !body.target_pipeline_id) {
    return json({ error: "clinic_id, source_pipeline_id, target_pipeline_id are required" }, 400);
  }
  if (body.source_pipeline_id === body.target_pipeline_id) {
    return json({ error: "source and target pipelines must differ" }, 400);
  }

  const supabase = sb();
  const mode = body.mode ?? "create";
  const opts = {
    clinic_id: body.clinic_id,
    source_pipeline_id: body.source_pipeline_id,
    target_pipeline_id: body.target_pipeline_id,
    batch_size: body.batch_size ?? 30,
    max_leads: body.max_leads ?? 9999,
    cost_limit_usd: body.cost_limit_usd ?? 2.80,
    cost_per_run_usd: body.cost_per_run_usd ?? 0.0015,
    dry_run: body.dry_run ?? false,
  };

  const results: any = { mode, clinic_id: body.clinic_id };

  if (mode === "create" || mode === "all") {
    results.create = await doCreate(supabase, opts);
  }
  if (mode === "extract" || mode === "all") {
    results.extract = await doExtract(supabase, opts);
  }
  if (mode === "rules" || mode === "all") {
    results.rules = await doRules(supabase, opts);
  }

  return json({ ok: true, ...results });
});
