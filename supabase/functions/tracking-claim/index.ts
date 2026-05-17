// Try to claim a tracking session for a lead based on its first inbound message.
// Idempotent: if the lead already has a ref_short / tracking_session_id, returns ok.
//
// Phase C of arquitetura-tracking-site-crm.md:
//  - regex aceita apenas refs de 10 chars (lv_sid.replace(/-/g,'').slice(0,10))
//  - grava leads.ref_short e leads.site_id resolvido via tracking_sites da clínica
//  - enfileira evento `lead.matched` no novo formato (event_id, schema_version, lead{}, data{})
//  - mantém match local (tracking_sessions) e fallback por telefone para tenants `local` futuros
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Ref token: exactamente 10 chars alfanuméricos. \b nas bordas para não capturar lixo grudado.
const REF_RX = /\bref[=:]\s*([A-Za-z0-9]{10})\b/i;

// Map raw utm_source/medium to a friendly origin_source value.
function deriveOrigin(s: { utm_source?: string | null; utm_medium?: string | null; first_referrer?: string | null }): string {
  const src = (s.utm_source || "").toLowerCase();
  const med = (s.utm_medium || "").toLowerCase();
  if (med === "cpc" || med === "ppc" || med === "paid") {
    if (src.includes("google")) return "google_ads";
    if (src.includes("facebook") || src.includes("instagram") || src.includes("meta")) return "meta_ads";
    if (src.includes("tiktok")) return "tiktok_ads";
    return "paid";
  }
  if (med === "organic" || (src && !med)) {
    if (src.includes("google")) return "google_organic";
    if (src.includes("instagram")) return "instagram";
    if (src.includes("facebook")) return "facebook";
  }
  const ref = (s.first_referrer || "").toLowerCase();
  if (ref.includes("google.")) return "google_organic";
  if (ref.includes("instagram.")) return "instagram";
  if (ref.includes("facebook.")) return "facebook";
  if (!ref && !src) return "direct";
  return "referral";
}

function toE164(phoneRaw: string | null | undefined): string | null {
  if (!phoneRaw) return null;
  const s = String(phoneRaw);
  return s.startsWith("+") ? s : "+" + s.replace(/\D/g, "");
}

