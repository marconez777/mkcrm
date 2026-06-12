// field-rules-suggest — agente que lê o pipeline, as colunas e os custom_fields
// existentes nos leads, e devolve uma lista de regras sugeridas no formato
// aceito por `pipeline_field_rules`. Não persiste nada — o usuário decide
// quais regras importar a partir da UI.

import { corsHeaders, json, sb, requireUser } from "../_shared/evolution.ts";

interface Body {
  clinic_id: string;
  pipeline_id: string;
}

interface SuggestedRule {
  name: string;
  target_stage_id: string;
  priority: number;
  conditions: Array<{ field: string; op: string; value?: unknown }>;
  rationale: string;
}

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const who = await requireUser(req);
  if (who instanceof Response) return who;

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  if (!body.clinic_id || !body.pipeline_id) return json({ error: "missing_ids" }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "missing_lovable_api_key" }, 500);

  const supabase = sb();

  const [{ data: pipeline }, { data: stages }, { data: existing }, { data: leadSample }] = await Promise.all([
    supabase.from("pipelines").select("id, name").eq("id", body.pipeline_id).maybeSingle(),
    supabase.from("pipeline_stages")
      .select("id, name, position")
      .eq("pipeline_id", body.pipeline_id)
      .order("position"),
    supabase.from("pipeline_field_rules")
      .select("name, target_stage_id, priority, conditions")
      .eq("pipeline_id", body.pipeline_id),
    supabase.from("leads")
      .select("custom_fields")
      .eq("clinic_id", body.clinic_id)
      .not("custom_fields", "is", null)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  if (!pipeline) return json({ error: "pipeline_not_found" }, 404);
  if (!stages?.length) return json({ error: "no_stages" }, 400);

  // descobre chaves de custom_fields realmente usadas + tipo aproximado e exemplos
  const fieldStats = new Map<string, { type: Set<string>; samples: Set<string>; count: number }>();
  for (const row of (leadSample ?? [])) {
    const cf = (row as any).custom_fields ?? {};
    if (typeof cf !== "object") continue;
    for (const [k, v] of Object.entries(cf)) {
      if (v === null || v === undefined || v === "") continue;
      const s = fieldStats.get(k) ?? { type: new Set(), samples: new Set(), count: 0 };
      s.type.add(typeof v);
      if (s.samples.size < 5 && typeof v !== "object") s.samples.add(String(v).slice(0, 60));
      s.count++;
      fieldStats.set(k, s);
    }
  }
  const fieldsSummary = Array.from(fieldStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .map(([name, s]) => ({
      name,
      type: Array.from(s.type).join("|"),
      occurrences: s.count,
      sample_values: Array.from(s.samples),
    }));

  if (fieldsSummary.length === 0) {
    return json({
      suggestions: [],
      stages: stages ?? [],
      used_fields: [],
      warning: "Nenhum custom_field encontrado nos leads recentes. Rode o extractor primeiro para popular os campos.",
    });
  }

  const stageList = (stages ?? []).map((s: any) => ({ id: s.id, name: s.name, position: s.position }));
  const existingRules = (existing ?? []).map((r: any) => ({
    name: r.name,
    target_stage: stageList.find((s) => s.id === r.target_stage_id)?.name ?? r.target_stage_id,
    priority: r.priority,
    conditions: r.conditions,
  }));

  const systemPrompt = `Você é um assistente que cria regras de automação para um CRM tipo Kanban.
Cada regra avalia campos do lead (custom_fields) e, se casar, move o card para uma coluna.
Sua tarefa: olhar a lista de colunas do pipeline e os campos que realmente existem nos leads dessa clínica, e propor 3 a 10 regras úteis que cubram a jornada do cliente.

REGRAS DE NEGÓCIO:
- Use apenas campos que aparecem em "available_fields". Não invente nomes.
- Use apenas IDs de coluna que aparecem em "stages". target_stage_id é o uuid da coluna.
- Operadores válidos: equals, not_equals, is_true, is_false, is_empty, not_empty, in, contains, gte, lte.
- "in" precisa de "value" como array. "equals"/"not_equals"/"contains"/"gte"/"lte" precisam de "value" escalar. "is_true"/"is_false"/"is_empty"/"not_empty" NÃO usam "value".
- Prioridade: estados mais avançados na jornada têm prioridade maior (100 = mais alto). A primeira regra que casar vence, então estados terminais como "pago" devem ter prioridade > estados intermediários.
- Não duplique regras que já existem em "existing_rules" — sugira só o que está faltando.
- Os nomes das regras devem ser curtos e descritivos em português (ex.: "Pagamento confirmado").
- rationale: 1 frase explicando para o atendente por que essa regra é útil.

Devolva via tool call.`;

  const userPayload = {
    pipeline: { id: pipeline.id, name: (pipeline as any).name },
    stages: stageList,
    existing_rules: existingRules,
    available_fields: fieldsSummary,
  };

  const tool = {
    type: "function",
    function: {
      name: "suggest_rules",
      description: "Retorna a lista de regras sugeridas para esse pipeline.",
      parameters: {
        type: "object",
        properties: {
          rules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                target_stage_id: { type: "string" },
                priority: { type: "integer" },
                rationale: { type: "string" },
                conditions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      op: { type: "string" },
                      value: {},
                    },
                    required: ["field", "op"],
                  },
                },
              },
              required: ["name", "target_stage_id", "priority", "conditions", "rationale"],
            },
          },
        },
        required: ["rules"],
      },
    },
  };

  const aiRes = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "suggest_rules" } },
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text();
    if (aiRes.status === 429) return json({ error: "rate_limited", detail: txt }, 429);
    if (aiRes.status === 402) return json({ error: "ai_credits_exhausted", detail: txt }, 402);
    return json({ error: "ai_error", status: aiRes.status, detail: txt.slice(0, 500) }, 500);
  }

  const aiJson = await aiRes.json();
  const args = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return json({ error: "no_suggestions", raw: aiJson }, 500);

  let parsed: { rules: SuggestedRule[] };
  try { parsed = JSON.parse(args); } catch { return json({ error: "invalid_json", raw: args }, 500); }

  const validStageIds = new Set(stageList.map((s) => s.id));
  const validOps = new Set([
    "equals", "not_equals", "is_true", "is_false",
    "is_empty", "not_empty", "in", "contains", "gte", "lte",
  ]);
  const validFields = new Set(fieldsSummary.map((f) => f.name));

  const sanitized = (parsed.rules ?? []).filter((r) => {
    if (!r.target_stage_id || !validStageIds.has(r.target_stage_id)) return false;
    if (!Array.isArray(r.conditions) || r.conditions.length === 0) return false;
    return r.conditions.every((c) => validOps.has(c.op) && validFields.has(c.field));
  });

  return json({
    suggestions: sanitized,
    stages: stageList,
    used_fields: fieldsSummary.map((f) => f.name),
  });
});
