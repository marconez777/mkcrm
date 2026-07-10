// supabase/functions/_template_pipeline_classify/agent.ts
// ============================================================================
// Esteira mínima de micro-agentes para o template.
//
// Estrutura sugerida (adapte por tenant):
//   1. Resumidor Incremental — mantém `leads.ai_summary` curto (custo O(1)).
//   2. Tipificador de Intenção — decide o que o lead quer com base em summary + msgs novas.
//
// Adicione mais agentes (Agendador, Movimentador, Maestro) só se a complexidade
// do funil justificar (ver `pipeline-classify/agent-core.ts` da ÓR como referência max).
//
// G16 — Este arquivo expõe `handleV1` e `handleV2`. `runAgent` faz o switch por
// `opts.version` (lido pelo dispatcher do `automation.<slug>.classifier_version`).
// No dia 1 só existe v1; v2 é stub que delega em v1 até alguém escrever o prompt novo.
// ============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateObject } from "npm:ai@^4";
import { getClinicOpenAI } from "../_shared/clinic-openai.ts";
import { getLovableAi } from "../_shared/lovable-ai.ts";
import { ClassificationSchema, type Classification } from "./schema.ts";

type Message = { id: string; direction: string; body: string | null; created_at: string; from_me: boolean };
type Lead    = { id: string; clinic_id: string; pipeline_id: string | null };

export type AgentCtx   = { lead: Lead; messages: Message[] };
export type AgentOk    = { classification: Classification };
export type AgentError = { error: string };
export type ClassifierVersion = "v1" | "v2";

const TYPIFIER_TIMEOUT_MS = 25_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}_timeout`)), ms)),
  ]);
}

async function resolveModel(client: SupabaseClient, clinicId: string) {
  const byok = await getClinicOpenAI(client, clinicId);
  return byok
    ? byok.model("gpt-5-mini")
    : getLovableAi().model("google/gemini-2.5-flash-lite");
}

// ---------------------------------------------------------------------------
// handleV1 — prompt/lógica atual (produção). NÃO altere sem bump de versão.
// ---------------------------------------------------------------------------
export async function handleV1(
  client: SupabaseClient,
  ctx: AgentCtx,
): Promise<AgentOk | AgentError> {
  try {
    const model = await resolveModel(client, ctx.lead.clinic_id);

    // Contexto compacto: só as N últimas mensagens (Resumidor cuida do resto).
    const recent = ctx.messages.slice(-20).map((m) => ({
      role: m.from_me ? "assistant" : "user",
      text: m.body ?? "",
    }));

    const { object } = await withTimeout(
      generateObject({
        model,
        schema: ClassificationSchema,
        system: [
          "Você é um Agente de Pipeline: OBSERVADOR SILENCIOSO — nunca escreve pro lead.",
          "Sua tarefa é ler a conversa e devolver a intenção detectada + tags sugeridas.",
          "Se não tiver certeza, devolva intent='indefinido'. Nunca invente dados.",
        ].join(" "),
        prompt: JSON.stringify({ messages: recent }),
      }),
      TYPIFIER_TIMEOUT_MS,
      "typifier",
    );

    return { classification: object };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// handleV2 — stub. Hoje delega em v1 (dark-launch pronto: basta trocar o corpo
// e ligar via `automation.<slug>.classifier_version = "v2"` em app_settings).
// TODO: substituir por prompt/esteira novos quando forem definidos.
// ---------------------------------------------------------------------------
export async function handleV2(
  client: SupabaseClient,
  ctx: AgentCtx,
): Promise<AgentOk | AgentError> {
  return handleV1(client, ctx);
}

// ---------------------------------------------------------------------------
// runAgent — entry point usado pelo dispatcher (index.ts). Faz o switch por
// versão. Default defensivo = v1 caso o setting venha malformado.
// ---------------------------------------------------------------------------
export async function runAgent(
  client: SupabaseClient,
  ctx: AgentCtx,
  opts: { version: ClassifierVersion } = { version: "v1" },
): Promise<AgentOk | AgentError> {
  switch (opts.version) {
    case "v2": return handleV2(client, ctx);
    case "v1":
    default:   return handleV1(client, ctx);
  }
}
