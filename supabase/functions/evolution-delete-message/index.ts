// Deletes a message: from WhatsApp (for everyone, when possible) and from the DB.
import { corsHeaders, json, sb, loadInstance, evoFetch } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();

  try {
    const { message_id, for_everyone = true } = await req.json();
    if (!message_id) return json({ error: "message_id required" }, 400);

    const { data: msg } = await supabase
      .from("messages")
      .select("id, lead_id, external_id, from_me, raw")
      .eq("id", message_id)
      .maybeSingle();
    if (!msg) return json({ error: "Mensagem não encontrada" }, 404);

    let evolutionStatus: "ok" | "skipped" | "error" = "skipped";
    let evolutionDetail: string | null = null;

    // Tenta apagar no WhatsApp se: enviada por nós, tem external_id e o usuário pediu "para todos".
    if (for_everyone && msg.from_me && msg.external_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("phone, whatsapp_instance_id")
        .eq("id", msg.lead_id)
        .single();
      if (lead) {
        const instance = await loadInstance(lead.whatsapp_instance_id);
        if (instance) {
          try {
            const remoteJid = (msg.raw as any)?.key?.remoteJid ?? `${lead.phone}@s.whatsapp.net`;
            const participant = (msg.raw as any)?.key?.participant;
            const body: any = {
              id: msg.external_id,
              remoteJid,
              fromMe: true,
            };
            if (participant) body.participant = participant;
            const resp = await evoFetch(
              instance,
              `/chat/deleteMessageForEveryone/${encodeURIComponent(instance.evolution_instance)}`,
              { method: "DELETE", body: JSON.stringify(body) },
            );
            if (resp.ok) {
              evolutionStatus = "ok";
            } else {
              evolutionStatus = "error";
              evolutionDetail = `HTTP ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 300)}`;
            }
          } catch (e) {
            evolutionStatus = "error";
            evolutionDetail = String(e);
          }
        }
      }
    }

    const { error: delErr } = await supabase.from("messages").delete().eq("id", message_id);
    if (delErr) throw delErr;

    return json({ ok: true, evolution: evolutionStatus, detail: evolutionDetail });
  } catch (err) {
    console.error("evolution-delete-message error", err);
    return json({ error: String(err) }, 500);
  }
});
