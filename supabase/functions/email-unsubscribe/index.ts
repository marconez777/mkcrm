// Edge Function: email-unsubscribe
// Endpoint público: valida token HMAC e descadastra o email da clínica.
// Cancela jobs pendentes em cascata.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/email.ts";

const ALLOWED_REASONS = new Set(["too-many", "not-interested", "never-signed", "other", "user-request"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = (body.action ?? "unsubscribe") as "unsubscribe" | "reactivate" | "validate";
    const clinic_id = typeof body.clinic_id === "string" ? body.clinic_id : "";
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const token = typeof body.token === "string" ? body.token : "";
    const reason = ALLOWED_REASONS.has(body.reason) ? body.reason : "not-interested";

    if (!clinic_id || !email || !token || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      return jsonResponse({ error: "Invalid input" }, { status: 400 });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: valid } = await admin.rpc("verify_unsubscribe_token", {
      _clinic_id: clinic_id,
      _email: email,
      _token: token,
    });
    if (!valid) return jsonResponse({ error: "Invalid token" }, { status: 403 });

    if (action === "validate") return jsonResponse({ ok: true });

    if (action === "reactivate") {
      await admin.from("email_unsubscribes").delete().eq("clinic_id", clinic_id).eq("email", email);
      return jsonResponse({ ok: true });
    }

    await admin.from("email_unsubscribes").upsert(
      { clinic_id, email, reason, source: "user-link" },
      { onConflict: "clinic_id,email" },
    );

    // Cascata: cancela jobs pendentes daquela clínica para esse email (exceto force_send)
    await admin
      .from("email_queue")
      .update({ status: "cancelled", error: "recipient unsubscribed", updated_at: new Date().toISOString() })
      .eq("clinic_id", clinic_id)
      .eq("recipient_email", email)
      .eq("status", "pending")
      .eq("force_send", false);

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("email-unsubscribe error:", e);
    return jsonResponse({ error: "Internal error" }, { status: 500 });
  }
});
