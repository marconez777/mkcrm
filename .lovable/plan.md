
## Contexto (o que já existe)

- `forms-ingest` **já cria lead** quando o formulário tem phone ou email. Hoje a regra de destino é:
  1. `form_definitions.default_pipeline_stage_id` (override do form), senão
  2. `form_integrations.default_pipeline_stage_id` (override da integração), senão
  3. Pipeline de sistema **"Formulário Site"** (`system_key='forms_site'`), primeiro estágio "Novo".
- Existe pipeline `is_default=true, kind='sales'` por clínica (ex.: "Agendamentos Novo") com estágio de nutrição (ex.: "NUTRIÇÃO DE LEADS INATIVOS").
- Página `/tracking` já mostra "Leads via formulário" e splits por bucket (consulta / tratamento / nutrição), mas a configuração dos buckets está só no **localStorage** do navegador — `daily-summary` não tem como reusar.
- `daily-summary` hoje envia só: novos leads (total), enviados/abertos/cliques/bounces de email. Nenhum recorte por origem nem conversão.

---

## Decisão de produto

Quando o `forms-ingest` cria um lead novo (sem override explícito na integração/definition), ele deve cair no **pipeline padrão de vendas** (`is_default=true AND kind='sales'`), na **etapa de Nutrição** desse pipeline (heurística por nome `/nutri/i`, igual à `suggestStageConfig` do Tracking). Se nada bater, mantém o fallback atual (pipeline `forms_site`) para não quebrar.

Leads que **já existem** (match por phone/email) **não mudam de etapa** — continuamos só fazendo patch de campos vazios. Isso evita "puxar de volta" para nutrição um lead que já está em consulta/tratamento.

---

## Etapas

### Etapa 1 — Novo destino padrão dos leads de formulário (`forms-ingest`)

Editar `supabase/functions/forms-ingest/index.ts`, bloco de resolução de `stageId` no `else` de "criar lead novo":

Nova cascata:
1. `def.default_pipeline_stage_id` (mantém)
2. `integration.default_pipeline_stage_id` (mantém)
3. **NOVO**: pipeline `is_default=true AND kind='sales'` da clínica → estágio cujo `name ~* 'nutri'`, menor `position`. Se não houver estágio "nutri", usa o **primeiro estágio** desse pipeline (ordenado por position).
4. Fallback atual: pipeline `system_key='forms_site'` → primeiro estágio.
5. Último fallback: `null` (lead sem stage, como hoje).

Sem alterar lógica de match, tags, eventos, identidade visitor, segmentos de email — só o cálculo de `stageId`.

**Não afeta** leads já existentes (mantém `stage_id` atual).

### Etapa 2 — Persistir buckets (consulta/tratamento/nutrição) por clínica

Para o `daily-summary` ranquear conversão, ele precisa saber quais `stage_id` são "consulta", "tratamento" e "nutrição". Hoje isso vive em `localStorage`.

Migração: adicionar `clinics.settings.tracking_stage_buckets` (jsonb dentro do `settings` existente):
```json
{ "consulta": ["stage_id", ...], "tratamento": [...], "nutricao": [...] }
```
Não precisa nova coluna — `clinics.settings` já é jsonb. Sem migration.

Mudar `src/pages/Tracking.tsx`:
- Carregar `stageConfig` de `clinics.settings.tracking_stage_buckets` (com fallback para localStorage durante migração).
- `saveStageConfig` faz `update clinics set settings = jsonb_set(...)` via supabase client.
- Auto-sugestão continua igual, mas grava no servidor.

Sem mudar UI/UX.

### Etapa 3 — Métricas novas no `daily-summary`

Editar `supabase/functions/daily-summary/index.ts`. Para cada clínica, nas últimas 24h, calcular:

- `leadsNew` — já existe.
- **`leadsFromForm`** — `leads` com `created_at >= since` e `form_source IS NOT NULL` (ou `LIKE 'form:%'`).
- **`leadsFromFormNoWhatsapp`** — subset acima onde **não existe** mensagem em `messages` (lead nunca respondeu) **E** `last_message_at IS NULL` ou só tem `from_me=false` ausente. Mais simples: `leads.last_message_at IS NULL` no subset acima. Documentar a heurística.
- **`formToConsulta` / `formToTratamento`** — dos `leadsFromForm` das últimas 24h, quantos já estão hoje em `stage_id ∈ settings.tracking_stage_buckets.consulta` / `.tratamento`. Se `tracking_stage_buckets` não estiver configurado, esconder o bloco (renderizar nota "Configure os estágios em /tracking para ver conversão").

Adicionar essas linhas ao `renderHtml`:
```
Leads via formulário              X
  └ sem contato no WhatsApp       Y
  └ converteram em consulta       A
  └ converteram em tratamento     B
```

Sem mudar destinatários, agendamento ou Resend.

### Etapa 4 — KPI "Form sem WhatsApp" na página Tracking (opcional, pequeno)

Em `src/pages/Tracking.tsx`, adicionar um `KpiCard` ao lado de "Leads via formulário": **"Form sem WhatsApp"** = `formLeads` cujo `last_message_at` é null. Já temos os dados em `leadsArr`. Uma linha de código no `useMemo` dos kpis e um card novo.

### Etapa 5 — Docs

- `docs/features/FORMS.md` §3.6: atualizar a cascata de `stage_id` com o novo passo 3.
- `docs/edge-functions/EMAIL.md` (ou onde estiver documentado o daily-summary): novos campos do email.
- `docs/flows/TRACKING_TO_LEAD.md`: nota de que form vira lead direto no pipeline padrão, etapa de nutrição.

---

## Riscos e mitigação

- **Clínicas que já configuraram `integration.default_pipeline_stage_id` apontando para "Formulário Site"** continuam funcionando (override tem prioridade).
- **Heurística `/nutri/i` pode não casar** em alguma clínica — fallback escolhe o **primeiro estágio** do pipeline default, o que é razoável (lead novo entra no topo). Documentar.
- **`tracking_stage_buckets` não configurado** → daily-summary não mostra conversão (mostra só total e "sem WhatsApp"). Sem erro.
- **Sem backfill automático** de leads antigos no pipeline "Formulário Site" — se você quiser mover os existentes, fazemos por SQL manual depois (não incluído neste plano para evitar mover lead que já avançou).

---

## Arquivos alterados

- `supabase/functions/forms-ingest/index.ts` — nova cascata de stage.
- `supabase/functions/daily-summary/index.ts` — novas queries + HTML.
- `src/pages/Tracking.tsx` — persistir `stageConfig` em `clinics.settings`; KPI extra opcional.
- `docs/features/FORMS.md`, `docs/flows/TRACKING_TO_LEAD.md`, doc do daily-summary.

Sem migração SQL. Sem novas tabelas.
