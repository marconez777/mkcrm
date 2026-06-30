
# Bug das datas no painel "Detalhes" — diagnóstico + correção

> Roadmap da Meta API fica preservado em `.lovable/plan.md` e em `docs/integrations/meta/ROADMAP.md` quando voltarmos a ele. Este plano trata só do bug atual.

## Diagnóstico (causa raiz mais provável)

Os campos `consulta_agendada_em` e `procedimento_agendado_em` **não são** apenas campos manuais — eles também são **derivados automaticamente da tabela `appointments`** pela função `recompute_lead_appointment_summary(lead_id)`, instalada na migration `20260617210036_*`:

```sql
UPDATE public.leads
   SET custom_fields = custom_fields
       || jsonb_build_object('consulta_agendada_em',
            COALESCE(to_jsonb(v_next_consulta::text), 'null'::jsonb))
       || jsonb_build_object('procedimento_agendado_em', ...)
```

Essa função roda via trigger `tg_appointments_recompute` em **qualquer INSERT/UPDATE/DELETE em `appointments`** do lead, e pega `MIN(scheduled_at)` de appointments com `status='agendado' AND scheduled_at > now()`.

Consequência: quando a secretária edita a data direto no painel `CustomFieldsPanel`:

1. O front grava `leads.custom_fields.consulta_agendada_em = novo valor`.
2. A trigger `track_custom_fields_human_edits` marca G10 (proteção contra a IA).
3. **Mas** qualquer evento posterior em `appointments` (sync com Evolution, tick determinístico `auto:appointment-sync`, edição de qualquer outro appointment do mesmo lead, etc.) dispara o recompute e **sobrescreve o campo** com o valor antigo da tabela `appointments`.
4. No "Limpar", a recomputação reinsere a data porque o appointment ainda existe.

Isso explica todos os três sintomas relatados:
- "altero a hora e não salva" → o write vai, mas é sobrescrito segundos depois.
- "do nada aparece a hora que eu pus depois de um tempo" → entre dois recomputes ou enquanto o appointment está fora da janela `scheduled_at > now()`.
- "clico em limpar e não salva" → recompute reinjeta a partir do appointment.

A camada de IA (classifier) **não é culpada**: `HUMAN_SCHEDULING_FIELDS` em `pipeline-classify/apply.ts:27` já bloqueia o LLM de escrever essas chaves desde junho/2026.

## Plano em 3 fases

### Fase 1 — Validar o diagnóstico (15 min)

1. Conferir no lead da `Thereza` (telefone 5521982261331):
   - `SELECT custom_fields, custom_fields_last_human_edit FROM leads WHERE phone = '...';`
   - `SELECT id, kind, scheduled_at, status FROM appointments WHERE lead_id = '...';`
   - Comparar com o histórico em `lead_events` (`type IN ('custom_field_changed','appointment_sync')`).
2. Reproduzir via psql: editar `custom_fields.consulta_agendada_em` manualmente, depois um `UPDATE` no appointment (status='agendado') e ver se a data volta.

Se confirmado, segue para Fase 2. Se não, ampliar investigação para `pipeline-deterministic/index.ts:493` (regra `auto:field-changed-consulta`) e para a sincronização Evolution.

### Fase 2 — Correção (fonte da verdade clara)

Definir contrato: **`custom_fields.consulta_agendada_em` é apenas espelho do `appointments`**, e a UI passa a editar o `appointment` quando ele existe.

Mudanças:

1. **`CustomFieldsPanel.tsx`** — para os dois campos de data de agendamento (`consulta_agendada_em`, `procedimento_agendado_em`):
   - Buscar o próximo `appointment` (`status='agendado' AND scheduled_at > now()`) via hook leve.
   - Se existir: o popover edita `appointments.scheduled_at` (via `updateAppointmentSchedule` já existente em `src/lib/appointments-mutations.ts`) e "Limpar" cancela o appointment (`status='cancelado'`).
   - Se não existir: cria appointment ao escolher data e edita `custom_fields` apenas como fallback para tenants sem módulo de agenda.
   - Indicar visualmente que o valor vem da agenda (ícone + tooltip "vinculado à agenda — abra a agenda para mais opções").

2. **`recompute_lead_appointment_summary`** — endurecer:
   - Quando NÃO houver appointment futuro `agendado`, **não sobrescrever** silenciosamente; só limpar se o último estado também veio da agenda. Marcador: novo campo `custom_fields_source.<key>='appointment'|'manual'` ou usar `custom_fields_last_human_edit[key]` com a regra "se editado por humano há <X horas, não toca". Recomendo a janela G10 já existente (7 dias) como guard padrão.

3. **Front anti-race no `CustomFieldsPanel.save()`**:
   - Debounce de 400 ms no save da data (evita saves múltiplos do `<input type="time">`).
   - Após `await update`, re-fetchar a linha do lead e reconciliar `values` (evita realtime trazer snapshot stale).

### Fase 3 — Telemetria e guard

1. Logar em `lead_events` toda escrita de `consulta_agendada_em` / `procedimento_agendado_em` com `source: 'manual'|'recompute'|'classifier'` para auditar futuras divergências.
2. Adicionar teste em `supabase/functions/_shared/__tests__/` simulando: edição manual → update em appointment → garantir que o valor manual sobrevive dentro da janela G10.
3. Atualizar `docs/skill-datas.md` com a nova regra "appointment é a fonte da verdade quando existe; edição manual cria/edita o appointment".

## Detalhes técnicos relevantes

- Arquivos tocados: `src/components/inbox/CustomFieldsPanel.tsx`, `src/lib/appointments-mutations.ts` (já existe), nova migration para reforçar `recompute_lead_appointment_summary`, possíveis ajustes em `supabase/functions/pipeline-deterministic/index.ts` (regra `auto:appointment-sync`).
- Sem mudança de schema: usa `custom_fields_last_human_edit` que já existe.
- Sem impacto na IA (classifier já não escreve essas chaves).
- Compatível com tenants que não usam o módulo `appointments` (fallback puro em `custom_fields`).

## Como vou validar

1. psql: edição manual + UPDATE em appointment não sobrescreve.
2. UI: editar hora → fechar popover → aguardar 30 s com tela aberta → valor persiste.
3. UI: clicar "Limpar" com appointment existente → appointment é cancelado, data some, não reaparece.
4. Replay no lead da Thereza para confirmar fix em produção.
