// Fetches a QR code (and pairing code) from Evolution API for a given instance.
import { corsHeaders, json, loadInstance, evoFetch } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const instanceId: string | null = body?.instance_id ?? null;
    const instance = await loadInstance(instanceId);
    if (!instance) return json({ ok: false, error: "Nenhuma instância configurada." }, 400);

    // Check current state first.
    const stateResp = await evoFetch(
      instance,
      `/instance/connectionState/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "GET" },
    );
    const stateData = await stateResp.json().catch(() => ({}));
    const state = stateData?.instance?.state ?? stateData?.state ?? "unknown";

    if (state === "open") {
      return json({ ok: true, state: "open" });
    }

    // Ask Evolution for the QR / pairing code.
    const qrResp = await evoFetch(
      instance,
      `/instance/connect/${encodeURIComponent(instance.evolution_instance)}`,
      { method: "GET" },
    );
    const qrData = await qrResp.json().catch(() => ({}));
    if (!qrResp.ok) {
      return json({ ok: false, state, error: qrData?.message ?? "Erro ao obter QR", detail: qrData }, 200);
    }

    // Evolution may return base64 in different shapes depending on version.
    const rawBase64: string | null =
      qrData?.base64 ?? qrData?.qrcode?.base64 ?? qrData?.qr ?? null;
    const base64 = rawBase64
      ? rawBase64.startsWith("data:")
        ? rawBase64
        : `data:image/png;base64,${rawBase64}`
      : null;
    const pairingCode: string | null =
      qrData?.pairingCode ?? qrData?.qrcode?.pairingCode ?? null;
    const code: string | null = qrData?.code ?? qrData?.qrcode?.code ?? null;

    return json({ ok: true, state, base64, pairingCode, code });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});
