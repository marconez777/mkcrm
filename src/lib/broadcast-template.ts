import * as XLSX from "xlsx";

export function downloadBroadcastTemplate() {
  const data = [
    ["telefone", "nome", "custom1", "custom2"],
    ["5511999998888", "João Silva", "vip", ""],
    ["11988887777", "Maria", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "contatos");
  XLSX.writeFile(wb, "template-contatos-disparo.xlsx");
}

export async function parseContactsFile(file: File): Promise<Array<{ phone: string; name?: string; custom?: Record<string, unknown> }>> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const out: Array<{ phone: string; name?: string; custom?: Record<string, unknown> }> = [];
  for (const r of rows) {
    const phoneRaw = String(r["telefone"] ?? r["phone"] ?? r["whatsapp"] ?? "").trim();
    if (!phoneRaw) continue;
    const { normalizePhoneBR } = await import("./phone");
    const phone = normalizePhoneBR(phoneRaw);
    if (!phone) continue;
    const name = String(r["nome"] ?? r["name"] ?? "").trim() || undefined;
    const custom: Record<string, unknown> = {};
    for (const k of Object.keys(r)) {
      if (!["telefone", "phone", "whatsapp", "nome", "name"].includes(k)) {
        const v = r[k]; if (v !== "" && v != null) custom[k] = v;
      }
    }
    out.push({ phone, name, custom });
  }
  return out;
}
