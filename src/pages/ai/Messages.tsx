import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import Sequences from "@/pages/Sequences";
import Automations from "@/pages/Automations";
import Templates from "@/pages/Templates";
import MetricsEngagement from "@/pages/MetricsEngagement";
import type { FeatureKey } from "@/lib/features";

type SubTab = { value: string; label: string; feature?: FeatureKey; paths: string[] };

// Aliases legados (`/ai/engagement`, `/metrics/engagement`, `/metrics`,
// `/ai/sequences`, etc.) abrem a aba certa sem redirect — preservando
// histórico/bookmarks/links externos.
const SUBS: SubTab[] = [
  { value: "sequences", label: "Sequências", feature: "sequences", paths: ["/ai/messages/sequences", "/ai/sequences", "/sequences"] },
  { value: "automations", label: "Automações", feature: "automations", paths: ["/ai/messages/automations", "/ai/automations", "/automations"] },
  { value: "templates", label: "Templates", feature: "templates", paths: ["/ai/messages/templates", "/ai/templates", "/templates"] },
  { value: "engagement", label: "Engajamento", paths: ["/ai/messages/engagement", "/ai/engagement", "/metrics/engagement", "/metrics"] },
];

export function isMessagesPath(pathname: string): boolean {
  if (pathname.startsWith("/ai/messages")) return true;
  return SUBS.some((s) => s.paths.includes(pathname));
}

export default function Messages() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasFeature } = useAuth();

  const visible = SUBS.filter((s) => !s.feature || hasFeature(s.feature));
  const current =
    visible.find((s) => s.paths.includes(location.pathname))?.value ??
    visible[0]?.value ??
    "sequences";

  if (visible.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nenhum módulo de mensagens habilitado.
      </div>
    );
  }

  return (
    <Tabs
      value={current}
      onValueChange={(v) => navigate(`/ai/messages/${v}`)}
      className="mt-4"
    >
      <TabsList>
        {visible.map((s) => (
          <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
        ))}
      </TabsList>
      {visible.some((s) => s.value === "sequences") && (
        <TabsContent value="sequences" className="mt-0"><Sequences /></TabsContent>
      )}
      {visible.some((s) => s.value === "automations") && (
        <TabsContent value="automations" className="mt-0"><Automations /></TabsContent>
      )}
      {visible.some((s) => s.value === "templates") && (
        <TabsContent value="templates" className="mt-0"><Templates /></TabsContent>
      )}
      {visible.some((s) => s.value === "engagement") && (
        <TabsContent value="engagement" className="mt-0"><MetricsEngagement /></TabsContent>
      )}
    </Tabs>
  );
}
