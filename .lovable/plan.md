# Fase 1 — Infra de reclassificação profunda

Decisão fechada na pergunta 1: **a IA pode mover leads para Paciente antigo, B2B ou Desqualificado** quando identificar isso na conversa (só não revisita os que já estão nessas 3 colunas).

## Entregas da F1

### 1.1 Migration — tabela `lead_reclassify_proposals`
```sql
create table public.lead_reclassify_proposals (
  id uuid pk default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  batch_tag text not null,                    -- ex: 'F2-consulta-agendada'
  current_stage_id uuid not null,
  proposed_stage_id uuid not null,
  proposed_custom_fields jsonb not null default '{}'::jsonb,
  confidence numeric not null,
  reasoning text not null,
  model text not null,
  tokens_in int, tokens_out int, cost_usd numeric,
  status text not null default 'pending'      -- pending|applied|rejected|skipped|error
    check (status in ('pending','applied','rejected','skipped','error')),
  applied_at timestamptz,
  applied_by uuid,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- índices: (clinic_id, status), (lead_id), (batch_tag)
-- GRANTs: authenticated select+update (RLS por clinic_id + has_role super_admin), service_role ALL
-- RLS: super_admin lê/atualiza tudo; service_role bypass
```

### 1.2 Migration — tabela `lead_reclassify_snapshot_2026_06` (rollback)
```sql
create table public.lead_reclassify_snapshot_2026_06 (
  lead_id uuid pk references leads(id) on delete cascade,
  clinic_id uuid not null,
  stage_id uuid not null,
  custom_fields jsonb not null,
  snapshotted_at timestamptz default now()
);
-- GRANTs: service_role ALL; sem acesso para anon/authenticated
-- RLS enabled, sem policies (só service_role bypass)
```

### 1.3 Edge function `lead-reclassify-deep`
**`supabase/functions/lead-reclassify-deep/index.ts`**

Input:
```ts
{ lead_id: string, batch_tag: string, dry_run?: boolean }
// ou em lote:
{ stage_id: string, batch_tag: string, limit?: number, dry_run?: boolean }
```

Pipeline:
1. Carrega lead + custom_fields + últimas 200 mensagens (ASC) + tasks abertas.
2. Snapshot em `lead_reclassify_snapshot_2026_06` (upsert, só se ainda não existe).
3. Monta prompt com:
   - data/hora atual (timezone clínica)
   - definição **exata** das 11 colunas (copiada de `docs/flows/PIPELINE_DERIVED.md`)
   - lista de `custom_fields` permitidos no patch
   - regra anti-alucinação: "só preencha `consulta_agendada_em`/`procedimento_agendado_em` se a data literal aparece no transcript"
   - regra de paciente antigo: "se houve consulta/sessão e há >30d sem nova marcação → Paciente antigo"
   - histórico completo formatado: `[YYYY-MM-DD HH:mm] <direção> <texto/[imagem]/[áudio: transcript]>`
4. Chama **Lovable AI Gateway**, modelo `google/gemini-3-flash-preview`, com tool `classify_lead` (schema Zod):
   ```ts
   { stage: enum(11 stages), custom_fields_patch: object,
     reasoning: string (≥40 chars), confidence: 0..1 }
   ```
5. Grava em `lead_reclassify_proposals` com `status='pending'` (ou `error`).
6. Não move o lead.

Salvaguardas:
- Skip se `manual_lock_until > now()` → status=`skipped`.
- Halt se gasto acumulado no `batch_tag` > US$ 6.
- Dedup: se já existe proposta `pending` no mesmo `batch_tag` para o lead, pula.

### 1.4 Página admin `/admin/reclassify`
**`src/pages/admin/AdminReclassify.tsx`** + rota em `App.tsx` (protegida por `ClinicOnlyRoute` + role super_admin).

UI:
- Header: seletor de `batch_tag` + botão "Disparar reclassificação" (escolhe stage origem + limit).
- Tabela paginada: lead (nome+phone), stage atual → proposta, confidence (barra), reasoning (expand), botões **Aprovar** / **Rejeitar**.
- Filtros: status (pending/applied/rejected), confidence min, stage origem, stage destino.
- Bulk: "Aprovar todas filtradas com confidence ≥ X".
- Link "ver chat" abre `LeadDrawer` no lead.

Aprovar = chama RPC `apply_reclassify_proposal(proposal_id)`:
- move lead (UPDATE stage_id)
- aplica `proposed_custom_fields` (merge jsonb)
- grava `lead_stage_history` com `reason='reclassify_deep:<proposal_id>'`
- grava `lead_events.type='stage_reclassified_deep'`
- atualiza proposal: `status='applied'`, `applied_at=now()`, `applied_by=auth.uid()`

### 1.5 Smoke test
- Disparar manualmente em 5 leads conhecidos (os 4 das prints + 1 de "Consulta agendada" suspeito).
- Verificar propostas no admin, aprovar 1, conferir que o card moveu no Kanban.

## Critério de aceite F1
- Migration aplicada, edge deployada, página `/admin/reclassify` carregando.
- 5 propostas geradas via dry-run, visíveis no admin com reasoning legível.
- 1 aprovação manual move o card corretamente.
- Custo dos 5 ≤ US$ 0.05.

## O que **não** entra na F1
- Nada de batch automático ainda (isso é F2+).
- Sem aprovação em massa por confidence — só botão manual (a UI já existe mas só usamos por amostragem).
- Sem aplicação retroativa nos 965.

Posso executar a F1?
