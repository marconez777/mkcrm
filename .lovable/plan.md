# Suprimir backlog + ampliar janela de envio (10h–22h)

Dois objetivos independentes, na mesma rodada:

## 1. Bloquear o backlog (não enviar lembretes "atrasados")

**Risco real:** após o backfill da Opção B, ~316 leads passam a ter `data_horario` em ISO válido. No próximo tick (a cada 5 min), o worker `automations-tick` vai avaliar a janela de cada automation e potencialmente disparar em lote para tudo que estiver dentro do intervalo `[appt - offset, appt - 5min]`. Especialmente a D-1 (offset 24h): qualquer consulta nas próximas 24h entraria.

**Solução:** inserir uma linha em `automation_runs` para cada (lead × automation) cuja janela já está "consumida no passado", marcando como `status = 'skipped'` com `detail = 'backlog suppressed (custom_fields normalization)'` e `created_at = now()`. Isso ativa o filtro de cooldown do worker.

Aplicar via insert tool (uma única transação, após a normalização da Opção B):

```sql
WITH appts AS (
  SELECT id AS lead_id, (custom_fields->>'data_horario')::timestamptz AS appt
  FROM leads
  WHERE custom_fields ? 'data_horario'
    AND custom_fields->>'data_horario' ~ '^\d{4}-\d{2}-\d{2}T'
    AND archived_at IS NULL
)
INSERT INTO automation_runs (automation_id, lead_id, clinic_id, status, detail, created_at)
SELECT a.id, l.lead_id, lr.clinic_id, 'skipped',
       'backlog suppressed (custom_fields normalization)', now()
FROM automations a
CROSS JOIN appts l
JOIN leads lr ON lr.id = l.lead_id
WHERE a.trigger_type = 'before_appointment'
  AND a.enabled = true
  AND l.appt > now()                                        -- consulta ainda no futuro
  AND l.appt - make_interval(mins => COALESCE((a.trigger_config->>'offset_minutes')::int, 60)) <= now();
```

Isso só atinge leads cuja janela de disparo da automation **já começou** (target ≤ now). Leads futuros (target ainda > now) não recebem skip — eles disparam normalmente quando chegar a hora.

**Cobertura por automation:**
- D-1 (offset 1440 min): cobre todos os appts entre agora e +24h → evita o lote.
- D-0 (offset 60 min): cobre appts entre agora e +1h → evita os imediatos.

Como `cooldown_hours = 23` (D-1) e `1` (D-0), o skip cobre toda a janela útil.

## 2. Ampliar janela de envio para 10h–22h e remover horário fixo

Hoje o worker tem janela hardcoded `08:00 ≤ hora < 18:00` e a D-1 tem `preferred_time: "15:00"` que força o disparo só após 15h. Mudanças:

### 2a. Patch no worker `supabase/functions/automations-tick/index.ts`

Tornar a janela configurável por automation, com defaults novos (10–22):

```ts
// linhas ~78-83
const businessStart = Number(cfg.business_hours_start ?? 10);
const businessEnd   = Number(cfg.business_hours_end   ?? 22);

// linha 112 — substituir
if (businessOnly && (!isWeekday || localHour < businessStart || localHour >= businessEnd)) return [];
```

Manter `preferred_time` funcionando para quem ainda usar — só não vamos usar mais.

Também relaxar o `isWeekday`? Hoje bloqueia sábado/domingo. Mantenho como está — usuário não mencionou.

### 2b. Atualizar config das duas automations (via insert tool)

```sql
-- D-1: remove preferred_time, adiciona janela 10-22
UPDATE automations
SET trigger_config = (trigger_config - 'preferred_time')
                     || '{"business_hours_start":10,"business_hours_end":22}'::jsonb,
    name = 'Lembrete de consulta — 1 dia antes'
WHERE id = '65e28148-c2eb-439f-ae3d-694f9acda28e';

-- D-0: mesma janela 10-22
UPDATE automations
SET trigger_config = trigger_config
                     || '{"business_hours_start":10,"business_hours_end":22}'::jsonb
WHERE id = 'c3111dc7-30de-4d5e-92d6-e8f557423b60';
```

Renomeio a D-1 (remove "15h" do nome) para refletir o novo comportamento.

### Comportamento resultante

- **D-1**: para uma consulta amanhã às 14h, o target é hoje às 14h. O worker passa a disparar no primeiro tick após hoje 14h, desde que a hora local esteja em [10, 22). Antes esperava até 15h.
- **D-0**: para uma consulta hoje às 11h, target = hoje 10h. Dispara no primeiro tick após 10h se hora local em [10, 22). Antes a janela era [8, 18).
- Consultas que caem fora de [10, 22) (ex.: appt às 08:00, target D-0 às 07:00) ficam represadas até as 10:00 do mesmo dia — se passar de `appt - 5min` nesse meio tempo, perde-se a janela. Aceito porque o usuário definiu 10–22 como hard window.

## Ordem de execução

1. Executar o UPDATE da Opção B (normalização ISO).
2. Executar o INSERT de skip (item 1 deste plano) — tem que ser **antes** do próximo tick.
3. Executar os UPDATEs em `automations` (item 2b).
4. Editar `supabase/functions/automations-tick/index.ts` (item 2a) — deploy automático.

Os passos 1+2+3 podem ir num único `insert tool` call para garantir atomicidade do estado do backlog.

## Verificação pós-execução

```sql
-- backlog suprimido?
SELECT a.name, count(*) AS skipped
FROM automation_runs r
JOIN automations a ON a.id = r.automation_id
WHERE r.status = 'skipped'
  AND r.detail LIKE 'backlog suppressed%'
  AND r.created_at > now() - interval '5 min'
GROUP BY a.name;

-- config nova
SELECT name, trigger_config FROM automations WHERE trigger_type='before_appointment';
```

## Arquivos / objetos tocados

- **Data:** UPDATE em `leads` (Opção B já planejada), INSERT em `automation_runs`, UPDATE em `automations` → tudo via insert tool, um único bloco.
- **Código:** `supabase/functions/automations-tick/index.ts` — 2 linhas alteradas.
- **Sem mudança** em schema, RLS, frontend, ou outros pontos.
