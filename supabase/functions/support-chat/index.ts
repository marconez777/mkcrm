// Support chat — SSE streaming with RAG against support_documents.
// Uses OpenAI (super_admin's key). Spend-guarded by monthly_cap_usd.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1": { in: 2, out: 8 },
};
const cost = (m: string, ti: number, to: number) => {
  const p = PRICING[m] ?? PRICING["gpt-4o-mini"];
  return (ti / 1_000_000) * p.in + (to / 1_000_000) * p.out;
};

async function embed(apiKey: string, text: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text, dimensions: EMBED_DIMS }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.data[0].embedding;
}

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

    const body = await req.json().catch(() => ({}));
    const message: string = String(body?.message ?? "").trim();
    if (!message) return json({ error: "message vazio" }, 400);
    let threadId: string | null = body?.thread_id ?? null;
    const ctx = body?.context ?? {};

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // load config
    const { data: cfg } = await admin.from("support_agent_config")
      .select("api_key, model, temperature, system_prompt, enabled, monthly_cap_usd")
      .eq("singleton", true).maybeSingle();
    if (!cfg) return json({ error: "Suporte não configurado" }, 503);
    if (!cfg.enabled) return json({ error: "Suporte desativado pelo admin" }, 503);
    if (!cfg.api_key) return json({ error: "API key não configurada" }, 503);

    // spend guard
    const { data: spent } = await admin.rpc("support_chat_spent_this_month_usd");
    if (Number(spent ?? 0) >= Number(cfg.monthly_cap_usd ?? 50)) {
      return json({ error: "Teto mensal de gastos atingido. Avise o admin." }, 402);
    }

    // get clinic for thread metadata
    const { data: mem } = await admin.from("clinic_members").select("clinic_id").eq("user_id", userId).maybeSingle();
    const clinicId = mem?.clinic_id ?? null;

    // create or load thread
    let priorMessages: Array<{ role: string; content: string }> = [];
    if (!threadId) {
      const { data: t, error } = await admin.from("support_chat_threads").insert({
        user_id: userId, clinic_id: clinicId, title: message.slice(0, 80), last_route: ctx?.route ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      threadId = t.id;
    } else {
      const { data: t } = await admin.from("support_chat_threads")
        .select("id, user_id, taken_over_at").eq("id", threadId).maybeSingle();
      if (!t || t.user_id !== userId) return json({ error: "Thread inválida" }, 403);
      if (t.taken_over_at) {
        return json({ error: "Um atendente humano assumiu esta conversa. Aguarde a resposta da equipe pelo próprio chat." }, 423);
      }
      const { data: msgs } = await admin.from("support_chat_messages")
        .select("role, content").eq("thread_id", threadId)
        .in("role", ["user", "assistant"]).order("created_at", { ascending: true }).limit(20);
      priorMessages = (msgs ?? []) as any;
      await admin.from("support_chat_threads").update({ last_route: ctx?.route ?? null, updated_at: new Date().toISOString() }).eq("id", threadId);
    }

    // persist user message
    await admin.from("support_chat_messages").insert({
      thread_id: threadId, role: "user", content: message,
      screen_context: ctx ?? {}, runtime_errors: ctx?.runtime_errors ?? null,
    });

    // pre-insert assistant placeholder so we can return its id for feedback
    const { data: asstRow, error: asstErr } = await admin.from("support_chat_messages").insert({
      thread_id: threadId, role: "assistant", content: "",
    }).select("id").single();
    if (asstErr) throw new Error(asstErr.message);
    const assistantMessageId = asstRow.id;

    // RAG: embed + match
    let ragBlock = "";
    let matches: any[] = [];
    try {
      const qEmb = await embed(cfg.api_key, message);
      const { data: m } = await admin.rpc("match_support_documents", {
        query_embedding: `[${qEmb.join(",")}]` as any, match_count: 6,
      });
      matches = (m ?? []) as any[];
      if (matches.length > 0) {
        ragBlock = "\n\n## Trechos da base de conhecimento (use como verdade):\n\n" +
          matches.map((d, i) => `### [${i + 1}] ${d.title} (${d.path})\n${d.content}`).join("\n\n---\n\n");
      }
    } catch (e) {
      console.error("RAG failed:", e);
    }

    // build context block
    const ctxBlock = [
      `## Contexto da tela`,
      `- Rota: ${ctx?.route ?? "desconhecida"}`,
      ctx?.page_title ? `- Título: ${ctx.page_title}` : null,
      ctx?.viewport ? `- Viewport: ${ctx.viewport.w}x${ctx.viewport.h}` : null,
      ctx?.headings?.length ? `- Cabeçalhos visíveis: ${ctx.headings.slice(0, 10).join(" | ")}` : null,
      ctx?.buttons?.length ? `- Botões visíveis: ${ctx.buttons.slice(0, 15).join(" | ")}` : null,
      Array.isArray(ctx?.runtime_errors) && ctx.runtime_errors.length
        ? `- Erros/falhas recentes (use para diagnosticar antes de pedir info):\n${ctx.runtime_errors.slice(0, 6).map((e: any) => `  - [${e.kind}${e.status ? " " + e.status : ""}] ${e.message}${e.url ? " (" + e.url + ")" : ""}`).join("\n")}`
        : null,
    ].filter(Boolean).join("\n");

    const toolsBlock = `\n\n## Ferramentas de UI (use sempre que fizer sentido)\nVocê PODE inserir tokens especiais no meio da resposta. O frontend converte em botões clicáveis. Use exatamente esta sintaxe (em uma linha):\n\n- [[go:/rota|Texto do botão]] — leva o usuário direto para uma página do app. Use a rota exata vinda do contexto da tela ou da KB.\n- [[click:text=Salvar|Destacar botão Salvar]] — destaca um elemento na tela atual. Prefira "text=<texto visível>" para casar com botões/links. Use seletor CSS só se souber a estrutura.\n- [[step:Clique em Configurações]] — um passo de um passo-a-passo. Liste UM passo por linha quando estiver guiando.\n\nRegras:\n- No primeiro passo de um fluxo, sempre que possível combine [[go:...]] + [[click:text=...]] apontando o destino.\n- Nunca invente uma rota; se não souber, pergunte ou use lookup na KB.\n- Quando o usuário disser "feito" / "ok" / "próximo", envie só o próximo passo.\n`;
    const systemPrompt = `${cfg.system_prompt}${toolsBlock}\n\n${ctxBlock}${ragBlock}`;

    // call OpenAI streaming
    const openaiBody = {
      model: cfg.model,
      temperature: Number(cfg.temperature ?? 0.3),
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: systemPrompt },
        ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    };

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify(openaiBody),
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text();
      console.error("openai err", upstream.status, txt);
      return json({ error: "Falha na OpenAI", detail: txt.slice(0, 300) }, 502);
    }

    // tee the upstream stream: forward chunks AND accumulate to persist
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullText = "";
    let tokensIn = 0;
    let tokensOut = 0;
    const sources = matches.map((m) => ({ path: m.path, title: m.title, similarity: m.similarity }));

    const stream = new ReadableStream({
      async start(controller) {
        // send metadata first as SSE event
        controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ thread_id: threadId, assistant_message_id: assistantMessageId, sources })}\n\n`));

        const reader = upstream.body!.getReader();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            // forward raw upstream lines (they're already SSE)
            let idx;
            while ((idx = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, idx);
              buf = buf.slice(idx + 1);
              controller.enqueue(encoder.encode(line + "\n"));
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                const payload = trimmed.slice(6);
                if (payload === "[DONE]") continue;
                try {
                  const j = JSON.parse(payload);
                  const delta = j?.choices?.[0]?.delta?.content;
                  if (typeof delta === "string") fullText += delta;
                  if (j?.usage) {
                    tokensIn = j.usage.prompt_tokens ?? tokensIn;
                    tokensOut = j.usage.completion_tokens ?? tokensOut;
                  }
                } catch { /* ignore */ }
              }
            }
          }
          if (buf) controller.enqueue(encoder.encode(buf));
        } catch (e) {
          console.error("stream error:", e);
        } finally {
          // finalize assistant message (placeholder was inserted before stream)
          const c = cost(cfg.model, tokensIn, tokensOut);
          await admin.from("support_chat_messages").update({
            content: fullText,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
            cost_usd: c,
            tool_result: { sources, model: cfg.model } as any,
          }).eq("id", assistantMessageId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
