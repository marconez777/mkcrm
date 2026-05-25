/**
 * URL canônica do app em produção.
 * Usada em fluxos onde o destino DEVE ser independente de onde o usuário
 * abriu o formulário (ex.: links em emails de reset de senha).
 *
 * Tanto crm.mkart.com.br quanto mkcrm.lovable.app estão no allowlist
 * do Supabase Auth, mas só este aqui é o domínio oficial.
 */
export const APP_BASE_URL = "https://crm.mkart.com.br";