async function kickDispatcher(deliveryId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/external-webhook-dispatcher`;
  // @ts-ignore EdgeRuntime
  (globalThis as any).EdgeRuntime?.waitUntil(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify({ id: deliveryId }),
    }).catch((e) => console.error("dispatch immediate fail", e)),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const { lead_id, ref: refOverride, manual_session_id } = await req.json();
    if (!lead_id) return json({ error: "missing lead_id" }, 400);
    const supabase = sb();

    const { data: lead } = await supabase
      .from("leads")
      .select("id, clinic_id, phone, name, email, tracking_session_id, ref_short, site_id, origin_source, origin_confidence")
      .eq("id", lead_id)
      .maybeSingle();
    if (!lead) return json({ error: "lead not found" }, 404);

    // Manual link by secretary (legacy local flow)
    if (manual_session_id) {
      const { data: sess } = await supabase
        .from("tracking_sessions")
        .select("id, clinic_id, utm_source, utm_medium, first_referrer")
        .eq("id", manual_session_id)
        .eq("clinic_id", lead.clinic_id)
        .maybeSingle();
      if (!sess) return json({ error: "session not found" }, 404);
      const origin = deriveOrigin(sess);
      await supabase.from("leads").update({
        tracking_session_id: sess.id,
        origin_source: origin,
        origin_confidence: "manual",
      }).eq("id", lead.id);
      await supabase.from("tracking_sessions").update({ lead_id: lead.id, claimed_at: new Date().toISOString() }).eq("id", sess.id);
      return json({ ok: true, manual: true, origin });
    }

    // Idempotência: já temos ref_short (remote) ou tracking_session (local) gravado.
    if (lead.ref_short) return json({ ok: true, already: true, reason: "ref_short_present", ref_short: lead.ref_short });
    if (lead.tracking_session_id) return json({ ok: true, already: true, reason: "session_present" });

    // 1) Extrai ref das primeiras mensagens inbound
    let ref: string | null = refOverride ?? null;
    if (!ref) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("content")
        .eq("lead_id", lead.id)
        .eq("from_me", false)
        .not("content", "is", null)
        .order("timestamp", { ascending: true })
        .limit(5);
      for (const m of msgs ?? []) {
        const match = (m.content || "").match(REF_RX);
        if (match) { ref = match[1]; break; }
      }
    }

    // 2) Resolve site `remote` da clínica (Fase 1: só Clínica ÓR é remote)
    const { data: remoteSite } = await supabase
      .from("tracking_sites")
      .select("id, domain")
      .eq("clinic_id", lead.clinic_id)
      .eq("data_residency", "remote")
      .limit(1)
      .maybeSingle();

    // 3) Tenta match local (tracking_sessions) — útil para tenants `local` no futuro
    let target: { id: string; utm_source?: string | null; utm_medium?: string | null; first_referrer?: string | null; ref_short?: string | null } | null = null;
    let confidence: "tracking" | "phone_fallback" = "tracking";

    if (ref) {
      const { data: byRef } = await supabase
        .from("tracking_sessions")
        .select("id, utm_source, utm_medium, first_referrer, ref_short")
        .eq("clinic_id", lead.clinic_id)
        .eq("ref_short", ref.toLowerCase())
        .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byRef) target = byRef;
    }

    // Phone fallback (local): wa_click recente cujo payload.phone bate com o telefone do lead
    if (!target && lead.phone) {
      const phoneDigits = lead.phone.replace(/\D/g, "");
      const since = new Date(Date.now() - 1000 * 60 * 30).toISOString();
      const { data: events } = await supabase
        .from("tracking_events")
        .select("session_id, payload, created_at")
        .eq("clinic_id", lead.clinic_id)
        .eq("type", "wa_click")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100);
      const hit = (events ?? []).find((e: any) => {
        const p = String(e?.payload?.phone_e164 ?? "").replace(/\D/g, "");
        return p && (p === phoneDigits || phoneDigits.endsWith(p) || p.endsWith(phoneDigits));
      });
      if (hit) {
        const { data: sess } = await supabase
          .from("tracking_sessions")
          .select("id, utm_source, utm_medium, first_referrer, ref_short")
          .eq("id", hit.session_id)
          .maybeSingle();
        if (sess) { target = sess; confidence = "phone_fallback"; }
      }
    }

    // 4) Aplica match local se houve
    if (target) {
      const origin = deriveOrigin(target);
      await supabase.from("leads").update({
        tracking_session_id: target.id,
        origin_source: origin,
        origin_confidence: confidence,
      }).eq("id", lead.id);
      await supabase.from("tracking_sessions").update({ lead_id: lead.id, claimed_at: new Date().toISOString() }).eq("id", target.id);
    }

    // 5) Match remoto: se temos `ref` (10 chars) e existe site remoto da clínica
    //    grava ref_short + site_id no lead e enfileira evento `lead.matched`.
    let dispatchedId: string | null = null;
    let refShortStored: string | null = null;
    if (ref && remoteSite) {
      refShortStored = ref;

      // Pega timestamp da 1ª mensagem inbound para occurred_at/first_message_at
      const { data: firstMsg } = await supabase
        .from("messages")
        .select("content, timestamp")
        .eq("lead_id", lead.id)
        .eq("from_me", false)
        .not("content", "is", null)
        .order("timestamp", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Atualiza lead com ref_short + site_id (e confidence se ainda não setado)
      const leadPatch: Record<string, unknown> = {
        ref_short: ref,
        site_id: remoteSite.id,
      };
      if (!lead.origin_confidence) leadPatch.origin_confidence = "external_ref";
      await supabase.from("leads").update(leadPatch).eq("id", lead.id);

      // Monta payload no contrato bridge (HMAC v1 / schema_version 1)
      const phoneE164 = toE164(lead.phone);
      const occurredAt = firstMsg?.timestamp ?? new Date().toISOString();
      const payload = {
        event_id: crypto.randomUUID(),
        type: "lead.matched",
        occurred_at: occurredAt,
        schema_version: 1,
        lead: {
          crm_lead_id: lead.id,
          ref_short: ref,
          phone_e164: phoneE164,
          name: lead.name ?? null,
          email: lead.email ?? null,
        },
        data: {
          first_message: firstMsg?.content ?? null,
          first_message_at: occurredAt,
        },
      };

      // Endpoint legado é preenchido para compatibilidade com o dispatcher antigo,
      // mas o dispatcher novo (Fase D) resolverá a URL a partir de tracking_sites.domain.
      const endpoint = `https://${remoteSite.domain}/functions/v1/crm-lead-event`;

      const { data: ins, error: insErr } = await supabase
        .from("external_webhook_deliveries")
        .insert({
          clinic_id: lead.clinic_id,
          lead_id: lead.id,
          site_id: remoteSite.id,
          type: "lead.matched",
          endpoint,
          payload,
          status: "pending",
          next_attempt_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        console.error("ewd insert fail", insErr);
      } else if (ins?.id) {
        dispatchedId = ins.id;
        await kickDispatcher(ins.id);
      }
    }

    // Resposta consolidada
    if (!target && !dispatchedId) {
      return json({ ok: true, ref, not_found: true });
    }
    return json({
      ok: true,
      ref,
      ref_short_stored: refShortStored,
      session_id: target?.id ?? null,
      site_id: remoteSite?.id ?? null,
      delivery_id: dispatchedId,
      confidence: target ? confidence : (refShortStored ? "external_ref" : null),
    });
  } catch (err) {
    console.error("tracking-claim", err);
    return json({ error: String(err) }, 500);
  }
});
