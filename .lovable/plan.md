# Foco: clínica **ÓR** (`cf038458…`)

## Diagnóstico

- **1.328 leads órfãos** (`whatsapp_instance_id = NULL`) de 1.585 totais.
- Causa: instância antiga foi deletada/recriada → FK `ON DELETE SET NULL` apagou o vínculo.
- Instância atual default: **Recepção** (`0645e606…` / `or-fbfd8d5e`, `open`).
- Existem 2 outras instâncias na clínica (`Disparo pacientes` close, `prospecção medico` open) — mas o tráfego de atendimento é via **Recepção**.

## Plano (3 partes, só para ÓR)

### 1. Backfill imediato
`UPDATE leads SET whatsapp_instance_id = '0645e606-5417-4b88-8c73-d05199911bb3' WHERE clinic_id = 'cf038458…' AND whatsapp_instance_id IS NULL` → resolve os 1.328 leads agora.

### 2. Auto-heal nas edge functions (evita repetir)
Em `evolution-sync-lead` e `fetch-wa-avatar`:
- Se `lead.whatsapp_instance_id` é `NULL` → usa a instância default da clínica do lead.
- Em caso de sucesso, persiste o `whatsapp_instance_id` no lead.
- Se não houver default → retorna 400 com `"Nenhuma instância WhatsApp configurada para esta clínica"`.

### 3. Erro real no frontend
Em `src/pages/LeadDrawer.tsx` (sync de histórico e avatar): ler `data?.error` da resposta e exibir no toast em vez de "non-2xx".

---

Sigo? (parto pelo backfill da ÓR e depois faço 2 + 3)
