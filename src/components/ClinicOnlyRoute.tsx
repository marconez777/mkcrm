import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Bloqueia rotas operacionais (Inbox, Kanban, Settings, Team…) para super admins
 * "puros" — contas dedicadas à administração da plataforma que NÃO estão
 * vinculadas a nenhuma clínica. Redireciona para /admin.
 */
export default function ClinicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { loading, isSuperAdmin, membership } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (isSuperAdmin && !membership) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
