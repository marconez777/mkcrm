import { useLocation, useNavigate } from "react-router-dom";
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
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Megaphone,
  FileBarChart,
  BrainCircuit,
  Sparkles,
  Wallet,
} from "lucide-react";
import { CategoryTabs, type CategoryTab, type TabAccent } from "@/components/ui/category-tabs";

type TabDef = CategoryTab & {
  path: string;
  aliases?: string[];
  matchPrefix?: string;
  matcher?: (pathname: string) => boolean;
  features?: FeatureKey[];
};

const TABS: TabDef[] = [
  { value: "dashboard", path: "/ai", label: "Dashboard", icon: LayoutDashboard, accent: "slate" satisfies TabAccent },
  { value: "agents", path: "/ai/agents", aliases: ["/agents"], label: "Agentes IA", icon: Bot, accent: "primary", features: ["agents"] },
  {
    value: "messages",
    path: "/ai/messages",
    matcher: isMessagesPath,
    label: "Mensagens",
    icon: MessageSquare,
    accent: "info",
    features: ["sequences", "automations", "templates"],
  },
  { value: "broadcasts", path: "/ai/broadcasts", matchPrefix: "/ai/broadcasts", label: "Disparo em massa", icon: Megaphone, accent: "violet", features: ["broadcasts"] },
  { value: "reports", path: "/ai/reports", label: "Relatórios", icon: FileBarChart, accent: "cyan" },
  { value: "memories", path: "/ai/memories", aliases: ["/agents/memories"], label: "Memórias IA", icon: BrainCircuit, accent: "fuchsia", features: ["agents"] },
  { value: "insights", path: "/ai/insights", label: "Insights", icon: Sparkles, accent: "amber", features: ["agents"] },
  { value: "usage", path: "/ai/usage", aliases: ["/metrics/ai-usage"], label: "Custos", icon: Wallet, accent: "emerald", features: ["metrics_ai_usage"] },
];

const VIEWS: Record<string, React.ComponentType> = {
  dashboard: AiDashboard,
  agents: Agents,
  memories: AgentMemories,
  insights: AiInsights,
  usage: MetricsAiUsage,
  messages: Messages,
  broadcasts: Broadcasts,
  reports: ScheduledReports,
};

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

  const ActiveView = VIEWS[current] ?? AiDashboard;

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <CategoryTabs
          tabs={visible}
          value={current}
          onChange={(v) => {
            const t = visible.find((x) => x.value === v);
            if (t) navigate(t.path);
          }}
          ariaLabel="Seções de IA"
        />
        <div className="mt-6">
          <ActiveView />
        </div>
      </div>
    </div>
  );
}
