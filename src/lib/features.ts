// Catálogo de features que o super admin pode habilitar/desabilitar por clínica.
// Convenção: chave ausente em clinics.settings.features = liberada (default-on).

export type FeatureKey =
  | "inbox"
  | "tasks"
  | "agents"
  | "automations"
  | "sequences"
  | "templates"
  | "metrics"
  | "metrics_ai"
  | "metrics_ai_usage"
  
  | "custom_fields"
  | "team"
  | "email_marketing"
  | "broadcasts";

export const FEATURES: { key: FeatureKey; label: string; description?: string }[] = [
  { key: "inbox", label: "Conversas (Inbox)" },
  { key: "tasks", label: "Tarefas" },
  { key: "agents", label: "Agentes IA" },
  { key: "automations", label: "Automações" },
  { key: "sequences", label: "Sequências" },
  { key: "templates", label: "Templates" },
  { key: "metrics", label: "Métricas (Operação)" },
  { key: "metrics_ai", label: "Métricas IA" },
  { key: "metrics_ai_usage", label: "Custos IA" },
  
  { key: "custom_fields", label: "Campos personalizados" },
  { key: "team", label: "Equipe" },
  { key: "email_marketing", label: "Email Marketing", description: "Templates, automações e campanhas por email" },
  { key: "broadcasts", label: "Disparo em massa WhatsApp", description: "Campanhas de envio em massa via WhatsApp com rotação de grupos" },
];

export function isFeatureEnabled(
  features: Record<string, boolean> | null | undefined,
  key: FeatureKey,
): boolean {
  if (!features) return true;
  const v = features[key];
  return v !== false;
}
