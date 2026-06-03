// Super admin posts a human reply into a support thread, or toggles takeover.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // super admin check
    const { data: isAdmin } = await userClient.rpc("is_super_admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "reply";
    const threadId: string = String(body?.thread_id ?? "");
    if (!threadId) return json({ error: "thread_id obrigatório" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "takeover") {
      await admin.from("support_chat_threads")
        .update({ taken_over_by: userId, taken_over_at: new Date().toISOString() })
        .eq("id", threadId);
      await admin.from("support_chat_messages").insert({
        thread_id: threadId, role: "system", content: "👤 Um atendente humano entrou na conversa.",
        tool_name: "human_takeover",
      });
      return json({ ok: true });
    }

    if (action === "release") {
      await admin.from("support_chat_threads")
        .update({ taken_over_by: null, taken_over_at: null })
        .eq("id", threadId);
      await admin.from("support_chat_messages").insert({
        thread_id: threadId, role: "system", content: "🤖 O atendente humano saiu — a IA voltou a responder.",
        tool_name: "human_release",
      });
      return json({ ok: true });
    }

    if (action === "reply") {
      const content: string = String(body?.content ?? "").trim();
      if (!content) return json({ error: "content vazio" }, 400);
      // ensure thread is in takeover; if not, auto-takeover for safety
      const { data: t } = await admin.from("support_chat_threads")
        .select("taken_over_at").eq("id", threadId).maybeSingle();
      if (!t) return json({ error: "Thread não encontrada" }, 404);
      if (!t.taken_over_at) {
        await admin.from("support_chat_threads")
          .update({ taken_over_by: userId, taken_over_at: new Date().toISOString() })
          .eq("id", threadId);
      }
      const { data: msg, error } = await admin.from("support_chat_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content,
        tool_name: "human",
        tool_result: { admin_user_id: userId } as any,
      }).select("id").single();
      if (error) throw new Error(error.message);
      await admin.from("support_chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
      return json({ ok: true, message_id: msg.id });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("support-admin-reply error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
