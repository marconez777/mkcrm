// Helper para moves manuais de lead (Kanban / dialogs).
// - Calcula `manual_lock_until` (7 dias) para o `field-rules-tick` pular o lead.
// - Quando o destino é uma etapa de "desqualificado" (nome contém "não qualificado"),
//   marca também `custom_fields.qualificacao = "desqualificado"` para que, ao
//   expirar o lock, a regra automática mantenha o lead na coluna em vez de
//   reclassificá-lo como "interessado".

import type { Stage } from "@/types/crm";

export const MANUAL_LOCK_MS = 7 * 24 * 60 * 60 * 1000;

export function manualLockUntilIso(): string {
  return new Date(Date.now() + MANUAL_LOCK_MS).toISOString();
}

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
    // I6 (trigger no banco): desqualificado exige motivo. Default 'outro' em moves manuais
    // — o usuário pode refinar depois (ex.: 'fora_perfil' p/ consulta fora do país).
    motivo_desqualificacao: hasMotivo ? cur.motivo_desqualificacao : "outro",
  };
}
