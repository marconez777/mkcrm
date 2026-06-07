---
title: 13. Baseline Fase 0 — Diagnóstico da integração Clínica ÓR
topic: integracao
kind: reference
audience: user
updated: 2026-06-07
summary: Este documento é o "antes". Toda melhoria da Fase 1+ deve ser medida contra estes números.
---
# 13. Baseline Fase 0 — Diagnóstico da integração Clínica ÓR

> **Data do diagnóstico:** 2026-05-26
> **Janela analisada:** últimos 30 dias
> **Clínica:** `ÓR` (`slug=or`, `clinic_id=cf038458-457d-4c1a-9ac4-c88c3c8353a1`)
> **Integração:** `Site Or` (`id=cf9ec890-83fe-4751-9bc5-aacc69f7e9bd`, token `mkf_3a2f5dd0…`)

Este documento é o "antes". Toda melhoria da Fase 1+ deve ser medida contra estes números.

---

## TL;DR — Respostas às 4 perguntas-chave

1. **Quanto tracking estamos perdendo?** → **100 %**. Nenhum submit do site grava `visitor_id`/`session_id` em `tracking_identity_links` com `link_source='form_submission'`. Os 7 vínculos existentes vieram de `whatsapp_tracking_code` (4) e `phone_hash_existing` (3) — nada do snippet de forms.
2. **Quantos leads/dia chegam dos domínios da ÓR via forms?** → **Zero.** 172 leads em 30 dias, **todos** com `form_source = NULL` e `landing_page = NULL`. O site nunca produziu lead bem-sucedido via `forms-ingest` — só 2 submits totais, **ambos com erro** (ver §3 abaixo).
3. **Existem eventos `test_completed` e `whatsapp_click`?** → **Não.** `lead_events` só tem `attendant_changed` (1328), `stage_changed` (478) e `stage_changed_by_ai` (48). Nenhum evento de origem (form_submission, page_view, whatsapp_click, test_completed).
4. **`allowed_domains` do token está correto?** → **Quase — formato sujo + falta preview.** Atual: `["https://clinicaohrpsiquiatria.com/"]` (com `https://` e `/` final — funcionou só porque o normalizador é tolerante). Domínio de produção real é `clinicaohrpsiquiatria.com`. **Falta** o preview Lovable `mindscape-revive.lovable.app`. O domínio `clinicaor.com.br` **não existe** — foi suposição errada na primeira análise.

---

## 🚨 Achado crítico não previsto — bloqueador P0 novo

Os **únicos 2 submits que o snippet conseguiu enviar** falharam com:

> `function public.enqueue_email(uuid, text, text, text, jsonb, timestamp with time zone, uuid, text, boolean) is not unique`

| created_at | form_key | status | error |
|---|---|---|---|
| 2026-05-26 12:37 | `phq9` | `error` | enqueue_email is not unique |
| 2026-05-26 12:36 | `phq9` | `error` | enqueue_email is not unique |

**Causa:** o trigger `trg_email_on_lead_created` em `public.leads` chama `enqueue_email(...)` com 9 args. No momento dos submits existiam **duas overloads** de `enqueue_email` no schema `public`, e o Postgres não soube qual escolher.

**Status agora:** a migration `20260526124515` (rodada às 12:45 do mesmo dia, ~8 minutos depois das falhas) consolidou para **uma única função** com 11 args (`pronargs=11, pronargdefaults=8`). Logo, *teoricamente* o problema já está resolvido.

**Validar antes de Fase 1:**
- Pedir ao dev do site para reenviar 1 submit de teste no PHQ-9.
- Conferir que `form_submissions.status='ok'` e `lead_id IS NOT NULL`.
- Se ainda falhar → bloqueia tudo, abrir investigação separada antes da Fase 1.

---

## 1. Identificação da clínica

```sql
SELECT id, name, slug FROM clinics WHERE name ILIKE '%or%' OR slug ILIKE '%or%';
```

| id | name | slug |
|---|---|---|
| `cf038458-457d-4c1a-9ac4-c88c3c8353a1` | ÓR | or |

---

## 2. Integração e `allowed_domains`

| campo | valor |
|---|---|
| `id` | `cf9ec890-83fe-4751-9bc5-aacc69f7e9bd` |
| `name` | Site Or |
| `status` | active |
| `allowed_domains` | `["https://clinicaohrpsiquiatria.com/"]` ⚠️ formato sujo (URL completa em vez de hostname) |
| `total_submissions` | **0** (contador só incrementa em `status='ok'`) |
| `last_submission_at` | `null` |

> Apesar do formato torto, o normalizador do `forms-ingest` aceitou — prova: as 2 submissões falhas em §3 vieram com `Origin: https://clinicaohrpsiquiatria.com` e passaram pelo check de origem (falharam só depois, no trigger).

**Domínios reais da Clínica Or:**
- **Produção:** `clinicaohrpsiquiatria.com` ← snippet instalado, único enviando dados hoje
- **Preview Lovable:** `mindscape-revive.lovable.app` ← onde o time edita; ainda não está em `allowed_domains`
- `clinicaor.com.br` **NÃO existe** (suposição errada da análise inicial)

**Ação imediata (UI, antes da Fase 1):** em `/settings/forms` → editar "Site Or" → allowed_domains:
- `clinicaohrpsiquiatria.com` (substituir o valor torto atual)
- `mindscape-revive.lovable.app`

Sem `https://`, sem barra final, sem espaço.

---

## 3. Submissões de formulário (30d)

