// Run all evals for an agent and persist pass/fail.
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();
  try {
    const { agent_id } = await req.json();
    if (!agent_id) return json({ error: "agent_id required" }, 400);
    const { data: evals } = await supabase.from("agent_evals").select("*").eq("agent_id", agent_id);
    const results: any[] = [];
    for (const ev of evals ?? []) {
      const r = await fetch(`${FUNCTIONS_URL}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ agent_id, messages: [{ role: "user", content: ev.prompt }] }),
      });
      const d = await r.json();
      const content = String(d.content ?? "");
      const passed = (ev.expected_contains ?? []).every((s: string) =>
        content.toLowerCase().includes(s.toLowerCase()),
      );
      await supabase.from("agent_evals").update({
        last_run_at: new Date().toISOString(), last_passed: passed, last_response: content.slice(0, 2000),
      }).eq("id", ev.id);
      results.push({ id: ev.id, passed, response: content.slice(0, 400) });
    }
    const passed = results.filter((r) => r.passed).length;
    return json({ ok: true, total: results.length, passed, results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
