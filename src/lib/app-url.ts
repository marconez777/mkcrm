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
