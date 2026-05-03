import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./components/AppShell";
import Kanban from "./pages/Kanban";
import Inbox from "./pages/Inbox";
import Agents from "./pages/Agents";
import Automations from "./pages/Automations";
import Templates from "./pages/Templates";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import SettingsCustomFields from "./pages/SettingsCustomFields";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

import { useUnreadTitle } from "./hooks/useUnreadTitle";

const TitleSync = () => { useUnreadTitle(); return null; };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <TitleSync />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Kanban />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/inbox/:leadId" element={<Inbox />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/fields" element={<SettingsCustomFields />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
