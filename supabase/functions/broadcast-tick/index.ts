// Cron tick: processa broadcasts running, respeitando janela horária e throttle.
import { corsHeaders, json, sb, loadInstance, evoFetch } from "../_shared/evolution.ts";

type SendWindow = { start: string; end: string; tz: string; weekdays: number[] };

function nowInTz(tz: string): Date {
  // returns "now" but reinterpreted as a Date whose local components equal the wall-clock in tz
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
}

function isoWeekday(d: Date): number {
  // 1=Mon..7=Sun
  const w = d.getDay(); return w === 0 ? 7 : w;
}

function withinWindow(w: SendWindow): { ok: boolean; nextOpenIso: string } {
  const tz = w.tz || "America/Sao_Paulo";
  const local = nowInTz(tz);
  const wd = isoWeekday(local);
  const [sh, sm] = (w.start || "08:00").split(":").map(Number);
  const [eh, em] = (w.end || "18:00").split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const curMins = local.getHours() * 60 + local.getMinutes();
  const weekdayOk = (w.weekdays ?? [1,2,3,4,5]).includes(wd);

  if (weekdayOk && curMins >= startMins && curMins < endMins) {
    return { ok: true, nextOpenIso: new Date().toISOString() };
  }

  // próxima abertura: avança dia até dia válido + horário start
  let probe = new Date(local);
  for (let i = 0; i < 8; i++) {
    if (i > 0 || curMins >= endMins || !weekdayOk) {
      if (i === 0 && !weekdayOk) { /* nada */ }
      else { probe.setDate(probe.getDate() + (i === 0 ? 1 : 1)); }
    }
    const wdp = isoWeekday(probe);
    if ((w.weekdays ?? [1,2,3,4,5]).includes(wdp)) {
      // if first iteration and weekdayOk but before start, use today's start
      if (i === 0 && weekdayOk && curMins < startMins) {
        probe.setHours(sh, sm, 0, 0);
        // converter de "local-tz" para UTC real
        const diffMs = probe.getTime() - local.getTime();
        return { ok: false, nextOpenIso: new Date(Date.now() + diffMs).toISOString() };
      }
      probe.setHours(sh, sm, 0, 0);
      const diffMs = probe.getTime() - local.getTime();
      return { ok: false, nextOpenIso: new Date(Date.now() + diffMs).toISOString() };
    }
  }
  return { ok: false, nextOpenIso: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
}

function triggerTick() {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/broadcast-tick`;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: "{}",
    }).catch(() => {});
  } catch { /* fire-and-forget */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = sb();
  const startedAt = Date.now();
  const stats = { processed: 0, sent: 0, skipped: 0, failed: 0, paused: 0 };

  try {
    const { data: broadcasts } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("status", "running");

    for (const bc of broadcasts ?? []) {
      const win = bc.send_window as SendWindow;
      const winState = withinWindow(win);
      if (!winState.ok) {
        // empurra todos os pendentes para próxima abertura
        await supabase
          .from("broadcast_recipients")
          .update({ next_send_at: winState.nextOpenIso })
          .eq("broadcast_id", bc.id)
          .eq("status", "pending")
          .lt("next_send_at", winState.nextOpenIso);
        continue;
      }

      // Pega o próximo recipient pronto
      const { data: recipients } = await supabase
        .from("broadcast_recipients")
        .select("*")
        .eq("broadcast_id", bc.id)
        .in("status", ["pending", "sending"])
        .lte("next_send_at", new Date().toISOString())
        .order("next_send_at", { ascending: true })
        .limit(3); // processa até 3 por tick

      if (!recipients || recipients.length === 0) {
        // checa se acabou
        const { count } = await supabase
          .from("broadcast_recipients")
          .select("id", { count: "exact", head: true })
          .eq("broadcast_id", bc.id)
          .in("status", ["pending", "sending"]);
        if ((count ?? 0) === 0) {
          await supabase.from("broadcasts").update({ status: "done" }).eq("id", bc.id);
          await supabase.from("broadcast_events").insert({ broadcast_id: bc.id, clinic_id: bc.clinic_id, type: "done" });
        }
        continue;
      }

      const instance = await loadInstance(bc.whatsapp_instance_id);
      if (!instance) {
        await supabase.from("broadcasts").update({ status: "paused" }).eq("id", bc.id);
        await supabase.from("broadcast_events").insert({
          broadcast_id: bc.id, clinic_id: bc.clinic_id, type: "paused",
          payload: { reason: "no_instance" },
        });
        stats.paused++;
        continue;
      }

      // Carrega grupos/partes uma vez por broadcast
      const { data: groups } = await supabase
        .from("broadcast_message_groups")
        .select("id, position, broadcast_message_parts(id, position, content)")
        .eq("broadcast_id", bc.id)
        .order("position", { ascending: true });
      if (!groups || groups.length === 0) {
        await supabase.from("broadcasts").update({ status: "failed" }).eq("id", bc.id);
        continue;
      }

      for (const r of recipients) {
        stats.processed++;
        const group = groups.find((g: any) => g.position === r.group_position) ?? groups[0];
        const parts = ((group as any).broadcast_message_parts ?? []).sort((a: any, b: any) => a.position - b.position);
        const partIndex = r.parts_sent;
        if (partIndex >= parts.length) {
          // já enviou tudo
          await supabase.from("broadcast_recipients")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", r.id);
          continue;
        }
        const part = parts[partIndex];
        // simples interpolação {{nome}}
        const content = (part.content as string).replace(/\{\{\s*nome\s*\}\}/gi, r.name ?? "");

        // CLAIM atômico: tenta reservar o destinatário para esse tick.
        // Se outro tick (cron + triggerTick rodando em paralelo) já reservou, pula.
        const claimUntil = new Date(Date.now() + 60_000).toISOString();
        const { data: claimed } = await supabase
          .from("broadcast_recipients")
          .update({ next_send_at: claimUntil })
          .eq("id", r.id)
          .eq("parts_sent", partIndex)
          .lte("next_send_at", new Date().toISOString())
          .select("id");
        if (!claimed || claimed.length === 0) {
          // outro worker pegou esse destinatário — pula
          continue;
        }


        let ok = false;
        let errText: string | null = null;
        let evoResp: any = null;
        let evoStatus = 0;
        try {
          const resp = await evoFetch(
            instance,
            `/message/sendText/${encodeURIComponent(instance.evolution_instance)}`,
            { method: "POST", body: JSON.stringify({ number: r.phone, text: content }) },
          );
          evoStatus = resp.status;
          evoResp = await resp.json().catch(() => ({}));
          if (resp.ok) {
            // Heurística: Evolution pode retornar 200 mesmo quando o número não existe.
            // Considera entregue só se vier um id de mensagem (messageId ou key.id).
            const messageId = evoResp?.key?.id ?? evoResp?.messageId ?? evoResp?.message?.id ?? null;
            if (messageId) { ok = true; }
            else { errText = `Evolution 200 sem messageId (numero pode nao existir no WhatsApp): ${JSON.stringify(evoResp).slice(0, 300)}`; }
          } else {
            errText = `HTTP ${resp.status}: ${JSON.stringify(evoResp).slice(0, 300)}`;
          }
        } catch (e) { errText = String(e); }

        if (ok) {
          const newPartsSent = partIndex + 1;
          const allDone = newPartsSent >= parts.length;
          const jitter = 1 + (Math.random() - 0.5) * 0.2; // ±10%
          const nextSendAt = allDone
            ? new Date(Date.now() + bc.throttle_seconds * 1000 * jitter).toISOString()
            : new Date(Date.now() + 3000).toISOString(); // partes do mesmo grupo seguem em ~3s
          await supabase.from("broadcast_recipients").update({
            status: allDone ? "sent" : "sending",
            parts_sent: newPartsSent,
            sent_at: allDone ? new Date().toISOString() : null,
            next_send_at: allDone ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : nextSendAt,
            last_error: null,
          }).eq("id", r.id);

          await supabase.from("broadcast_events").insert({
            broadcast_id: bc.id, recipient_id: r.id, clinic_id: bc.clinic_id,
            type: "sent",
            payload: {
              part: newPartsSent,
              total: parts.length,
              group: group.position,
              evolution_status: evoStatus,
              evolution_response: evoResp,
            },
          });

          if (allDone) {
            // throttle por instância: empurra TODOS os outros pendentes desse broadcast pra +throttle
            await supabase
              .from("broadcast_recipients")
              .update({ next_send_at: nextSendAt })
              .eq("broadcast_id", bc.id)
              .eq("status", "pending")
              .lt("next_send_at", nextSendAt);
            stats.sent++;
            // atualiza totals.sent
            const { count: sentCount } = await supabase
              .from("broadcast_recipients")
              .select("id", { count: "exact", head: true })
              .eq("broadcast_id", bc.id)
              .eq("status", "sent");
            await supabase.from("broadcasts")
              .update({ totals: { ...(bc.totals ?? {}), sent: sentCount ?? 0 } })
              .eq("id", bc.id);
            // encadeia próximo destinatário sem esperar o cron (throttle ainda é respeitado via next_send_at)
            triggerTick();
            break; // só 1 destinatário "completo" por tick por broadcast
          } else {
            // parte intermediária enviada: dispara novo tick em ~3s para mandar a próxima parte sem esperar o cron
            triggerTick();
          }
        } else {
          stats.failed++;
          await supabase.from("broadcast_recipients").update({
            status: "failed", last_error: errText,
          }).eq("id", r.id);
          await supabase.from("broadcast_events").insert({
            broadcast_id: bc.id, recipient_id: r.id, clinic_id: bc.clinic_id,
            type: "failed",
            payload: { error: errText, evolution_status: evoStatus, evolution_response: evoResp },
          });
        }
      }
    }

    return json({ ok: true, elapsed_ms: Date.now() - startedAt, ...stats });
  } catch (err) {
    console.error("broadcast-tick error", err);
    return json({ error: String(err) }, 500);
  }
});
