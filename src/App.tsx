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
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<Kanban />} />
                      <Route path="/inbox" element={<Inbox />} />
                      <Route path="/inbox/:leadId" element={<Inbox />} />
                      <Route path="/agents" element={<Agents />} />
                      <Route path="/automations" element={<Automations />} />
                      <Route path="/sequences" element={<Sequences />} />
                      <Route path="/templates" element={<Templates />} />
                      <Route path="/metrics" element={<MetricsOps />} />
                      <Route path="/metrics/ai" element={<Metrics />} />
                      <Route path="/metrics/ai-usage" element={<MetricsAiUsage />} />
                      <Route path="/agents/memories" element={<AgentMemories />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/fields" element={<SettingsCustomFields />} />
                      <Route path="/settings/tracking" element={<SettingsTracking />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="/team" element={<Team />} />
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
