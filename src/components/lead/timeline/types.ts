export type TimelineCategory = "site" | "whatsapp" | "stage" | "note" | "task" | "crm";

export type TimelineItem = {
  id: string;
  at: string; // ISO
  category: TimelineCategory;
  title: string;
  subtitle?: string;
  meta?: Record<string, unknown> | null;
};

export const CATEGORY_LABEL: Record<TimelineCategory, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  stage: "Etapas",
  note: "Notas",
  task: "Tarefas",
  crm: "CRM",
};

export const CATEGORY_ORDER: TimelineCategory[] = ["site", "whatsapp", "stage", "note", "task", "crm"];

const CATEGORY_RANK: Record<TimelineCategory, number> = {
  stage: 0, note: 1, whatsapp: 2, task: 3, crm: 4, site: 5,
};

export function compareItems(a: TimelineItem, b: TimelineItem) {
  const da = new Date(b.at).getTime() - new Date(a.at).getTime();
  if (da !== 0) return da;
  return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
}

const EVENT_NAME_PT: Record<string, string> = {
  page_view: "Visitou página",
  whatsapp_click: "Clicou no WhatsApp",
  form_start: "Começou formulário",
  form_submit_attempt: "Tentou enviar formulário",
  form_submit_success: "Enviou formulário",
  mental_test_start: "Iniciou teste",
  mental_test_completed: "Concluiu teste",
  lead_identified: "Lead identificado",
};

export function trackingEventTitle(name: string) {
  return EVENT_NAME_PT[name] || name;
}
