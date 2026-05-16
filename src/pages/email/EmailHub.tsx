import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EmailDashboard from "./EmailDashboard";
import EmailTemplates from "./EmailTemplates";
import EmailAutomations from "./EmailAutomations";
import EmailCampaigns from "./EmailCampaigns";

const TABS = [
  { value: "dashboard", path: "/email", label: "Dashboard" },
  { value: "templates", path: "/email/templates", label: "Templates" },
  { value: "automations", path: "/email/automations", label: "Automações" },
  { value: "campaigns", path: "/email/campaigns", label: "Campanhas" },
];

export default function EmailHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = TABS.find((t) => t.path === location.pathname)?.value ?? "dashboard";

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <Tabs
          value={current}
          onValueChange={(v) => {
            const t = TABS.find((x) => x.value === v);
            if (t) navigate(t.path);
          }}
        >
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="dashboard" className="mt-0"><EmailDashboard /></TabsContent>
          <TabsContent value="templates" className="mt-0"><EmailTemplates /></TabsContent>
          <TabsContent value="automations" className="mt-0"><EmailAutomations /></TabsContent>
          <TabsContent value="campaigns" className="mt-0"><EmailCampaigns /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
