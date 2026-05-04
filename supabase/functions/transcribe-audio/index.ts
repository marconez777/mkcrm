// Transcribes an audio message using Lovable AI (Gemini multimodal audio).
// Body: { message_id: string }
import { corsHeaders, json, sb } from "../_shared/evolution.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function fetchAudioAsDataUrl(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") ?? "audio/ogg";
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { data: btoa(bin), mime };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { message_id } = await req.json();
    if (!message_id) return json({ error: "message_id required" }, 400);
    const supabase = sb();

    const { data: msg } = await supabase
      .from("messages")
      .select("id, media_url, raw, message_type")
      .eq("id", message_id)
      .single();
    if (!msg) return json({ error: "message not found" }, 404);

    const cached = (msg.raw as any)?.transcript;
    if (cached) return json({ ok: true, transcript: cached, cached: true });

    if (!msg.media_url) return json({ error: "no media_url" }, 400);
    const audio = await fetchAudioAsDataUrl(msg.media_url);
    if (!audio) return json({ error: "failed to download audio" }, 502);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva o áudio a seguir em português, fielmente. Retorne APENAS a transcrição." },
              { type: "input_audio", input_audio: { data: audio.data, format: audio.mime.includes("ogg") ? "ogg" : audio.mime.includes("mp3") ? "mp3" : "wav" } },
            ],
          },
        ],
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      return json({ error: `AI HTTP ${aiResp.status}`, detail: t.slice(0, 300) }, 502);
    }
    const aiData = await aiResp.json();
    const transcript: string = aiData?.choices?.[0]?.message?.content ?? "";

    const newRaw = { ...(msg.raw as any || {}), transcript };
    await supabase.from("messages").update({ raw: newRaw }).eq("id", message_id);
    return json({ ok: true, transcript });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
