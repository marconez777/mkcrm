// Templates de import por região (F-INTL-3.5).
// Espec: docs/i18n/IMPORT_TEMPLATES.md
//
// API:
//   downloadBroadcastTemplate(region)            → baixa XLSX no formato local
//   parseContactsFile(file, region)              → parseia e normaliza telefones
//   parseContactsFile devolve `{ ok, errors }`; o caller decide o que mostrar.
//   Para retrocompat, `parseContactsFile(file)` sem região assume BR.

import * as XLSX from "xlsx";
import { normalizePhoneIntl, type PhoneCountry } from "@/lib/phone";
import type { Region } from "@/lib/region";

export type ContactRow = {
  phone: string;
  name?: string;
  custom?: Record<string, unknown>;
};

export type ParseResult = {
  ok: ContactRow[];
  errors: { row: number; reason: string }[];
};

interface TemplateSpec {
  filename: string;
  sheetName: string;
  headers: string[];
  examples: (string | number)[][];
  /** Nota mostrada no header (linha 1 mesclada) — instruções no idioma local. */
  headerNote: string;
  phoneAliases: string[];
  nameAliases: string[];
  phoneCountry: PhoneCountry;
  /** Colunas extras esperadas (ex.: opt_in_date em US). */
  extraColumns?: string[];
}

const SPECS: Record<Region, TemplateSpec> = {
  br: {
    filename: "template-contatos-disparo.xlsx",
    sheetName: "contatos",
    headers: ["telefone", "nome", "custom1", "custom2"],
    examples: [
      ["5511999998888", "João Silva", "vip", ""],
      ["11988887777", "Maria", "", ""],
      ["+34 604 81 44 22", "Juan (Espanha)", "", ""],
    ],
    headerNote:
      "Inclua DDD. DDI 55 é adicionado se ausente. Para números estrangeiros, use +DDI (ex.: +34 604 81 44 22, +1 415 555 9876).",
    phoneAliases: ["telefone", "phone", "whatsapp", "celular", "numero", "número"],
    nameAliases: ["nome", "name"],
    phoneCountry: "BR",
  },
  es: {
    filename: "plantilla-contactos-envio.xlsx",
    sheetName: "contactos",
    headers: ["telefono", "nombre", "custom1", "custom2"],
    examples: [
      ["34612345678", "Juan García", "vip", ""],
      ["+34 612 345 678", "María López", "", ""],
      ["+55 11 99999 8888", "Contato Brasil", "", ""],
    ],
    headerNote:
      "Incluye el código de país 34 o el prefijo +34. Para números extranjeros, usa +DDI (ej.: +55 11 99999 8888, +1 415 555 9876).",
    phoneAliases: ["telefono", "teléfono", "movil", "móvil", "whatsapp", "phone"],
    nameAliases: ["nombre", "name"],
    phoneCountry: "ES",
  },
  us: {
    filename: "contacts-broadcast-template.xlsx",
    sheetName: "contacts",
    headers: ["phone", "name", "opt_in_date", "custom1", "custom2"],
    examples: [
      ["12125551234", "John Smith", "2026-01-15", "vip", ""],
      ["(415) 555-9876", "Jane Doe", "2026-02-03", "", ""],
      ["+34 604 81 44 22", "Foreign Contact", "2026-03-10", "", ""],
    ],
    headerNote:
      "Include area code. Country code +1 is added automatically. For foreign numbers use +country code (e.g., +34 604 81 44 22). Written SMS opt-in (TCPA) recommended — see opt_in_date column.",
    phoneAliases: ["phone", "mobile", "cell", "whatsapp"],
    nameAliases: ["name"],
    phoneCountry: "US",
    extraColumns: ["opt_in_date"],
  },
};

function specFor(region: Region | undefined): TemplateSpec {
  return SPECS[region ?? "br"] ?? SPECS.br;
}

export function downloadBroadcastTemplate(region: Region = "br"): void {
  const spec = specFor(region);
  const data: (string | number)[][] = [
    [spec.headerNote, ...new Array(Math.max(spec.headers.length - 1, 0)).fill("")],
    spec.headers,
    ...spec.examples,
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Mescla a primeira linha (nota de instrução).
  if (spec.headers.length > 1) {
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: spec.headers.length - 1 } }];
  }
  ws["!cols"] = spec.headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, spec.sheetName);
  XLSX.writeFile(wb, spec.filename);
}

function normalizeHeader(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

function pickValue(row: Record<string, unknown>, aliases: string[]): string {
  for (const k of Object.keys(row)) {
    const nk = normalizeHeader(k);
    if (aliases.some((a) => normalizeHeader(a) === nk)) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

export async function parseContactsFile(
  file: File,
  region: Region = "br",
): Promise<ParseResult> {
  const spec = specFor(region);
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Heurística: se a primeira linha for uma nota (não bate com nenhum header),
  // pulamos ela e usamos a segunda linha como cabeçalho.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    header: 1,
  }) as unknown as unknown[][];

  let headerRowIdx = 0;
  const headerKeys = new Set(
    [...spec.phoneAliases, ...spec.nameAliases, ...(spec.extraColumns ?? [])].map(normalizeHeader),
  );
  for (let i = 0; i < Math.min(raw.length, 3); i++) {
    const row = (raw[i] as unknown[]) ?? [];
    const hasHeader = row.some((c) => headerKeys.has(normalizeHeader(String(c ?? ""))));
    if (hasHeader) {
      headerRowIdx = i;
      break;
    }
  }

  const header = ((raw[headerRowIdx] as unknown[]) ?? []).map((c) => String(c ?? ""));
  const dataRows = raw.slice(headerRowIdx + 1) as unknown[][];

  const ok: ContactRow[] = [];
  const errors: { row: number; reason: string }[] = [];
  const knownAliases = new Set(
    [...spec.phoneAliases, ...spec.nameAliases, ...(spec.extraColumns ?? [])].map(normalizeHeader),
  );

  dataRows.forEach((arr, idx) => {
    const rowNum = headerRowIdx + 2 + idx; // 1-based humano
    if (!arr || arr.every((c) => c == null || String(c).trim() === "")) return;

    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => {
      obj[h] = arr[i];
    });

    const phoneRaw = pickValue(obj, spec.phoneAliases);
    if (!phoneRaw) {
      errors.push({ row: rowNum, reason: "telefone vazio" });
      return;
    }
    const phone = normalizePhoneIntl(phoneRaw, spec.phoneCountry);
    if (!phone) {
      errors.push({ row: rowNum, reason: `telefone inválido (${phoneRaw})` });
      return;
    }
    const name = pickValue(obj, spec.nameAliases) || undefined;

    const custom: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const nk = normalizeHeader(k);
      if (knownAliases.has(nk)) continue;
      const v = obj[k];
      if (v !== "" && v != null) custom[k] = v;
    }
    // Em US, manter opt_in_date dentro do custom para a edge function consumir.
    if (region === "us") {
      const optIn = pickValue(obj, ["opt_in_date"]);
      if (optIn) custom["opt_in_date"] = optIn;
    }

    ok.push({ phone, name, custom: Object.keys(custom).length ? custom : undefined });
  });

  return { ok, errors };
}
