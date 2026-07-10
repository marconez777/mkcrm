/**
 * URL canônica do app em produção.
 * Usada em fluxos onde o destino DEVE ser independente de onde o usuário
 * abriu o formulário (ex.: links em emails de reset de senha).
 *
 * Domínio oficial: chatfunnelai.com.
 * Domínios legados (mkcrm.lovable.app, crm.mkart.com.br) podem permanecer
 * no allowlist do Auth durante o cutover, mas não devem ser usados aqui.
 */
export const APP_BASE_URL = "https://chatfunnelai.com";

const LEGACY_APP_ORIGINS = ["https://crm.mkart.com.br", "https://mkcrm.lovable.app"];

export function buildInviteUrl(inviteUrl?: string | null, token?: string | null) {
  if (token) return `${APP_BASE_URL}/invite/${token}`;
  if (!inviteUrl) return "";
  return LEGACY_APP_ORIGINS.reduce(
    (url, legacyOrigin) => url.replace(legacyOrigin, APP_BASE_URL),
    inviteUrl,
  );
}
