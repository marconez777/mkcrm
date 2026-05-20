// Controla campanhas de disparo em massa: start, pause, resume, cancel, freeze_audience, add_contacts, test_send_first.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json, sb, requireUser, loadInstance, evoFetch } from "../_shared/evolution.ts";

async function triggerTick() {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/broadcast-tick`;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // fire-and-forget; don't await response body parsing to keep this fast
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: "{}",
    }).then((r) => r.text()).catch(() => {});
  } catch (_) { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = token === serviceRole
    ? sb()
    : createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

  try {
    const body = await req.json();
    const { action, broadcast_id } = body ?? {};
    if (!action || !broadcast_id) return json({ error: "action and broadcast_id required" }, 400);

    const { data: bc, error: bcErr } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("id", broadcast_id)
      .maybeSingle();
    if (bcErr) throw bcErr;
    if (!bc) return json({ error: "broadcast_not_found" }, 404);

    const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
      await supabase.from("broadcasts").update({ status, ...extra }).eq("id", broadcast_id);
      await supabase.from("broadcast_events").insert({
        broadcast_id, clinic_id: bc.clinic_id, type: status,
      });
    };

    if (action === "start") {
      if (!bc.whatsapp_instance_id) {
        return json({ error: "no_whatsapp_instance", message: "Selecione uma instância do WhatsApp na aba Configuração antes de iniciar." }, 400);
      }
      if (!bc.audience_frozen_at) {
        return json({ error: "audience_not_frozen", message: "Congele a audiência na aba Audiência antes de iniciar a campanha." }, 400);
      }
      // Garante que o primeiro destinatário seja enviado imediatamente
      await sb()
        .from("broadcast_recipients")
        .update({ next_send_at: new Date().toISOString() })
        .eq("broadcast_id", broadcast_id)
        .in("status", ["pending", "sending"]);
      await setStatus("running");
      // Dispara o tick imediatamente — não espera o cron
      await triggerTick();
      return json({ ok: true });
    }

    if (action === "test_send_first") {
      if (!bc.whatsapp_instance_id) {
        return json({ error: "no_whatsapp_instance", message: "Selecione uma instância do WhatsApp na aba Configuração." }, 400);
      }
      const svc = sb();
      const { data: recipient } = await svc
        .from("broadcast_recipients")
        .select("*")
        .eq("broadcast_id", broadcast_id)
        .in("status", ["pending", "sending"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!recipient) {
        return json({ error: "no_recipient", message: "Nenhum destinatário disponível. Congele a audiência primeiro." }, 400);
      }
      const { data: groups } = await svc
        .from("broadcast_message_groups")
        .select("id, position, broadcast_message_parts(id, position, content)")
        .eq("broadcast_id", broadcast_id)
        .order("position", { ascending: true });
      if (!groups || groups.length === 0) {
        return json({ error: "no_message_groups", message: "Crie pelo menos um grupo de mensagens." }, 400);
      }
      const group: any = groups.find((g: any) => g.position === (recipient.group_position ?? 1)) ?? groups[0];
      const parts = (group.broadcast_message_parts ?? []).sort((a: any, b: any) => a.position - b.position);
      if (parts.length === 0) {
        return json({ error: "no_parts", message: "O grupo de mensagens está vazio." }, 400);
      }
      const instance = await loadInstance(bc.whatsapp_instance_id);
      if (!instance) return json({ error: "no_instance", message: "Instância do WhatsApp não encontrada." }, 400);

      const results: any[] = [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const content = (part.content as string).replace(/\{\{\s*nome\s*\}\}/gi, recipient.name ?? "");
        try {
          const resp = await evoFetch(
            instance,
            `/message/sendText/${encodeURIComponent(instance.evolution_instance)}`,
            { method: "POST", body: JSON.stringify({ number: recipient.phone, text: content }) },
          );
          const dataResp = await resp.json().catch(() => ({}));
          results.push({ part: i + 1, ok: resp.ok, status: resp.status, info: resp.ok ? null : dataResp });
          if (!resp.ok) break;
        } catch (e) {
          results.push({ part: i + 1, ok: false, error: String(e) });
          break;
        }
        if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 2000));
      }
      await svc.from("broadcast_events").insert({
        broadcast_id, recipient_id: recipient.id, clinic_id: bc.clinic_id,
        type: "test_sent", payload: { phone: recipient.phone, name: recipient.name, results },
      });
      const allOk = results.every((r) => r.ok);
      return json({
        ok: allOk,
        recipient: { phone: recipient.phone, name: recipient.name },
        parts_sent: results.filter((r) => r.ok).length,
        results,
      });
    }

    if (action === "pause") { await setStatus("paused"); return json({ ok: true }); }
    if (action === "resume") { await setStatus("running"); return json({ ok: true }); }
    if (action === "cancel") { await setStatus("cancelled"); return json({ ok: true }); }

    if (action === "delete") {
      const svc = sb();
      await svc.from("broadcast_events").delete().eq("broadcast_id", broadcast_id);
      await svc.from("broadcast_recipients").delete().eq("broadcast_id", broadcast_id);
      await svc.from("broadcast_message_parts").delete().in(
        "group_id",
        (await svc.from("broadcast_message_groups").select("id").eq("broadcast_id", broadcast_id)).data?.map((g: any) => g.id) ?? []
      );
      await svc.from("broadcast_message_groups").delete().eq("broadcast_id", broadcast_id);
      await svc.from("broadcasts").delete().eq("id", broadcast_id);
      return json({ ok: true });
    }

    if (action === "freeze_audience") {
      const { pipeline_id = null, stage_ids = [], extra_contacts = [] } = body;
      const { data, error } = await supabase.rpc("broadcast_freeze_audience", {
        _broadcast_id: broadcast_id,
        _pipeline_id: pipeline_id,
        _stage_ids: stage_ids,
        _extra_contacts: extra_contacts,
      });
      if (error) {
        const message = error.message === "forbidden"
          ? "Você não tem permissão para congelar a audiência desta campanha."
          : error.message === "no_message_groups"
          ? "Adicione pelo menos um grupo de mensagens antes de congelar a audiência."
          : error.message;
        return json({ error: error.message, message }, 400);
      }
      return json({ ok: true, inserted: data });
    }

    if (action === "retry_failed") {
      await supabase
        .from("broadcast_recipients")
        .update({ status: "pending", parts_sent: 0, next_send_at: new Date().toISOString(), last_error: null })
        .eq("broadcast_id", broadcast_id)
        .eq("status", "failed");
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("broadcast-control error", err);
    return json({ error: String(err) }, 500);
  }
});
