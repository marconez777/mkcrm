import { AdminCard } from "@/layouts/AdminShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const MOCK_COSTS = [
  { id: "1", service: "Edge Functions", detail: "Execuções do Tipificador", amount: 145.50, trend: "+12%" },
  { id: "2", service: "Supabase Database", detail: "Armazenamento & Egress", amount: 89.90, trend: "+5%" },
  { id: "3", service: "Lovable Cloud", detail: "Hospedagem e Infra", amount: 250.00, trend: "0%" },
];

export default function CloudCostsPanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard className="p-5">
          <h3 className="text-sm font-medium text-admin-text-muted">Custo Total (Mês Atual)</h3>
          <p className="mt-2 text-3xl font-bold text-admin-text">$485.40</p>
          <p className="text-xs text-admin-positive mt-1">Estimativa dentro do limite ideal</p>
        </AdminCard>
        <AdminCard className="p-5">
          <h3 className="text-sm font-medium text-admin-text-muted">Projeção (Fim do Mês)</h3>
          <p className="mt-2 text-3xl font-bold text-admin-text">$620.00</p>
        </AdminCard>
        <AdminCard className="p-5">
          <h3 className="text-sm font-medium text-admin-text-muted">Serviço mais Custoso</h3>
          <p className="mt-2 text-xl font-bold text-admin-text">Lovable Cloud</p>
          <p className="text-xs text-admin-text-muted mt-1">Hospedagem Base</p>
        </AdminCard>
      </div>

      <AdminCard>
        <div className="p-5 border-b border-admin-border">
          <h2 className="font-semibold text-admin-text">Detalhamento de Custos</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-admin-border hover:bg-transparent">
              <TableHead className="text-admin-text-muted">Serviço</TableHead>
              <TableHead className="text-admin-text-muted">Detalhe</TableHead>
              <TableHead className="text-admin-text-muted text-right">Valor Projetado</TableHead>
              <TableHead className="text-admin-text-muted text-right">Tendência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_COSTS.map((c) => (
              <TableRow key={c.id} className="border-admin-border border-b last:border-0 hover:bg-admin-surface-2/50 transition-colors">
                <TableCell className="font-medium text-admin-text">{c.service}</TableCell>
                <TableCell className="text-admin-text-subtle">{c.detail}</TableCell>
                <TableCell className="text-right text-admin-text">${c.amount.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={c.trend.startsWith("+") ? "text-admin-negative border-admin-negative/20" : "text-admin-positive border-admin-positive/20"}>
                    {c.trend}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>
    </div>
  );
}
