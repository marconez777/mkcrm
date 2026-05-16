import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import Auth from "./pages/Auth";
import Kanban from "./pages/Kanban";
import Inbox from "./pages/Inbox";
import Agents from "./pages/Agents";
import Automations from "./pages/Automations";
import Sequences from "./pages/Sequences";
import Templates from "./pages/Templates";
import Metrics from "./pages/Metrics";
import MetricsOps from "./pages/MetricsOps";
import MetricsAiUsage from "./pages/MetricsAiUsage";
import AgentMemories from "./pages/AgentMemories";
import Settings from "./pages/Settings";
import SettingsCustomFields from "./pages/SettingsCustomFields";
import SettingsTracking from "./pages/SettingsTracking";
import Tasks from "./pages/Tasks";
import Admin from "./pages/Admin";
import Team from "./pages/Team";
import Invite from "./pages/Invite";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound.tsx";
import FeatureRoute from "./components/FeatureRoute";
import Unsubscribe from "./pages/Unsubscribe";
import EmailHub from "./pages/email/EmailHub";
import SettingsEmailDomain from "./pages/email/SettingsEmailDomain";

const queryClient = new QueryClient();

import { useUnreadTitle } from "./hooks/useUnreadTitle";
import ShortcutsDialog from "./components/ShortcutsDialog";
import CommandPalette from "./components/CommandPalette";
import { DialogsProvider } from "./hooks/useDialogs";

const TitleSync = () => { useUnreadTitle(); return null; };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DialogsProvider>
          <TitleSync />
          <ShortcutsDialog />
          <CommandPalette />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/invite/:token" element={<Invite />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<Kanban />} />
                      <Route path="/inbox" element={<FeatureRoute feature="inbox"><Inbox /></FeatureRoute>} />
                      <Route path="/inbox/:leadId" element={<FeatureRoute feature="inbox"><Inbox /></FeatureRoute>} />
                      <Route path="/agents" element={<FeatureRoute feature="agents"><Agents /></FeatureRoute>} />
                      <Route path="/automations" element={<FeatureRoute feature="automations"><Automations /></FeatureRoute>} />
                      <Route path="/sequences" element={<FeatureRoute feature="sequences"><Sequences /></FeatureRoute>} />
                      <Route path="/templates" element={<FeatureRoute feature="templates"><Templates /></FeatureRoute>} />
                      <Route path="/metrics" element={<FeatureRoute feature="metrics"><MetricsOps /></FeatureRoute>} />
                      <Route path="/metrics/ai" element={<FeatureRoute feature="metrics_ai"><Metrics /></FeatureRoute>} />
                      <Route path="/metrics/ai-usage" element={<FeatureRoute feature="metrics_ai_usage"><MetricsAiUsage /></FeatureRoute>} />
                      <Route path="/agents/memories" element={<FeatureRoute feature="agents"><AgentMemories /></FeatureRoute>} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/fields" element={<FeatureRoute feature="custom_fields"><SettingsCustomFields /></FeatureRoute>} />
                      <Route path="/settings/tracking" element={<FeatureRoute feature="tracking"><SettingsTracking /></FeatureRoute>} />
                      <Route path="/settings/email" element={<SettingsEmailDomain />} />
                      <Route path="/email" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/templates" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/automations" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/campaigns" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/tasks" element={<FeatureRoute feature="tasks"><Tasks /></FeatureRoute>} />
                      <Route path="/team" element={<FeatureRoute feature="team"><Team /></FeatureRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
          </DialogsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
