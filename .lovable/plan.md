
# Fase 0 — Diagnóstico baseline da integração ÓR

Objetivo: gerar números de "antes" para medir o impacto das Fases 1–4. **Nenhuma alteração de código ou banco.** Só leitura.

---

## Entregáveis

1. Um arquivo novo: `docs/integracao/13-baseline-fase0.md` com:
   - Resultado de cada query (tabela + comentário)
   - Resposta para as 4 perguntas-chave abaixo
   - Data/hora do diagnóstico e janela analisada (últimos 30 dias)
2. Atualização do `docs/integracao/README.md` listando o novo arquivo.

---

## Perguntas que o diagnóstico precisa responder

1. **Quanto tracking estamos perdendo?** → % de `form_submissions` da Clínica ÓR com `visitor_id IS NULL` (esperado: ~100 %).
2. **Quantos leads/dia chegam dos domínios da ÓR?** → contagem diária dos últimos 30 dias, agrupada por `landing_page` host.
3. **Quantos test_completed e whatsapp_click temos hoje?** → contagem em `lead_events` (esperado: 0 ou perto disso).
4. **O token está com `allowed_domains` correto?** → conferir registro em `form_integrations` para a Clínica ÓR.

---

## Queries que serão executadas (read-only)

Cada uma roda via `supabase--read_query`. Resultados copiados para o `.md`.

### Q1 — Identificar a clinic_id da ÓR
```sql
SELECT id, name, slug FROM clinics WHERE name ILIKE '%or%' OR slug ILIKE '%or%';
```

### Q2 — Token e allowed_domains
```sql
SELECT id, clinic_id, name, status, allowed_domains, total_submissions,
       last_submission_at
FROM form_integrations
WHERE clinic_id = '<clinic_id_or>';
```

### Q3 — % de submissions sem visitor_id (últimos 30d)
```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE payload->>'visitor_id' IS NULL) AS sem_visitor,
  ROUND(100.0 * COUNT(*) FILTER (WHERE payload->>'visitor_id' IS NULL) / NULLIF(COUNT(*),0), 1) AS pct_sem_visitor
FROM form_submissions
WHERE clinic_id = '<clinic_id_or>'
  AND created_at >= now() - interval '30 days';
```
*(observação: snippet hoje envia `visitor_id` no body, não dentro de `payload.fields`; vou também conferir colunas dedicadas se existirem)*

### Q4 — Submissions por dia / por form_key
```sql
SELECT date_trunc('day', created_at)::date AS dia,
       form_key,
       COUNT(*) AS submissions,
       COUNT(DISTINCT lead_id) AS leads_unicos
FROM form_submissions
WHERE clinic_id = '<clinic_id_or>'
  AND created_at >= now() - interval '30 days'
GROUP BY 1,2 ORDER BY 1 DESC, 3 DESC;
```

### Q5 — Eventos no timeline (tipos e contagens)
```sql
SELECT type, COUNT(*) AS qtd, MIN(created_at) AS primeiro, MAX(created_at) AS ultimo
FROM lead_events
WHERE clinic_id = '<clinic_id_or>'
  AND created_at >= now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;
```
Foco: confirmar que `test_completed` e `whatsapp_click` não existem.

### Q6 — Atribuição (tracking_identity_links)
```sql
SELECT link_source, COUNT(*) AS qtd
FROM tracking_identity_links
WHERE clinic_id = '<clinic_id_or>'
GROUP BY 1;
```

### Q7 — Leads sem origem
```sql
SELECT
  COUNT(*) AS total_leads_30d,
  COUNT(*) FILTER (WHERE landing_page IS NULL) AS sem_landing,
  COUNT(*) FILTER (WHERE form_source IS NULL) AS sem_form_source,
  COUNT(*) FILTER (WHERE custom_fields->'utm' IS NULL) AS sem_utm
FROM leads
WHERE clinic_id = '<clinic_id_or>'
  AND created_at >= now() - interval '30 days';
```

### Q8 — Formato atual dos telefones (vai virar baseline pré-migration da Fase 1)
```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE phone LIKE '+%') AS com_mais,
  COUNT(*) FILTER (WHERE phone ~ '^[0-9]+$') AS so_digitos,
  COUNT(*) FILTER (WHERE phone LIKE 'email:%') AS email_fallback
FROM leads
WHERE clinic_id = '<clinic_id_or>';
```

---

## Critério de saída

- README de integração atualizado.
- Arquivo `13-baseline-fase0.md` preenchido com tabelas reais.
- Conclusão objetiva em 4 bullets respondendo Q1–Q4 acima.
- Recomendação clara de seguir para Fase 1 ou ajustar algo antes (ex.: se `allowed_domains` estiver errado, corrigir via UI primeiro).

---

## O que NÃO está incluído neste plano

- Nenhuma alteração em `forms-snippet`, `forms-ingest` ou criação de `track-event`.
- Nenhuma migration de telefone.
- Nada que dependa do time do site da ÓR.

Essas mudanças entram na próxima rodada (Fase 1), depois de revisar o baseline.
