import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import AiDashboard from "./AiDashboard";
import Agents from "@/pages/Agents";
import AgentMemories from "@/pages/AgentMemories";
import AiInsights from "@/pages/AiInsights";
import MetricsAiUsage from "@/pages/MetricsAiUsage";
import Broadcasts from "@/pages/Broadcasts";
import Messages, { isMessagesPath } from "./Messages";
import ScheduledReports from "@/pages/ScheduledReports";
import type { FeatureKey } from "@/lib/features";

type TabDef = {
  value: string;
  path: string;
  aliases?: string[];
  matchPrefix?: string;
  matcher?: (pathname: string) => boolean;
  label: string;
  features?: FeatureKey[];
};

const TABS: TabDef[] = [
  { value: "dashboard", path: "/ai", label: "Dashboard" },
  { value: "agents", path: "/ai/agents", aliases: ["/agents"], label: "Agentes IA", features: ["agents"] },
  {
    value: "messages",
    path: "/ai/messages",
    matcher: isMessagesPath,
    label: "Mensagens",
    features: ["sequences", "automations", "templates"],
  },
  { value: "broadcasts", path: "/ai/broadcasts", matchPrefix: "/ai/broadcasts", label: "Disparo em massa", features: ["broadcasts"] },
  { value: "reports", path: "/ai/reports", label: "Relatórios agendados" },
  { value: "memories", path: "/ai/memories", aliases: ["/agents/memories"], label: "Memórias IA", features: ["agents"] },
  { value: "insights", path: "/ai/insights", label: "Insights", features: ["agents"] },
  { value: "usage", path: "/ai/usage", aliases: ["/metrics/ai-usage"], label: "Custos", features: ["metrics_ai_usage"] },
];

export default function AiHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasFeature } = useAuth();

  const visible = TABS.filter((t) => !t.features || t.features.some((f) => hasFeature(f)));

  const current =
    visible.find((t) => t.matcher?.(location.pathname))?.value ??
    visible.find((t) => t.matchPrefix && location.pathname.startsWith(t.matchPrefix))?.value ??
    visible.find((t) => t.path === location.pathname || t.aliases?.includes(location.pathname))?.value ??
    "dashboard";

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <Tabs
          value={current}
          onValueChange={(v) => {
            const t = visible.find((x) => x.value === v);
            if (t) navigate(t.path);
          }}
        >
          <TabsList>
            {visible.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="dashboard" className="mt-0"><AiDashboard /></TabsContent>
          <TabsContent value="agents" className="mt-0"><Agents /></TabsContent>
          <TabsContent value="memories" className="mt-0"><AgentMemories /></TabsContent>
          <TabsContent value="insights" className="mt-0"><AiInsights /></TabsContent>
          <TabsContent value="usage" className="mt-0"><MetricsAiUsage /></TabsContent>
          <TabsContent value="messages" className="mt-0"><Messages /></TabsContent>
          <TabsContent value="broadcasts" className="mt-0"><Broadcasts /></TabsContent>
          <TabsContent value="reports" className="mt-0"><ScheduledReports /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
