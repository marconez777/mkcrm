## F-INTL-2 — Propagar `clinic.timezone` no fluxo de disparos

Hoje três tick functions caem em `"America/Sao_Paulo"` quando o campo de timezone do registro está vazio. Isso quebra clínicas ES/US: a janela de envio "08:00–18:00" passa a ser interpretada em horário de Brasília.

### Mudanças

**1. `supabase/functions/_shared/region.ts`**
- Exportar helper `getClinicTimezone(client, clinicId)` (atalho sobre `getRegionConfig`) para reuso pelos ticks.

**2. `supabase/functions/broadcast-tick/index.ts`**
- Para cada broadcast carregar `clinic.timezone` via `getRegionConfig(supabase, bc.clinic_id)`.
- Em `withinWindow(win, fallbackTz)`: usar `win.tz || fallbackTz` (não mais `"America/Sao_Paulo"`).
- Logar `tz_source` (`"window"` vs `"clinic"`) em `broadcast_events` quando recipient é empurrado para próxima janela (debug).

**3. `supabase/functions/sequence-tick/index.ts`**
- `inSendWindow(window, fallbackTz)`: receber timezone do enrollment. Buscar via `getRegionConfig(supabase, e.clinic_id)` (cache 60s já existe no shared).
- Substituir o default `"America/Sao_Paulo"` por `fallbackTz`.

**4. `supabase/functions/automations-tick/index.ts`**
- No branch `before_appointment`, trocar `cfg.tz || "America/Sao_Paulo"` por `cfg.tz || (await getRegionConfig(supabase, a.clinic_id)).timezone`.

**5. Shared template-vars (`supabase/functions/_shared/template-vars.ts` e `src/lib/template-vars.ts`)**
- Tornar a constante `TZ` parametrizável: aceitar `tz` como argumento em `renderTemplate(text, lead, defs, tz?)`. Default segue `America/Sao_Paulo` (compat). Atualizar chamadores nos ticks para passarem o tz da clínica. Demais chamadores (frontend, sem clinic) ficam no default — fora de escopo desta fase.

**6. UI — `src/pages/Broadcasts.tsx`**
- Quando o broadcast é criado/editado sem `send_window.tz`, pré-preencher com `useRegion().timezone` em vez de string vazia, para o usuário ver o tz que será usado.

### Fora de escopo
- `PipelineCalendar.tsx`, `ScheduledReports.tsx`, `KommoImportDialog.tsx`, `pipeline-classify/date-parser.ts` — não fazem parte do "fluxo de disparos". Ficam para fases seguintes (F-INTL-2.1 UI/calendário e F-INTL-4 pipeline-IA).
- Não tocaremos em migrations existentes nem em docs (fica para F-INTL-9).

### Validação
- `tsgo` nos arquivos alterados.
- Deploy de `broadcast-tick`, `sequence-tick`, `automations-tick`.
- Sanity SQL: `select id, region, timezone from clinics` → confirmar que clínica BR existente ainda resolve `America/Sao_Paulo`.
