import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const { clinic_id, email, role } = body ?? {};
    if (!clinic_id || !email) {
      return new Response(JSON.stringify({ error: "clinic_id and email are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const inviteRole = ["owner", "admin", "professional", "viewer"].includes(role) ? role : "owner";

    // Authorization: super_admin OR clinic admin/owner of the clinic
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: superRow }, { data: memberRow }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle(),
      admin.from("clinic_members").select("role, clinic_id").eq("user_id", userId).maybeSingle(),
    ]);
    const isSuper = !!superRow;
    const isClinicAdmin = memberRow?.clinic_id === clinic_id && (memberRow?.role === "owner" || memberRow?.role === "admin");
    if (!isSuper && !isClinicAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create invite
    const { data: invite, error: inviteErr } = await admin
      .from("clinic_invites")
      .insert({ clinic_id, email: email.toLowerCase(), role: inviteRole, invited_by: userId })
      .select("token, expires_at")
      .single();
    if (inviteErr) throw inviteErr;

    const { data: clinic } = await admin.from("clinics").select("name").eq("id", clinic_id).single();

    const origin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/$/, "") ?? "https://crm.mkart.com.br";
    const inviteUrl = `${origin.replace(/\/$/, "")}/invite/${invite!.token}`;

    // Send email via Resend gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    let emailError: string | null = null;
    if (LOVABLE_API_KEY && RESEND_API_KEY) {
      const resp = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "MKart CRM <onboarding@resend.dev>",
          to: [email],
          subject: `Convite para ${clinic?.name ?? "clínica"} no MKart CRM`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2 style="color:#0f172a">Você foi convidado(a)</h2>
              <p>Olá! Você recebeu um convite para acessar <strong>${clinic?.name ?? "uma clínica"}</strong> no MKart CRM como <strong>${inviteRole}</strong>.</p>
              <p style="margin:24px 0">
                <a href="${inviteUrl}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Aceitar convite</a>
              </p>
              <p style="color:#64748b;font-size:12px">Ou copie este link: <br/>${inviteUrl}</p>
              <p style="color:#94a3b8;font-size:12px;margin-top:24px">O convite expira em 7 dias.</p>
            </div>`,
        }),
      });
      if (!resp.ok) {
        emailError = `Resend ${resp.status}: ${await resp.text()}`;
      } else {
        emailSent = true;
      }
    } else {
      emailError = "Email não enviado (RESEND_API_KEY/LOVABLE_API_KEY ausente). Compartilhe o link manualmente.";
    }

    return new Response(JSON.stringify({ ok: true, invite_url: inviteUrl, email_sent: emailSent, email_error: emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("clinic-invite error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
