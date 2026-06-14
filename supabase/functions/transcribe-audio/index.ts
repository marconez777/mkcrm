// Transcribes an audio message using the clinic's own AI agent (OpenAI Whisper or Google Gemini).
// No Lovable AI Gateway — provider + api_key come from the clinic's configured agents.
// Body: { message_id: string }
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

async function fetchAudio(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") ?? "audio/ogg";
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { bytes, mime };
  } catch {
    return null;
  }
}

// Re-sign a Supabase storage URL if it's a signed URL (possibly expired).
// Returns the original URL if it's not a supabase storage signed URL.
async function ensureFreshUrl(supabase: any, url: string): Promise<string> {
  try {
    const u = new URL(url);
    // Match: /storage/v1/object/{sign|public}/<bucket>/<path...>
    const m = u.pathname.match(/\/storage\/v1\/object\/(sign|public)\/([^/]+)\/(.+)$/);
    if (!m) return url;
    const bucket = m[2];
    const path = decodeURIComponent(m[3]);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}

function bytesToBase64(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

async function transcribeOpenAI(apiKey: string, baseUrl: string | null, audio: { bytes: Uint8Array; mime: string }): Promise<string> {
  const base = (baseUrl?.replace(/\/+$/, "") || "https://api.openai.com/v1");
  const ext = audio.mime.includes("ogg") ? "ogg" : audio.mime.includes("mp3") ? "mp3" : audio.mime.includes("wav") ? "wav" : "m4a";
  const fd = new FormData();
  fd.append("file", new Blob([audio.bytes], { type: audio.mime }), `audio.${ext}`);
  fd.append("model", "whisper-1");
  fd.append("language", "pt");
  const r = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return data.text ?? "";
}

async function transcribeGoogle(apiKey: string, model: string, audio: { bytes: Uint8Array; mime: string }): Promise<string> {
  const m = model && model.startsWith("gemini") ? model : "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: "Transcreva o áudio a seguir em português, fielmente. Retorne APENAS a transcrição." },
          { inline_data: { mime_type: audio.mime, data: bytesToBase64(audio.bytes) } },
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { message_id } = await req.json();
    if (!message_id) return json({ error: "message_id required" }, 400);
    const supabase = sb();

    const { data: msg } = await supabase
      .from("messages")
      .select("id, media_url, raw, message_type, lead_id")
      .eq("id", message_id)
      .single();
    if (!msg) return json({ error: "message not found" }, 404);

    const cached = (msg.raw as any)?.transcript;
    if (cached) return json({ ok: true, transcript: cached, cached: true });
    if (!msg.media_url) return json({ error: "no media_url" }, 400);

    // Resolve clinic via the lead, then pick an enabled agent with an API key.
    const { data: lead } = await supabase
      .from("leads").select("clinic_id").eq("id", (msg as any).lead_id).single();
    if (!lead?.clinic_id) return json({ error: "clinic not found for message" }, 400);

    const { data: agents } = await supabase
      .from("ai_agents")
      .select("provider, api_key, base_url, model, role, enabled")
      .eq("clinic_id", lead.clinic_id)
      .eq("enabled", true);
    const list = ((agents ?? []) as any[]).filter((a) => typeof a.api_key === "string" && a.api_key.length > 0);
    const audioCapable = list.filter((a) => a.provider === "openai" || a.provider === "google");
    const chosen =
      audioCapable.find((a) => a.role === "summary") ??
      audioCapable[0] ??
      null;

    if (!chosen) {
      if (list.length === 0) {
        return json({ error: "Nenhum agente de IA com API key configurada. Vá em IA → Agentes e configure um agente OpenAI ou Google para transcrição de áudio." }, 400);
      }
      return json({ error: "Nenhum agente OpenAI ou Google configurado. A transcrição de áudio requer um desses provedores." }, 400);
    }

    const freshUrl = await ensureFreshUrl(supabase, msg.media_url);
    const audio = await fetchAudio(freshUrl);
    if (!audio) return json({ error: "failed to download audio (URL inválida ou expirada)" }, 502);

    let transcript = "";
    try {
      if (chosen.provider === "openai") {
        transcript = await transcribeOpenAI(chosen.api_key, chosen.base_url, audio);
      } else {
        transcript = await transcribeGoogle(chosen.api_key, chosen.model, audio);
      }
    } catch (e) {
      return json({ error: String(e) }, 502);
    }

    const newRaw = { ...(msg.raw as any || {}), transcript };
    await supabase.from("messages").update({ raw: newRaw }).eq("id", message_id);
    return json({ ok: true, transcript });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
