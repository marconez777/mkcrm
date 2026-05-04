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
import Templates from "./pages/Templates";
import Metrics from "./pages/Metrics";
import MetricsOps from "./pages/MetricsOps";
import Settings from "./pages/Settings";
import SettingsCustomFields from "./pages/SettingsCustomFields";
import Tasks from "./pages/Tasks";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

import { useUnreadTitle } from "./hooks/useUnreadTitle";
import ShortcutsDialog from "./components/ShortcutsDialog";
import CommandPalette from "./components/CommandPalette";

const TitleSync = () => { useUnreadTitle(); return null; };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TitleSync />
          <ShortcutsDialog />
          <CommandPalette />
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
                      <Route path="/templates" element={<Templates />} />
                      <Route path="/metrics" element={<MetricsOps />} />
                      <Route path="/metrics/ai" element={<Metrics />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/fields" element={<SettingsCustomFields />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