```sql
SELECT date_trunc('day',created_at)::date AS dia, form_key, status, COUNT(*)
FROM form_submissions
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND created_at >= now() - interval '30 days'
GROUP BY 1,2,3 ORDER BY 1 DESC;
```

| dia | form_key | status | qtd | leads_unicos |
|---|---|---|---|---|
| 2026-05-26 | phq9 | **error** | 2 | 0 |

- **0 submits OK** em 30 dias.
- Confirma que o site **não está atribuindo** nenhum lead que aparece no CRM hoje.

---

## 4. Eventos no timeline (30d)

```sql
SELECT type, COUNT(*) FROM lead_events
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND created_at >= now() - interval '30 days'
GROUP BY 1 ORDER BY 2 DESC;
```

| type | qtd |
|---|---|
| `attendant_changed` | 1328 |
| `stage_changed` | 478 |
| `stage_changed_by_ai` | 48 |

Nenhum `form_submission`, `page_view`, `whatsapp_click` ou `test_completed`. 100 % dos eventos são internos do CRM.

---

## 5. Atribuição (`tracking_identity_links`)

```sql
SELECT link_source, COUNT(*) FROM tracking_identity_links
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
GROUP BY 1;
```

| link_source | qtd |
|---|---|
| `whatsapp_tracking_code` | 4 |
| `phone_hash_existing` | 3 |

**Nenhum vínculo `form_submission`.** Confirma que `visitor_id` nunca foi recebido pelo `forms-ingest` (porque o tracking-pixel não está no site → conflito P0.1 do `11-analise-conflitos`).

---

## 6. Leads sem origem (30d)

```sql
SELECT COUNT(*) total_leads_30d,
       COUNT(*) FILTER (WHERE landing_page IS NULL) sem_landing,
       COUNT(*) FILTER (WHERE form_source IS NULL) sem_form_source,
       COUNT(*) FILTER (WHERE custom_fields->'utm' IS NULL) sem_utm
FROM leads
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND created_at >= now() - interval '30 days';
```

| total | sem_landing | sem_form_source | sem_utm |
|---|---|---|---|
| 172 | 172 (100 %) | 172 (100 %) | 172 (100 %) |

```sql
SELECT form_source, COUNT(*) FROM leads
WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1'
  AND created_at >= now() - interval '30 days'
GROUP BY 1;
```

| form_source | count |
|---|---|
| `NULL` | 172 |

**Conclusão:** os 172 leads do mês vieram exclusivamente de canais não-web (provavelmente WhatsApp inbound via Evolution). O site não contribuiu com **nenhum** lead rastreável.

Volume diário (amostra):

| dia | leads |
|---|---|
| 2026-05-26 | 5 |
| 2026-05-25 | 5 |
| 2026-05-24 | 2 |
| 2026-05-21 | 6 |
| 2026-05-20 | 4 |
| 2026-05-19 | 4 |
| 2026-05-18 | 9 |
| 2026-05-14 | 7 |
| 2026-05-13 | 7 |
| **2026-05-11** | **41** (pico — provavelmente import ou broadcast) |
| 2026-05-07 | 15 |
| 2026-05-06 | 15 |

---

## 7. Formato dos telefones (total histórico)

```sql
SELECT COUNT(*) total,
       COUNT(*) FILTER (WHERE phone LIKE '+%') com_mais,
       COUNT(*) FILTER (WHERE phone ~ '^[0-9]+$') so_digitos,
       COUNT(*) FILTER (WHERE phone LIKE 'email:%') email_fallback
FROM leads WHERE clinic_id='cf038458-457d-4c1a-9ac4-c88c3c8353a1';
```

| total | com `+` | só dígitos | fallback `email:` |
|---|---|---|---|
| 1480 | 1 | 1479 | 0 |

**Confirma o conflito P1.6:** o CRM está padronizado em "só dígitos" (`5511…`). A futura migration da Fase 1 vai prefixar `+` em **1479 registros** desta clínica (e mais em outras — confirmar antes de rodar globalmente).

---

## Recomendação — seguir para Fase 1?

**Sim, com 2 pré-requisitos não previstos:**

1. ⚠️ **Validar que `enqueue_email` agora aceita a chamada de 9 args.** Pedir 1 submit real no site e conferir `form_submissions.status='ok'`. Se falhar, Fase 1 não roda — o trigger continua quebrando todo lead criado por forms-ingest.
2. ⚠️ **Atualizar `allowed_domains`** da integração `Site Or` via UI para `clinicaohrpsiquiatria.com` + `mindscape-revive.lovable.app` (hostname puro, sem `https://` nem `/`). Sem isso, qualquer teste a partir do preview Lovable retorna 403.

Depois disso, a Fase 1 (revisada) tem só 2 entregas:
- ✅ **CRM**: bridge de CustomEvents `mk:*` no `tracking-pixel` (feito — captura `test_completed`, `lead_created`, `wa_click` etc.).
- ⏳ **Site**: instalar `<script async src=".../tracking-pixel?project_id=cf038458-457d-4c1a-9ac4-c88c3c8353a1"></script>` no `<head>` (resolve `visitor_id`, `_mk_sid`, page_view SPA, UTM, whatsapp_click automático).
- ❌ **Migration de telefone E.164 — ADIADA.** Auditoria mostrou 8 arquivos com `.eq("phone", ...)` em digits-only (evolution-webhook etc.). Migrar quebra inbound WhatsApp. Precisa plano dedicado.

