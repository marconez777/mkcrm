import PlansPanel from "@/components/admin/PlansPanel";
import UsageLimitsPanel from "@/components/admin/UsageLimitsPanel";
import FinancePanel from "@/components/admin/FinancePanel";
import ObservabilityPanel from "@/components/admin/ObservabilityPanel";
import SupportPanel from "@/components/admin/SupportPanel";
import AuditPanel from "@/components/admin/AuditPanel";
import BuilderManualPanel from "@/components/admin/BuilderManualPanel";
import IntegrationsKeysCard from "@/components/admin/IntegrationsKeysCard";
import IntegrationsDomainsTable from "@/components/admin/IntegrationsDomainsTable";
import IntegrationsQuotaTable from "@/components/admin/IntegrationsQuotaTable";
import { AdminPageHeader } from "@/layouts/AdminShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";

export function AdminPlans() {
  return (
    <>
      <AdminPageHeader title="Planos" description="Catálogo de planos disponíveis na plataforma." />
      <PlansPanel />
    </>
  );
}

export function AdminUsage() {
  return (
    <>
      <AdminPageHeader title="Uso & Limites" description="Uso real vs limite, por empresa." />
      <UsageLimitsPanel />
    </>
  );
}

export function AdminFinance() {
  return (
    <>
      <AdminPageHeader title="Financeiro" description="MRR, ARR, inadimplência e faturas." />
      <FinancePanel />
    </>
  );
}

export function AdminObservability() {
  return (
    <>
      <AdminPageHeader title="Observabilidade" description="Uso por feature, erros e features sem uso." />
      <ObservabilityPanel />
    </>
  );
}

export function AdminSupport() {
  return (
    <>
      <AdminPageHeader title="Suporte IA" description="Monitor live do Alfred, telemetria, pins e KB." />
      <SupportPanel />
    </>
  );
}

export function AdminAudit() {
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const cs = await fetchAllPaged<any>(() => supabase.from("clinics").select("id,name").order("name"));
      setClinics(cs as any);
    })();
  }, []);
  return (
    <>
      <AdminPageHeader title="Auditoria" description="Histórico de ações sensíveis na plataforma." />
      <AuditPanel clinics={clinics} />
    </>
  );
}

export function AdminBuilderManual() {
  return (
    <>
      <AdminPageHeader title="Manual do Builder" description="Editor do manual que orienta o Construtor de Agentes." />
      <BuilderManualPanel />
    </>
  );
}

export function AdminIntegrations() {
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const cs = await fetchAllPaged<any>(() => supabase.from("clinics").select("id,name").order("name"));
      setClinics(cs as any);
    })();
  }, []);
  return (
    <>
      <AdminPageHeader title="Integrações" description="Chaves globais, domínios de e-mail e cotas." />
      <div className="space-y-4">
        <IntegrationsKeysCard />
        <IntegrationsDomainsTable clinics={clinics} />
        <IntegrationsQuotaTable />
      </div>
    </>
  );
}
