// supabase/functions/pipeline-classify/context.ts
// Carrega LeadContext + mensagens novas (watermark) + ai_summary.
// Faz early-return signal quando não há mensagens novas.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { TREATED_STAGES } from "./schema.ts";

const MAX_MSGS = 30;
const BR_TZ = "America/Sao_Paulo";

export type Msg = {
  id: string;
  from_me: boolean;
  content: string | null;
  created_at: string;
};

export type LeadContext = {
  lead: {
    id: string;
    clinic_id: string;
    pipeline_id: string;
    stage_id: string | null;
    custom_fields: Record<string, unknown>;
    custom_fields_last_human_edit: Record<string, string>;
    tags: string[];
    last_processed_message_id_classifier: string | null;
    created_at: string | null;
    ai_summary: string | null;
  };
  stageName: string;
  messages: Msg[];
  newMessageCount: number;
  totalMessages: number;
  firstMessageAt: string | null;
  recentStageHistory: Array<{ at: string; from: string | null; to: string | null }>;
  hasBeenTreatedBefore: boolean;
  nowMs: number;
};

export type LoadResult =
  | { kind: "ok"; ctx: LeadContext }
  | { kind: "skip"; reason: string };

function fmtBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: BR_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

function ageHuman(fromIso: string, nowMs: number): string {
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return "?";
  const days = Math.floor((nowMs - t) / 86_400_000);
  if (days < 1) return "< 1 dia";
  if (days < 60) return `${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} meses`;
  return `${(days / 365).toFixed(1)} anos`;
}

export async function loadLeadContext(
  client: SupabaseClient,
  leadId: string,
): Promise<LoadResult> {
  const { data: leadRow } = await client
    .from("leads")
    .select(
      "id, clinic_id, pipeline_id, stage_id, custom_fields, custom_fields_last_human_edit, tags, last_processed_message_id_classifier, created_at, ai_summary",
    )
    .eq("id", leadId)
    .single();

  if (!leadRow) return { kind: "skip", reason: "lead_not_found" };
  if (!leadRow.pipeline_id) return { kind: "skip", reason: "no_pipeline" };

  const { data: msgsRaw } = await client
    .from("messages")
    .select("id, from_me, content, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(MAX_MSGS);
  const messages = (msgsRaw ?? []).reverse() as Msg[];
  if (messages.length === 0) return { kind: "skip", reason: "no_messages" };

  // Early-return: nada de novo desde a última classificação.
  const watermark = leadRow.last_processed_message_id_classifier as string | null;
  const lastId = messages[messages.length - 1].id;
  if (watermark && watermark === lastId) {
    return { kind: "skip", reason: "no_new_messages" };
  }
  const newMessageCount = watermark
    ? messages.filter((m) => m.id !== watermark).length // best-effort approximation
    : messages.length;

  const { data: stage } = await client
    .from("pipeline_stages")
    .select("name")
    .eq("id", leadRow.stage_id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  const [{ count: totalMessages }, { data: firstMsg }, { data: stageHistRaw }] =
    await Promise.all([
      client.from("messages").select("id", { count: "exact", head: true }).eq("lead_id", leadId),
      client
        .from("messages")
        .select("created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      client
        .from("lead_stage_history")
        .select("moved_at, from_stage_id, to_stage_id")
        .eq("lead_id", leadId)
        .order("moved_at", { ascending: false })
        .limit(8),
    ]);

  const stageIds = new Set<string>();
  for (const h of stageHistRaw ?? []) {
    if (h.from_stage_id) stageIds.add(h.from_stage_id as string);
    if (h.to_stage_id) stageIds.add(h.to_stage_id as string);
  }
  const nameMap = new Map<string, string>();
  if (stageIds.size > 0) {
    const { data: rows } = await client
      .from("pipeline_stages")
      .select("id, name")
      .in("id", Array.from(stageIds));
    for (const s of rows ?? []) nameMap.set(s.id as string, s.name as string);
  }
  const recentStageHistory = (stageHistRaw ?? []).map((h: { moved_at: string; from_stage_id: string | null; to_stage_id: string | null }) => ({
    at: h.moved_at,
    from: h.from_stage_id ? nameMap.get(h.from_stage_id) ?? null : null,
    to: h.to_stage_id ? nameMap.get(h.to_stage_id) ?? null : null,
  }));
  const tags = ((leadRow.tags ?? []) as string[]).map(String);
  const hasBeenTreatedBefore =
    recentStageHistory.some(
      (h) => (h.to && TREATED_STAGES.has(h.to)) || (h.from && TREATED_STAGES.has(h.from)),
    ) || tags.includes("paciente_antigo");

  return {
    kind: "ok",
    ctx: {
      lead: {
        id: leadRow.id as string,
        clinic_id: leadRow.clinic_id as string,
        pipeline_id: leadRow.pipeline_id as string,
        stage_id: (leadRow.stage_id as string | null) ?? null,
        custom_fields: (leadRow.custom_fields ?? {}) as Record<string, unknown>,
        custom_fields_last_human_edit: (leadRow.custom_fields_last_human_edit ?? {}) as Record<string, string>,
        tags,
        last_processed_message_id_classifier: watermark,
        created_at: (leadRow.created_at as string | null) ?? null,
        ai_summary: (leadRow.ai_summary as string | null) ?? null,
      },
      stageName: stage?.name ?? "?",
      messages,
      newMessageCount,
      totalMessages: totalMessages ?? messages.length,
      firstMessageAt: firstMsg?.created_at ?? null,
      recentStageHistory,
      hasBeenTreatedBefore,
      nowMs: Date.now(),
    },
  };
}

export function buildContextBlock(ctx: LeadContext): string {
  const nowIso = new Date(ctx.nowMs).toISOString();
  const nowLocal = fmtBR(nowIso);
  const fields = Object.keys(ctx.lead.custom_fields ?? {}).length
    ? JSON.stringify(ctx.lead.custom_fields)
    : "(vazio)";
  const history = ctx.recentStageHistory.length
    ? ctx.recentStageHistory
        .map((h) => `  - ${fmtBR(h.at)}: ${h.from ?? "?"} → ${h.to ?? "?"}`)
        .join("\n")
    : "  (sem histórico)";
  const summary = ctx.lead.ai_summary
    ? ctx.lead.ai_summary.slice(0, 800)
    : "(sem resumo)";
  return `Contexto temporal:
- Agora (${BR_TZ}): ${nowLocal} (ISO ${nowIso})
- Fuso para datas relativas: ${BR_TZ} (offset -03:00)

Contexto do lead:
- Stage atual: ${ctx.stageName}
- Tags atuais: ${ctx.lead.tags.length ? ctx.lead.tags.join(", ") : "nenhuma"}
- custom_fields atuais: ${fields}
- Lead criado: ${ctx.lead.created_at ? `${fmtBR(ctx.lead.created_at)} (há ${ageHuman(ctx.lead.created_at, ctx.nowMs)})` : "?"}
- Total de mensagens: ${ctx.totalMessages}${ctx.firstMessageAt ? ` (primeira em ${fmtBR(ctx.firstMessageAt)})` : ""}
- Já passou por tratamento/alta antes? ${ctx.hasBeenTreatedBefore ? "SIM" : "não detectado"}
- Últimos stage moves:
${history}
- Resumo de atendimento (ai_summary):
${summary}`;
}

export function formatMessages(msgs: Msg[]): string {
  return msgs
    .map(
      (m) =>
        `[${fmtBR(m.created_at)}] ${m.from_me ? "ATENDENTE" : "LEAD"}: ${(m.content ?? "").slice(0, 600)}`,
    )
    .join("\n");
}
