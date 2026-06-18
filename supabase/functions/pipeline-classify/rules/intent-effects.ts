// supabase/functions/pipeline-classify/rules/intent-effects.ts
// Wrapper fino sobre os efeitos colaterais existentes em _shared/pipeline-fase4
// e _shared/pipeline-tasks. Preserva o comportamento de v1.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { runNfTask, runPaymentAlleged } from "../../_shared/pipeline-tasks.ts";
import {
  runJudicializacao,
  runRenovacaoReceita,
  runObjectionSuggest,
} from "../../_shared/pipeline-fase4.ts";

export type IntentEffectsResult = Record<string, unknown>;

export async function runIntentEffects(
  client: SupabaseClient,
  args: {
    intent: string;
    leadId: string;
    clinicId: string;
    stageName: string | null;
    reasons: string[];
  },
): Promise<IntentEffectsResult> {
  const out: IntentEffectsResult = {};
  if (args.intent === "nf_reembolso") {
    out.nf_task = await runNfTask(client, {
      leadId: args.leadId,
      clinicId: args.clinicId,
      stageName: args.stageName,
    });
  }
  if (args.intent === "pagamento_alegado") {
    out.payment_alleged = await runPaymentAlleged(client, {
      leadId: args.leadId,
      clinicId: args.clinicId,
    });
  }
  if (args.intent === "judicializacao") {
    out.judicializacao = await runJudicializacao(client, {
      leadId: args.leadId,
      clinicId: args.clinicId,
      reasons: args.reasons,
    });
  }
  if (args.intent === "renovacao_receita") {
    out.renovacao_receita = await runRenovacaoReceita(client, {
      leadId: args.leadId,
      clinicId: args.clinicId,
      stageName: args.stageName,
    });
  }
  if (args.intent === "objecao") {
    out.objection_suggest = await runObjectionSuggest(client, {
      leadId: args.leadId,
      clinicId: args.clinicId,
      reasons: args.reasons,
    });
  }
  return out;
}
