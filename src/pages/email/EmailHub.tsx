import { useLocation, useNavigate } from "react-router-dom";
import EmailDashboard from "./EmailDashboard";
import EmailTemplates from "./EmailTemplates";
import EmailAutomations from "./EmailAutomations";
import EmailCampaigns from "./EmailCampaigns";
import EmailQueue from "./EmailQueue";
import EmailLogs from "./EmailLogs";
import EmailSegments from "./EmailSegments";
import EmailUnsubscribes from "./EmailUnsubscribes";
import EmailReports from "./EmailReports";
import EmailContacts from "./EmailContacts";
import {
  LayoutDashboard,
  FileText,
  Workflow,
  Send,
  BarChart3,
  Users,
  Contact,
  ListOrdered,
  ScrollText,
  UserMinus,
} from "lucide-react";
import { CategoryTabs, type CategoryTab } from "@/components/ui/category-tabs";

type TabDef = CategoryTab & { path: string };

const TABS: TabDef[] = [
  { value: "dashboard", path: "/email", label: "Dashboard", icon: LayoutDashboard, accent: "slate" },
  { value: "templates", path: "/email/templates", label: "Templates", icon: FileText, accent: "primary" },
  { value: "automations", path: "/email/automations", label: "Automações", icon: Workflow, accent: "violet" },
  { value: "campaigns", path: "/email/campaigns", label: "Campanhas", icon: Send, accent: "info" },
  { value: "reports", path: "/email/reports", label: "Relatórios", icon: BarChart3, accent: "cyan" },
  { value: "segments", path: "/email/segments", label: "Segmentos", icon: Users, accent: "fuchsia" },
  { value: "contacts", path: "/email/contacts", label: "Contatos", icon: Contact, accent: "teal" },
  { value: "queue", path: "/email/queue", label: "Fila", icon: ListOrdered, accent: "amber" },
  { value: "logs", path: "/email/logs", label: "Logs", icon: ScrollText, accent: "slate" },
  { value: "unsubscribes", path: "/email/unsubscribes", label: "Descadastros", icon: UserMinus, accent: "destructive" },
];

const VIEWS: Record<string, React.ComponentType> = {
  dashboard: EmailDashboard,
  templates: EmailTemplates,
  automations: EmailAutomations,
  campaigns: EmailCampaigns,
  reports: EmailReports,
  segments: EmailSegments,
  contacts: EmailContacts,
  queue: EmailQueue,
  logs: EmailLogs,
  unsubscribes: EmailUnsubscribes,
};

export default function EmailHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = TABS.find((t) => t.path === location.pathname)?.value ?? "dashboard";
  const ActiveView = VIEWS[current] ?? EmailDashboard;

  return (
    <div className="h-full overflow-auto bg-[hsl(var(--surface-muted))]">
      <div className="mx-auto max-w-6xl px-6 pt-8 pb-12">
        <CategoryTabs
          tabs={TABS}
          value={current}
          onChange={(v) => {
            const t = TABS.find((x) => x.value === v);
            if (t) navigate(t.path);
          }}
          ariaLabel="Seções de Email"
        />
        <div className="mt-4">
          <ActiveView />
        </div>
      </div>
    </div>
  );
}
