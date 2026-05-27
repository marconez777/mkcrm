import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ThroughputPoint = {
  minute: string; // ISO
  sent: number;
  failed: number;
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="throughput-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="minute"
            tickFormatter={fmtTime}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l) => fmtTime(String(l))}
            formatter={(v: number, name) => [v, name === "sent" ? "Enviados" : "Falhas"]}
          />
          <Area
            type="monotone"
            dataKey="sent"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#throughput-grad)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="failed"
            stroke="hsl(var(--destructive))"
            strokeWidth={1.5}
            fill="hsl(var(--destructive) / 0.1)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
