// supabase/functions/pipeline-classify/date-parser.ts
// Parser 100% determinístico. Recebe `mentioned_dates` do LLM (string raw +
// anchor_iso da mensagem que citou) e devolve ISO resolvido em America/Sao_Paulo
// via `parseFutureDateInTZ()` compartilhado. Sem LLM aqui.

import { parseFutureDateInTZ } from "../_shared/dates.ts";

export type MentionedDate = {
  raw: string;
  anchor_iso: string;
  kind: "consulta" | "procedimento";
};

export type ResolvedDate = MentionedDate & {
  resolved: string | null; // ISO UTC
  rejected_reason: null | "anchor_invalid" | "ambiguous_or_past" | "too_far_future";
};

const NINETY_DAYS_MS = 90 * 24 * 3600 * 1000;
const TZ = "America/Sao_Paulo";

export function resolveMentionedDates(
  mentioned: MentionedDate[],
  now: Date = new Date(),
): ResolvedDate[] {
  return (mentioned ?? []).map((m) => {
    const anchorMs = Date.parse(m.anchor_iso);
    if (!Number.isFinite(anchorMs)) {
      return { ...m, resolved: null, rejected_reason: "anchor_invalid" };
    }
    const anchor = new Date(anchorMs);
    const r = parseFutureDateInTZ(m.raw, TZ, anchor);
    if (!r) {
      return { ...m, resolved: null, rejected_reason: "ambiguous_or_past" };
    }
    if (r.getTime() > now.getTime() + NINETY_DAYS_MS) {
      return { ...m, resolved: null, rejected_reason: "too_far_future" };
    }
    return { ...m, resolved: r.toISOString(), rejected_reason: null };
  });
}

export function fieldKeyFor(kind: MentionedDate["kind"]): string {
  return kind === "consulta" ? "consulta_agendada_em" : "procedimento_agendado_em";
}
