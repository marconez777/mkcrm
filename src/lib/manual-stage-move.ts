// Helper para moves manuais de lead (Kanban / dialogs).
// PR4 — `manual_lock_until` foi removido. Este helper agora apenas calcula
// o patch de `custom_fields` quando o destino é uma etapa de "desqualificado".

import type { Stage } from "@/types/crm";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isDisqualifiedStage(stage: Stage | undefined | null): boolean {
  if (!stage?.name) return false;
  return normalize(stage.name).includes("nao qualificado");
}

/**
 * Retorna patch parcial de `custom_fields` (já mesclado com o atual) quando
 * o destino é uma etapa de desqualificação. Retorna `undefined` se não precisa
 * mexer em custom_fields.
 */
export function customFieldsPatchForStage(
  currentCustomFields: Record<string, unknown> | null | undefined,
  targetStage: Stage | undefined | null,
): Record<string, unknown> | undefined {
  if (!isDisqualifiedStage(targetStage)) return undefined;
  const cur = (currentCustomFields ?? {}) as Record<string, unknown>;
  const alreadyDisq = cur.qualificacao === "desqualificado";
  const hasMotivo = typeof cur.motivo_desqualificacao === "string" && cur.motivo_desqualificacao;
  if (alreadyDisq && hasMotivo) return undefined;
  return {
    ...cur,
    qualificacao: "desqualificado",
    motivo_desqualificacao: hasMotivo ? cur.motivo_desqualificacao : "outro",
  };
}
