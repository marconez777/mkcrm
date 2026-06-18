// supabase/functions/pipeline-classify/agent-core.ts
// Agente único — extrai fatos + sugere stage/tags em UMA chamada gpt-5-mini.
// Datas NÃO são convertidas pelo LLM: ele apenas devolve a string crua + anchor_iso
// da mensagem que cita. A conversão para ISO ocorre em date-parser.ts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateText, tool, Output, stepCountIs } from "npm:ai@^6";
import { z } from "npm:zod@^3";
import { getClinicOpenAI } from "../_shared/clinic-openai.ts";
import { buildContextBlock, formatMessages, type LeadContext } from "./context.ts";
import {
  CANON_NAMES,
  ClassificationSchemaV2,
  normalizeClassification,
  type ClassificationV2,
} from "./schema.ts";

const MODEL = "gpt-5-mini";

function buildSystem(ctx: LeadContext): string {
  return `Você é o classificador determinístico do pipeline de CRM médico (v4.2).
Sua tarefa: ler o histórico recente do lead e devolver UMA classificação JSON.

Pipeline canônico (use EXATAMENTE estes nomes em stage_suggestion):
${CANON_NAMES.map((n) => `- ${n}`).join("\n")}

Diretrizes de stage:
- "Novo": primeira interação, sem qualificação humana.
- "Qualificação": atendente humano já interagiu descobrindo demanda.
- "Consulta agendada"/"Tratamento agendado": agendamento confirmado.
- "Consulta finalizada"/"Em tratamento": atendimento já realizado.
- "Sem resposta": lead parou de responder.
- "Nutrição inativa": sem retorno há muito tempo.
- "Paciente antigo": ciclo de tratamento já encerrado.
- "B2B / Stakeholders": contato comercial/parceria, NÃO paciente.

Regras gerais:
- confidence reflete sua certeza (escala): 0.0-0.5 ambíguo, 0.5-0.75 razoável, 0.75-0.9 alto, 0.9-1 inequívoco.
- is_b2b=true SOMENTE se o lead claramente representa empresa/parceiro/fornecedor.
- tags_suggested: liste TODAS as tags que devem estar no lead após a classificação
  (snake_case ou Título curto). O sistema computa o que adicionar e o que remover.
- reasons: 1-5 frases curtas em PT-BR justificando.

REGRAS DE DATAS (mentioned_dates):
- NÃO converta. NÃO devolva ISO. Apenas extraia a string crua exatamente como aparece
  ("amanhã às 15h", "quinta-feira", "dia 24/06") e o "anchor_iso" = timestamp ISO
  da MENSAGEM que cita a data (já presente entre colchetes no histórico, no fuso ${"America/Sao_Paulo"}).
- "kind": "consulta" para primeiras consultas / avaliações; "procedimento" para
  procedimento/tratamento agendado.
- Só inclua a menção se o LEAD ou ATENDENTE confirmou dia E hora.
- Se houver qualquer ambiguidade, NÃO inclua. O parser determinístico vai resolver as
  strings que você passar — passe poucas e confiáveis.

REGRA DE "1ª consulta":
- Se houver evidência de atendimento anterior (no histórico, no resumo de atendimento,
  passou por "Em tratamento"/"Consulta finalizada"/"Paciente antigo", ou tag "paciente_antigo"),
  NÃO sugira "1ª consulta". Para retorno, prefira "retorno".
- O sistema valida e remove "1ª consulta" automaticamente se for incorreto — mas evite sugerir.

Campo intent (escolha UM):
- "agendamento", "reagendamento", "duvida_geral", "nf_reembolso",
  "pagamento_alegado", "desistencia", "interesse_tratamento", "judicializacao",
  "renovacao_receita", "objecao", "outro".

${buildContextBlock(ctx)}`;
}

export async function runAgent(
  client: SupabaseClient,
  ctx: LeadContext,
  opts: { historyToolEnabled: boolean },
): Promise<{ classification: ClassificationV2; usage?: unknown } | { error: string }> {
  const ai = await getClinicOpenAI(client, ctx.lead.clinic_id);
  if (!ai) return { error: "no_clinic_openai_key" };

  const tools = opts.historyToolEnabled
    ? {
        get_lead_history: tool({
          description:
            "Retorna eventos passados e classificações anteriores do mesmo lead (último ano, máx 30 itens). Use apenas se o snippet recente não bastar.",
          inputSchema: z.object({ lead_id: z.string().uuid() }),
          execute: async ({ lead_id }: { lead_id: string }) => {
            if (lead_id !== ctx.lead.id) return { error: "lead_id_mismatch" };
            const { data: events } = await client
              .from("lead_events")
              .select("type, payload, created_at")
              .eq("lead_id", ctx.lead.id)
              .order("created_at", { ascending: false })
              .limit(30);
            return { events: events ?? [] };
          },
        }),
      }
    : undefined;

  const result = await generateText({
    model: ai.model(MODEL),
    system: buildSystem(ctx),
    prompt: `Histórico recente do lead (id=${ctx.lead.id}):\n\n${formatMessages(ctx.messages)}\n\nClassifique agora.`,
    output: Output.object({ schema: ClassificationSchemaV2 }),
    tools,
    stopWhen: stepCountIs(50),
  });

  return {
    classification: result.output as ClassificationV2,
    usage: (result as { usage?: unknown }).usage,
  };
}

export const AGENT_MODEL = MODEL;
