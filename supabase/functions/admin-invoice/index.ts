import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ações de fatura para super admin.
// body.action: 'create' | 'mark_paid' | 'void' | 'delete'
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: superRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "super_admin").maybeSingle();
    if (!superRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "create") {
      const { clinic_id, amount_brl, status, due_date, paid_at, payment_method, period_start, period_end, description, notes } = body;
      if (!clinic_id || amount_brl == null) {
        return new Response(JSON.stringify({ error: "clinic_id e amount_brl obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: sub } = await admin.from("clinic_subscriptions").select("id, plan_id").eq("clinic_id", clinic_id).eq("is_current", true).maybeSingle();
      const insertRow: any = {
        clinic_id,
        subscription_id: sub?.id ?? null,
        plan_id: sub?.plan_id ?? null,
        amount_brl: Number(amount_brl),
        status: status ?? "open",
        due_date: due_date ?? null,
        paid_at: status === "paid" ? (paid_at ?? new Date().toISOString()) : (paid_at ?? null),
        payment_method: payment_method ?? null,
        period_start: period_start ?? null,
        period_end: period_end ?? null,
        description: description ?? null,
        notes: notes ?? null,
        created_by: userData.user.id,
      };
      const { data, error } = await admin.from("invoices").insert(insertRow).select("*").single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, invoice: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "mark_paid") {
      const { invoice_id, payment_method, paid_at } = body;
      const { error } = await admin.from("invoices").update({
        status: "paid",
        paid_at: paid_at ?? new Date().toISOString(),
        payment_method: payment_method ?? null,
      }).eq("id", invoice_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "void") {
      const { error } = await admin.from("invoices").update({ status: "void" }).eq("id", body.invoice_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { error } = await admin.from("invoices").delete().eq("id", body.invoice_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("admin-invoice error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
