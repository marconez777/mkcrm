import { Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { FeatureKey } from "@/lib/features";

export default function FeatureRoute({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { hasFeature, loading, membership } = useAuth();
  const warned = useRef(false);
  const allowed = hasFeature(feature);

  useEffect(() => {
    if (!loading && membership && !allowed && !warned.current) {
      warned.current = true;
      toast.error("Recurso indisponível para esta empresa.");
    }
  }, [loading, membership, allowed]);

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
