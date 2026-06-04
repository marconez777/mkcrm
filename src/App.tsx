import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Kanban from "./pages/Kanban";
import Inbox from "./pages/Inbox";
import AiHub from "./pages/ai/AiHub";
import AgentWizard from "./pages/ai/AgentWizard";
import Settings from "./pages/Settings";
import SettingsCustomFields from "./pages/SettingsCustomFields";
import SettingsForms from "./pages/SettingsForms";

import { lazy, Suspense } from "react";
import Tasks from "./pages/Tasks";
import AdminShell from "./layouts/AdminShell";

// Code-split admin pages (Fase 10): reduz o bundle inicial fora da área administrativa.
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminClinics = lazy(() => import("./pages/admin/AdminClinics"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminBranding = lazy(() => import("./pages/admin/AdminBranding"));
const AdminPlans = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminPlans })));
const AdminUsage = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminUsage })));
const AdminFinance = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminFinance })));
const AdminObservability = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminObservability })));
const AdminSupport = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminSupport })));
const AdminAudit = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminAudit })));
const AdminBuilderManual = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminBuilderManual })));
const AdminIntegrations = lazy(() => import("./pages/admin/AdminPanels").then((m) => ({ default: m.AdminIntegrations })));

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
import MarketingSite from "./pages/site/MarketingSite";
import RootGate from "./components/RootGate";
import ErrorBoundary from "./components/ErrorBoundary";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});

const AdminFallback = () => (
  <div className="p-8 space-y-3 animate-pulse">
    <div className="h-7 w-48 rounded bg-admin-surface-2" />
    <div className="h-4 w-72 rounded bg-admin-surface-2" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-admin-surface-2" />
      ))}
    </div>
    <div className="h-72 rounded-xl bg-admin-surface-2 mt-4" />
  </div>
);

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
        <ErrorBoundary>
        <AuthProvider>
          <DialogsProvider>
          <TitleSync />
          <ShortcutsDialog />
          <CommandPalette />
          <Routes>
            <Route path="/site" element={<MarketingSite />} />
            <Route path="/" element={<RootGate />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/:token" element={<Invite />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/admin" element={<ProtectedRoute><AdminShell /></ProtectedRoute>}>
              <Route index element={<Suspense fallback={<AdminFallback />}><AdminDashboard /></Suspense>} />
              <Route path="clinics" element={<Suspense fallback={<AdminFallback />}><AdminClinics /></Suspense>} />
              <Route path="users" element={<Suspense fallback={<AdminFallback />}><AdminUsers /></Suspense>} />
              <Route path="plans" element={<Suspense fallback={<AdminFallback />}><AdminPlans /></Suspense>} />
              <Route path="usage" element={<Suspense fallback={<AdminFallback />}><AdminUsage /></Suspense>} />
              <Route path="finance" element={<Suspense fallback={<AdminFallback />}><AdminFinance /></Suspense>} />
              <Route path="observability" element={<Suspense fallback={<AdminFallback />}><AdminObservability /></Suspense>} />
              <Route path="support" element={<Suspense fallback={<AdminFallback />}><AdminSupport /></Suspense>} />
              <Route path="integrations" element={<Suspense fallback={<AdminFallback />}><AdminIntegrations /></Suspense>} />
              <Route path="audit" element={<Suspense fallback={<AdminFallback />}><AdminAudit /></Suspense>} />
              <Route path="builder-manual" element={<Suspense fallback={<AdminFallback />}><AdminBuilderManual /></Suspense>} />
              <Route path="branding" element={<Suspense fallback={<AdminFallback />}><AdminBranding /></Suspense>} />
            </Route>
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
                      <Route path="/ai/agents/new" element={<FeatureRoute feature="agents"><AgentWizard /></FeatureRoute>} />
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
                      <Route path="/ai/reports" element={<AiHub />} />
                      <Route path="/ai/broadcasts/:id" element={<FeatureRoute feature="broadcasts"><AiHub /></FeatureRoute>} />
                      <Route path="/templates" element={<FeatureRoute feature="templates"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/messages" element={<AiHub />} />
                      <Route path="/ai/messages/sequences" element={<FeatureRoute feature="sequences"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/messages/automations" element={<FeatureRoute feature="automations"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/messages/templates" element={<FeatureRoute feature="templates"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/messages/engagement" element={<AiHub />} />
                      <Route path="/metrics/ai-usage" element={<FeatureRoute feature="metrics_ai_usage"><AiHub /></FeatureRoute>} />
                      <Route path="/ai/engagement" element={<AiHub />} />
                      <Route path="/metrics/engagement" element={<AiHub />} />
                      <Route path="/metrics" element={<AiHub />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/settings/fields" element={<FeatureRoute feature="custom_fields"><SettingsCustomFields /></FeatureRoute>} />
                      <Route path="/settings/forms" element={<SettingsForms />} />
                      <Route path="/settings/integration" element={<SettingsForms />} />
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
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
