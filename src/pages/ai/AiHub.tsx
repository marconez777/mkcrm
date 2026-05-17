import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import AiDashboard from "./AiDashboard";
import Agents from "@/pages/Agents";
import AgentMemories from "@/pages/AgentMemories";
import MetricsAiUsage from "@/pages/MetricsAiUsage";
import Automations from "@/pages/Automations";
import Templates from "@/pages/Templates";
import Sequences from "@/pages/Sequences";
import Broadcasts from "@/pages/Broadcasts";

type TabDef = { value: string; path: string; aliases?: string[]; matchPrefix?: string; label: string; feature?: "agents" | "metrics_ai_usage" | "automations" | "templates" | "sequences" | "broadcasts" };

const TABS: TabDef[] = [
  { value: "dashboard", path: "/ai", label: "Dashboard" },
  { value: "agents", path: "/ai/agents", aliases: ["/agents"], label: "Agentes IA", feature: "agents" },
  { value: "memories", path: "/ai/memories", aliases: ["/agents/memories"], label: "Memórias IA", feature: "agents" },
  { value: "usage", path: "/ai/usage", aliases: ["/metrics/ai-usage"], label: "Custos IA", feature: "metrics_ai_usage" },
  { value: "automations", path: "/ai/automations", aliases: ["/automations"], label: "Automações", feature: "automations" },
  { value: "sequences", path: "/ai/sequences", aliases: ["/sequences"], label: "Sequências", feature: "sequences" },
  { value: "broadcasts", path: "/ai/broadcasts", matchPrefix: "/ai/broadcasts", label: "Disparo em massa", feature: "broadcasts" },
  { value: "templates", path: "/ai/templates", aliases: ["/templates"], label: "Templates", feature: "templates" },
];

export default function AiHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasFeature } = useAuth();

  const visible = TABS.filter((t) => !t.feature || hasFeature(t.feature));

  const current =
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
          <TabsContent value="usage" className="mt-0"><MetricsAiUsage /></TabsContent>
          <TabsContent value="automations" className="mt-0"><Automations /></TabsContent>
          <TabsContent value="sequences" className="mt-0"><Sequences /></TabsContent>
          <TabsContent value="broadcasts" className="mt-0"><Broadcasts /></TabsContent>
          <TabsContent value="templates" className="mt-0"><Templates /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
