// Converte o texto técnico gravado em `detail`/`last_error` da fila
// ("send 400: {json}", "ai-chat 500: {json}", "400: {json}", "HTTP 502 …"
// ou mensagens soltas) numa chave amigável, traduzida em queueLogs.errors.*.

export type QueueErrorKey =
  | "noInstance"
  | "instanceDisconnected"
  | "connectionClosed"
  | "numberInvalid"
  | "aiQuota"
  | "aiKeyInvalid"
  | "aiFailed"
  | "missingAgent"
  | "stageMissing"
  | "templateMissing"
  | "unknownAction"
  | "emptyContent"
  | "sendUnconfirmed"
  | "moveCrossingBlocked"
  | "moveDestinationLocked"
  | "moveAutoDisabled"
  | "moveAlreadyDone"
  | "movePipelineNotEnabled"
  | "leadNotFound"
  | "rateLimited"
  | "networkIssue"
  | "sendRetriesExhausted"
  | "http401"
  | "http404"
  | "http409"
  | "http4xx"
  | "http5xx"
  | "unknown";

// Ordem importa: padrões específicos primeiro; `sendRetriesExhausted` por
// último porque costuma embrulhar um motivo mais específico no `detail`.
// `.` no lugar de letras acentuadas porque \w do JS é ASCII-only.
const RULES: Array<[QueueErrorKey, RegExp]> = [
  ["noInstance", /nenhuma inst.ncia whatsapp/i],
  ["instanceDisconnected", /inst.ncia whatsapp n.o est. conectada|est. com status/i],
  ["connectionClosed", /connection closed/i],
  ["numberInvalid", /not a valid whatsapp|does not exist|not registered|no whatsapp account|"exists"\s*:\s*false|n.mero .{0,12}(inv.lido|n.o existe)/i],
  ["aiQuota", /insufficient_quota|exceeded your current quota|credit balance|quota exceeded|billing_not_active/i],
  ["aiKeyInvalid", /incorrect api key|invalid[ _]api[ _]key|api key not valid|api_key_invalid/i],
  ["missingAgent", /missing agent_id/i],
  ["stageMissing", /missing stage_id|to_stage_not_found/i],
  ["templateMissing", /missing template_id|template not found/i],
  ["unknownAction", /unknown action/i],
  ["emptyContent", /empty content/i],
  ["sendUnconfirmed", /sem id de mensagem|falha ao confirmar envio/i],
  // Recusas do pipelineMove (gates) quando a acao "mover de estagio" nao executa.
  ["moveCrossingBlocked", /gate_g9_crossing|guard_d3/i],
  ["moveDestinationLocked", /gate_g2_destination_locked/i],
  ["moveAutoDisabled", /gate_g3_disabled/i],
  ["moveAlreadyDone", /already_at_destination|idempotent:/i],
  ["movePipelineNotEnabled", /clinic_not_allowlisted|pipeline_not_in_ai_targets/i],
  ["leadNotFound", /lead n.o encontrad|lead_not_found/i],
  ["rateLimited", /rate limit|too many requests|(^|\s)429\s*:/i],
  ["networkIssue", /\btime ?out|\btimed out|network error|fetch failed|error sending request|socket hang|econnrefused|unreachable/i],
  ["sendRetriesExhausted", /falha ao enviar ap.s tentativas/i],
];

export function explainQueueError(detail: string | null | undefined): QueueErrorKey {
  const raw = (detail ?? "").trim();
  if (!raw) return "unknown";

  for (const [key, re] of RULES) {
    if (re.test(raw)) return key;
  }

  if (/^ai-chat\b/i.test(raw)) return "aiFailed";

  // Fallback pelo código HTTP ("send 400:", "HTTP 502", "409: {…}", "status":400).
  const m = raw.match(/(?:^|[\s(":,])([45]\d{2})(?!\d)/);
  const status = m ? parseInt(m[1], 10) : null;
  if (status === 401 || status === 403) return "http401";
  if (status === 404) return "http404";
  if (status === 409) return "http409";
  if (status !== null && status >= 500) return "http5xx";
  if (status !== null && status >= 400) return "http4xx";

  return "unknown";
}
