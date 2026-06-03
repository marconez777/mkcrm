export const LIMIT_DEFS: { key: string; label: string; unit: string }[] = [
  { key: "max_users", label: "Máx. usuários", unit: "usuários" },
  { key: "max_leads", label: "Máx. leads", unit: "leads" },
  { key: "max_whatsapp_instances", label: "Conexões WhatsApp", unit: "instâncias" },
  { key: "max_messages_month", label: "Mensagens / mês", unit: "msgs" },
  { key: "max_broadcasts_month", label: "Disparos em massa / mês", unit: "broadcasts" },
  { key: "max_emails_month", label: "E-mails enviados / mês", unit: "e-mails" },
  { key: "max_email_domains", label: "Domínios de e-mail", unit: "domínios" },
  { key: "ai_monthly_usd_cap", label: "Teto mensal IA (USD)", unit: "USD" },
  { key: "max_ai_agents", label: "Agentes de IA", unit: "agentes" },
  { key: "max_kb_documents", label: "Documentos na base de conhecimento", unit: "docs" },
  { key: "storage_mb", label: "Armazenamento total", unit: "MB" },
];

export const USAGE_KEY_MAP: Record<string, string> = {
  max_users: "members",
  max_leads: "leads_total",
  max_whatsapp_instances: "whatsapp_instances",
  max_messages_month: "messages_month",
  max_broadcasts_month: "broadcasts_month",
  max_emails_month: "emails_month",
  max_email_domains: "email_domains",
  ai_monthly_usd_cap: "ai_usd_month",
  max_ai_agents: "ai_agents",
  max_kb_documents: "kb_documents",
};
