// supabase/functions/pipeline-classify-febracis/agent.ts

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateObject, generateText } from "npm:ai@^3";
import { z } from "npm:zod@^3";
import { getClassifierAi, pickModel, isTransientAgentError } from "../_shared/classifier-ai.ts";
import { logUsage } from "../_shared/metrics.ts";
import { withTimeout } from "../_shared/utils.ts";
import type { LeadContext } from "../pipeline-classify/context.ts";

const TIMEOUT_MS = 20_000;

export const FebracisTipificadorSchema = z.object({
  intent: z.enum(["quer_comprar", "nao_qualificado", "suporte_admin", "outro"]),
  tags_suggested: z.array(z.string()).max(2),
  reasoning: z.string().max(200).optional()
});

export type FebracisIntentOutput = z.infer<typeof FebracisTipificadorSchema>;

export async function runFebracisAgents(
  client: SupabaseClient,
  ctx: LeadContext
) {
  const t0 = Date.now();
  
  // Resolve o provedor. Como é Febracis, preferencialmente Google (Flash)
  const ai = await getClassifierAi(client, ctx.lead.clinic_id, { forceProvider: "google" });
  if (!ai) {
    throw new Error("No AI provider available for Febracis pipeline");
  }

  // Modelos ultrabaratos
  const modelStr = pickModel(ai.provider, {
    google: "gemini-2.5-flash-lite",
    openai: "gpt-4o-mini",
    lovable: "gemini-2.5-flash-lite"
  });

  const model = ai.model(modelStr);

  // Filtra as mensagens APÓS o watermark, mas vamos pegar do context.
  // O loadLeadContext já pode ter carregado isso, mas vamos pegar as strings formatadas
  const msgs = ctx.messages || [];
  if (msgs.length === 0) {
    return { error: "no_messages_to_process" };
  }

  const rawThread = msgs.map(m => `[${m.source}] ${m.content}`).join("\n");
  const oldSummary = ctx.lead.ai_summary || "Nenhum resumo anterior.";

  // ETAPA 1: RESUMIDOR INCREMENTAL
  const summarizerPrompt = `
Você é um resumidor super rápido da Febracis.
Seu objetivo é condensar o resumo antigo da conversa com as mensagens novas recebidas, gerando um único parágrafo atualizado sobre o status do atendimento do lead.

Resumo Antigo:
${oldSummary}

Novas Mensagens Inbound/Outbound:
${rawThread}

Retorne APENAS o novo resumo em texto puro. Seja extremamente sucinto.
`;

  let newSummary = "";
  let usageResumidor: any = {};
  
  try {
    const res = await withTimeout(
      generateText({
        model,
        prompt: summarizerPrompt,
        temperature: 0.1,
      }),
      TIMEOUT_MS,
      "Summarizer_timeout"
    );
    newSummary = res.text.trim();
    usageResumidor = res.usage || {};
    
    // Telemetria Resumidor
    await logUsage(client, ctx.lead.clinic_id, "classifier:febracis_resumidor", usageResumidor.totalTokens || 0, {
      model: modelStr,
      latencyMs: Date.now() - t0,
    });
  } catch (err: any) {
    console.error("Febracis Summarizer Error", err);
    if (isTransientAgentError(err.message)) throw err;
    newSummary = oldSummary; // fallback seguro
  }

  const t1 = Date.now();

  // ETAPA 2: TIPIFICADOR DE INTENÇÃO
  const typifierSystem = `
Você é um Classificador de Intenção de Baixo Custo para a Febracis.
Leia o resumo da conversa e defina a INTENÇÃO atual do lead. 

Regras de Classificação (intent):
1. "quer_comprar": O lead pediu chave PIX, link de pagamento, opções de parcelamento ou disse frases fortes como "Vou comprar", "Eu quero ir no evento".
2. "nao_qualificado": O lead disse expressamente que NÃO vai ao evento, está sem dinheiro, acha caro ou não tem interesse. 
3. "suporte_admin": O lead é parceiro, fornecedor, pede reembolso, nota fiscal ou relata problemas sistêmicos.
4. "outro": O lead fez perguntas comuns sobre o evento (local, data, preço) ou interagiu sem sinalizar decisão clara.

Resumo Atualizado da Conversa:
${newSummary}
`;

  let typifierOut: FebracisIntentOutput;
  let usageTipificador: any = {};

  try {
    const res = await withTimeout(
      generateObject({
        model,
        schema: FebracisTipificadorSchema,
        prompt: typifierSystem,
        temperature: 0.1,
      }),
      TIMEOUT_MS,
      "Typifier_timeout"
    );
    typifierOut = res.object;
    usageTipificador = res.usage || {};

    await logUsage(client, ctx.lead.clinic_id, "classifier:febracis_tipificador", usageTipificador.totalTokens || 0, {
      model: modelStr,
      latencyMs: Date.now() - t1,
    });
  } catch (err: any) {
    console.error("Febracis Typifier Error", err);
    if (isTransientAgentError(err.message)) throw err;
    return { error: err.message };
  }

  const tTotal = Date.now() - t0;

  return {
    classification: typifierOut,
    newSummary,
    telemetry: {
      totalTokens: (usageResumidor.totalTokens || 0) + (usageTipificador.totalTokens || 0),
      latencyMs: tTotal,
      model: modelStr
    }
  };
}
