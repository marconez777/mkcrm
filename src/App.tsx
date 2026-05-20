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
import AiHub from "./pages/ai/AiHub";
import Settings from "./pages/Settings";
import SettingsCustomFields from "./pages/SettingsCustomFields";
import SettingsForms from "./pages/SettingsForms";

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
import EmailTemplateEditor from "./pages/email/EmailTemplateEditor";
import Broadcasts from "./pages/Broadcasts";
import TrackingDebug from "./pages/TrackingDebug";
import Tracking from "./pages/Tracking";

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
                      <Route path="/ai" element={<AiHub />} />
                      <Route path="/ai/agents" element={<FeatureRoute feature="agents"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/memories" element={<FeatureRoute feature="agents"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/insights" element={<FeatureRoute feature="agents"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/usage" element={<FeatureRoute feature="metrics_ai_usage"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/automations" element={<FeatureRoute feature="automations"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/templates" element={<FeatureRoute feature="templates"><AiHub /></FeatureRoute>} />
                      <Route path="/agents" element={<FeatureRoute feature="agents"><AiHub /></FeatureRoute>} />
                      <Route path="/agents/memories" element={<FeatureRoute feature="agents"><AiHub /></FeatureRoute>} />
                      <Route path="/automations" element={<FeatureRoute feature="automations"><AiHub /></FeatureRoute>} />
                      <Route path="/sequences" element={<FeatureRoute feature="sequences"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/sequences" element={<FeatureRoute feature="sequences"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/broadcasts" element={<FeatureRoute feature="broadcasts"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/broadcasts/:id" element={<FeatureRoute feature="broadcasts"><AiHub /></FeatureRoute>} />
                      <Route path="/templates" element={<FeatureRoute feature="templates"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/messages" element={<AiHub />} />
                      <Route path="/ai/messages/sequences" element={<FeatureRoute feature="sequences"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/messages/automations" element={<FeatureRoute feature="automations"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/messages/templates" element={<FeatureRoute feature="templates"><AiHub /></FeatureRoute>} />
                      <Route path="/metrics/ai-usage" element={<FeatureRoute feature="metrics_ai_usage"><AiHub /></FeatureRoute>} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/fields" element={<FeatureRoute feature="custom_fields"><SettingsCustomFields /></FeatureRoute>} />
                      <Route path="/settings/forms" element={<SettingsForms />} />
                      <Route path="/settings/email" element={<SettingsEmailDomain />} />
                      <Route path="/email" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/templates" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/templates/:id" element={<FeatureRoute feature="email_marketing"><EmailTemplateEditor /></FeatureRoute>} />
                      <Route path="/email/automations" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/campaigns" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/queue" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/logs" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/segments" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/contacts" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/unsubscribes" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/reports" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/email/sites" element={<FeatureRoute feature="email_marketing"><EmailHub /></FeatureRoute>} />
                      <Route path="/tracking-debug" element={<TrackingDebug />} />
                      <Route path="/tracking" element={<Tracking />} />
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
