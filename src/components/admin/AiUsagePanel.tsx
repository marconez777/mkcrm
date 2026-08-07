import { AdminCard } from "@/layouts/AdminShell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const MOCK_AI_USAGE = [
  { id: "1", model: "gemini-flash-latest", purpose: "Classificação Padrão (Tipificador)", tokens: "450k", cost: 1.50 },
  { id: "2", model: "gemini-flash-latest", purpose: "Resumidor de Contexto", tokens: "2.1M", cost: 7.35 },
  { id: "3", model: "openai-gpt-4o-mini", purpose: "Fallback de Segurança", tokens: "80k", cost: 0.85 },
];

export default function AiUsagePanel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard className="p-5">
          <h3 className="text-sm font-medium text-admin-text-muted">Gasto Total com IA</h3>
          <p className="mt-2 text-3xl font-bold text-admin-text">$9.70</p>
          <p className="text-xs text-admin-text-muted mt-1">Neste ciclo de faturamento</p>
        </AdminCard>
        <AdminCard className="p-5">
          <h3 className="text-sm font-medium text-admin-text-muted">Total de Tokens Processados</h3>
          <p className="mt-2 text-3xl font-bold text-admin-text">2.63M</p>
        </AdminCard>
        <AdminCard className="p-5">
          <h3 className="text-sm font-medium text-admin-text-muted">Maior Ralo de Créditos</h3>
          <p className="mt-2 text-xl font-bold text-admin-negative">Resumidor de Contexto</p>
          <p className="text-xs text-admin-text-muted mt-1">Responsável por ~75% do gasto</p>
        </AdminCard>
      </div>

      <AdminCard>
        <div className="p-5 border-b border-admin-border">
          <h2 className="font-semibold text-admin-text">Consumo por Modelo/Agente</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-admin-border hover:bg-transparent">
              <TableHead className="text-admin-text-muted">Modelo Base</TableHead>
              <TableHead className="text-admin-text-muted">Propósito do Agente</TableHead>
              <TableHead className="text-admin-text-muted text-right">Tokens Consumidos</TableHead>
              <TableHead className="text-admin-text-muted text-right">Custo Estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_AI_USAGE.map((c) => (
              <TableRow key={c.id} className="border-admin-border border-b last:border-0 hover:bg-admin-surface-2/50 transition-colors">
                <TableCell className="font-medium text-admin-text">
                  <Badge variant="secondary" className="font-mono text-[10px]">{c.model}</Badge>
                </TableCell>
                <TableCell className="text-admin-text-subtle">{c.purpose}</TableCell>
                <TableCell className="text-right text-admin-text font-mono">{c.tokens}</TableCell>
                <TableCell className="text-right text-admin-text font-mono">${c.cost.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminCard>
    </div>
  );
}
