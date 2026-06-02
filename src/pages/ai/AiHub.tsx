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
import { cn } from "@/lib/utils";

type TabDef = {
  value: string;
  path: string;
  aliases?: string[];
  matchPrefix?: string;
  matcher?: (pathname: string) => boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  features?: FeatureKey[];
};

const TABS: TabDef[] = [
  { value: "dashboard", path: "/ai", label: "Dashboard", icon: LayoutDashboard },
  { value: "agents", path: "/ai/agents", aliases: ["/agents"], label: "Agentes IA", icon: Bot, features: ["agents"] },
  {
    value: "messages",
    path: "/ai/messages",
    matcher: isMessagesPath,
    label: "Mensagens",
    icon: MessageSquare,
    features: ["sequences", "automations", "templates"],
  },
  { value: "broadcasts", path: "/ai/broadcasts", matchPrefix: "/ai/broadcasts", label: "Disparo em massa", icon: Megaphone, features: ["broadcasts"] },
  { value: "reports", path: "/ai/reports", label: "Relatórios", icon: FileBarChart },
  { value: "memories", path: "/ai/memories", aliases: ["/agents/memories"], label: "Memórias IA", icon: BrainCircuit, features: ["agents"] },
  { value: "insights", path: "/ai/insights", label: "Insights", icon: Sparkles, features: ["agents"] },
  { value: "usage", path: "/ai/usage", aliases: ["/metrics/ai-usage"], label: "Custos", icon: Wallet, features: ["metrics_ai_usage"] },
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
        <nav
          role="tablist"
          aria-label="Seções de IA"
          className="relative flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-card/60 p-1.5 shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-12px_rgba(15,23,42,0.08)] backdrop-blur"
        >
          {visible.map((t) => {
            const Icon = t.icon;
            const active = current === t.value;
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={active}
                onClick={() => navigate(t.path)}
                className={cn(
                  "group relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium outline-none transition-all duration-200",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "bg-gradient-to-b from-primary to-[hsl(var(--primary-glow))] text-primary-foreground shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.55),0_1px_0_0_rgba(255,255,255,0.25)_inset]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    active ? "scale-105" : "opacity-70 group-hover:opacity-100"
                  )}
                />
                <span className="whitespace-nowrap">{t.label}</span>
                {active && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-6">
          <ActiveView />
        </div>
      </div>
    </div>
  );
}
