import { useAuth } from "@/hooks/useAuth";
import MarketingSite from "@/pages/site/MarketingSite";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

/**
 * Decide o que servir em "/":
 * - carregando → spinner
 * - sem sessão → site institucional (MarketingSite)
 * - autenticado → redireciona para /app (Kanban dentro do AppShell)
 */
export default function RootGate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (!session) return <MarketingSite />;
  return <Navigate to="/app" replace />;
}
