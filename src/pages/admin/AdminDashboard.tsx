import DashboardPanel from "@/components/admin/DashboardPanel";
import { AdminPageHeader } from "@/layouts/AdminShell";

export default function AdminDashboard() {
  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="Visão geral em tempo real da plataforma — empresas, receita, uso de IA e e-mail."
      />
      <DashboardPanel />
    </>
  );
}
