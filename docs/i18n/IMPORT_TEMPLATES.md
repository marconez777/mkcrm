---
title: "Templates de import por região (Disparo em massa + Kommo)"
topic: integracao
kind: reference
audience: agent
updated: 2026-06-30
summary: "Especificação dos XLSX de disparo em massa e import Kommo para BR, ES e US: headers, formato de telefone, formato de data e validação."
code_refs:
  - src/lib/broadcast-template.ts
  - src/components/kanban/KommoImportDialog.tsx
  - src/pages/Broadcasts.tsx
related_docs:
  - docs/i18n/REGION_CONFIG.md
  - docs/i18n/COMPLIANCE.md
---

# Templates de import por região

## 1. Disparo em massa (Broadcasts)

### BR — `template-contatos-disparo.xlsx`
```
telefone        | nome        | custom1 | custom2
5511999998888   | João Silva  | vip     |
11988887777     | Maria       |         |
```
- DDI: **55** (adicionado automaticamente se ausente)
- Validação: 10 ou 11 dígitos nacionais; 12 ou 13 com DDI
- Aliases aceitos: `telefone`, `phone`, `whatsapp`, `celular`
- Nota header: *"Inclua DDD. DDI 55 é adicionado automaticamente."*

### ES — `plantilla-contactos-envio.xlsx`
```
telefono         | nombre        | custom1 | custom2
34612345678      | Juan García   | vip     |
+34 612 345 678  | María López   |         |
```
- DDI: **34**
- Móveis começam com **6** ou **7**, 9 dígitos nacionais
- Aliases aceitos: `telefono`, `teléfono`, `movil`, `móvil`, `whatsapp`, `phone`
- Nota header: *"Incluye el código de país 34 o el prefijo +34. Los móviles empiezan por 6 o 7."*

### US — `contacts-broadcast-template.xlsx`
```
phone           | name        | opt_in_date  | custom1 | custom2
12125551234     | John Smith  | 2026-01-15   | vip     |
(415) 555-9876  | Jane Doe    | 2026-02-03   |         |
```
- DDI: **1**
- 10 dígitos NANP (NXX-NXX-XXXX, N=2-9). Rejeitar 555-0100..0199 (reservado fictício)
- Aliases aceitos: `phone`, `mobile`, `cell`, `whatsapp`
- **`opt_in_date` obrigatório** (TCPA) — formato ISO `YYYY-MM-DD`
- Nota header: *"Include area code. Country code +1 is added automatically. Written SMS opt-in (TCPA) required — see opt_in_date column."*

### Implementação (`src/lib/broadcast-template.ts`)

```ts
export type Region = 'br' | 'es' | 'us';

interface TemplateSpec {
  filename: string;
  headers: string[];
  examples: (string | number)[][];
  headerNote: string;
  phoneAliases: string[];
  nameAliases: string[];
  requiredExtraColumns?: string[]; // ex.: ['opt_in_date'] para US
}

const SPECS: Record<Region, TemplateSpec> = { /* tabelas acima */ };

export function downloadBroadcastTemplate(region: Region): void;
export async function parseContactsFile(
  file: File,
  region: Region,
): Promise<{ ok: ContactRow[]; errors: { row: number; reason: string }[] }>;
```

- `parseContactsFile` chama `normalizePhone(raw, SPECS[region].country)` (lib `libphonenumber-js`).
- Em US, valida presença de `opt_in_date` quando broadcast for marketing (`broadcast.kind = 'marketing'`).

## 2. Importação Kommo (`KommoImportDialog`)

### Formato de data por região

| region | Formato esperado no XLSX | Offset aplicado |
|---|---|---|
| BR | `dd.mm.yyyy hh:mm:ss` | `-03:00` (America/Sao_Paulo) |
| ES | `dd/mm/yyyy HH:mm` ou `dd.mm.yyyy HH:mm:ss` | `+01:00` / `+02:00` DST (Europe/Madrid) |
| US | `mm/dd/yyyy hh:mm AM/PM` ou ISO | timezone da clínica (default America/New_York) |

Implementar `parseKommoDate(raw, region, timezone)` substituindo o parser fixo atual.

### Telefone Kommo

Substituir `normalizePhone(raw)` local (que força 55) por `normalizePhone(raw, region.phoneCountry)`.

### Colunas custom traduzidas

| key | BR | ES | US |
|---|---|---|---|
| `interesse` | Interesse | Interés | Interest |
| `procedimentos` | Procedimentos | Procedimientos | Procedures |
| `data_horario` | Data e horário | Fecha y hora | Date and time |
| `teleconsulta` | Teleconsulta? | ¿Teleconsulta? | Telehealth? |
| `link_consulta` | Link de Consulta | Enlace de consulta | Appointment link |
| `pagamento` | Pagamento | Pago | Payment |
| `origem` | Origem | Origen | Source |
| `mensagem` | Mensagem | Mensaje | Message |

A coluna interna (`key`) permanece igual entre regiões — só o `label` muda.

## Testes (F-INTL-3.5)

Por região, fixture com:
- 10 telefones válidos (variações de formato)
- 5 inválidos (curtos, letras, DDI errado)
- 5 datas válidas + 3 inválidas
- Para US: 3 linhas sem `opt_in_date` → devem aparecer em `errors`
