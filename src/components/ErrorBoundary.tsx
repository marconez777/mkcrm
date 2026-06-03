import React from "react";
import { supabase } from "@/integrations/supabase/client";

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      supabase.functions.invoke("log-frontend-error", {
        body: {
          error_message: error.message,
          error_stack: error.stack ?? info.componentStack ?? null,
          route: typeof window !== "undefined" ? window.location.pathname : null,
          severity: "error",
          metadata: { componentStack: info.componentStack },
        },
      }).catch(() => {});
    } catch { /* silencioso */ }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground mb-4">O erro foi registrado. Tente recarregar a página.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          >Recarregar</button>
        </div>
      );
    }
    return this.props.children as any;
  }
}
