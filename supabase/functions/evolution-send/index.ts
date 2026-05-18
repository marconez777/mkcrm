// Sends a text message via Evolution API with retries and idempotency.
import { corsHeaders, json, sb, loadInstance, evoFetch, requireUser } from "../_shared/evolution.ts";

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 2000, 5000];

async function attemptSend(instance: any, phone: string, text: string, quotedId?: string | null) {
  const body: any = { number: phone, text };
  if (quotedId) body.quoted = { key: { id: quotedId } };
  return await evoFetch(
    instance,
    `/message/sendText/${encodeURIComponent(instance.evolution_instance)}`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const supabase = sb();

  try {
    const { lead_id, text, client_message_id, quoted_external_id, bot_agent_id } = await req.json();
    if (!lead_id || !text?.trim()) {
      return json({ error: "lead_id and text required" }, 400);
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("phone, whatsapp_instance_id, clinic_id")
      .eq("id", lead_id)
      .single();
    if (!lead) return json({ error: "Lead não encontrado" }, 404);

    const instance = await loadInstance(lead.whatsapp_instance_id);
    if (!instance) {
      return json({ error: "Nenhuma instância WhatsApp configurada" }, 400);
    }

    const cid = client_message_id ?? crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Idempotency: reuse existing row if client_message_id was already seen.
    let msgRow: { id: string } | null = null;
    if (client_message_id) {
      const { data: existing } = await supabase
        .from("messages")
        .select("id, status")
        .eq("client_message_id", client_message_id)
        .maybeSingle();
      if (existing) {
        if (existing.status === "sent") {
          return json({ ok: true, deduped: true });
        }
        msgRow = { id: existing.id };
      }
    }

    if (!msgRow) {
      const { data: inserted, error: insErr } = await supabase
        .from("messages")
        .insert({
          lead_id,
          clinic_id: lead.clinic_id,
          client_message_id: cid,
          from_me: true,
          message_type: "text",
          content: text,
          status: "pending",
          timestamp: nowIso,
          reply_to_external_id: quoted_external_id ?? null,
          bot_agent_id: bot_agent_id ?? null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      msgRow = inserted;
    }

    await supabase
      .from("leads")
      .update({
        last_message_at: nowIso,
        last_message_preview: text.slice(0, 120),
        unread_count: 0,
      })
      .eq("id", lead_id);

    let lastErr: string | null = null;
    let result: any = null;
    let success = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (BACKOFF_MS[attempt]) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      try {
        const resp = await attemptSend(instance, lead.phone, text, quoted_external_id);
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          result = data;
          success = true;
          break;
        }
        lastErr = `HTTP ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`;
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429) {
          break;
        }
      } catch (e) {
        lastErr = String(e);
      }
      await supabase
        .from("messages")
        .update({ retry_count: attempt + 1, last_error: lastErr })
        .eq("id", msgRow.id);
    }

    if (success) {
      const externalId = result?.key?.id ?? result?.messageId ?? null;
      await supabase
        .from("messages")
        .update({
          status: "sent",
          external_id: externalId,
          raw: result,
          last_error: null,
        })
        .eq("id", msgRow.id);
      return json({ ok: true, result });
    } else {
      await supabase
        .from("messages")
        .update({ status: "failed", last_error: lastErr })
        .eq("id", msgRow.id);
      return json({ error: "Falha ao enviar após tentativas", detail: lastErr }, 502);
    }
  } catch (err) {
    console.error("evolution-send error", err);
    return json({ error: String(err) }, 500);
  }
});
