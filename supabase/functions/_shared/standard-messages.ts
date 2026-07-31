/**
 * Detecção de mensagens padrão (não humanas / sem intenção real).
 *
 * 1) Prefilled do click-to-chat: o site abre o WhatsApp com um texto pronto
 *    contendo o código de tracking (ref=...). Não representa intenção do lead.
 * 2) Auto-reply da clínica: saudação automática configurada no próprio WhatsApp.
 *    Não representa resposta humana da secretária.
 */

const PREFILLED_RE =
  /(mantenha\s+esse\s+c[óo]digo\s+na\s+sua\s+mensagem|\(\s*ref\s*=\s*[a-z0-9]{4,}\s*\))/i;

const AUTO_REPLY_RE =
  /(obrigad[ao]\s+pelo\s+contato|aguarde\s+alguns?\s+instantes|j[áa]\s+iremos\s+te\s+atender|em\s+breve\s+(um|uma)\s+(de\s+nossos?\s+)?atendentes?|nosso\s+hor[áa]rio\s+de\s+atendimento)/i;

export function isPrefilledTrackingMessage(content?: string | null): boolean {
  const text = (content ?? "").trim();
  if (!text) return false;
  return PREFILLED_RE.test(text);
}

export function isAutoReplyMessage(content?: string | null): boolean {
  const text = (content ?? "").trim();
  if (!text) return false;
  return AUTO_REPLY_RE.test(text);
}
