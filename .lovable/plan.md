# Análise do sistema de tracking

Revisei: `tracking-pixel`, `tracking-event`, `tracking-identify`, `tracking-config`, `_shared/attribution.ts`, `Tracking.tsx`, `AttributionTab.tsx`, `LeadAttributionCard.tsx`, e o estado atual do banco. Abaixo o que encontrei, separado por severidade.

---

## Diagnóstico do estado atual (banco)

- `tracking_visitors`: 15 linhas, apenas **1** com `first_source` preenchido, **0** com `last_non_direct_source`.
- `tracking_sessions`: 15 linhas, **0** com `raw_referrer`, apenas **1** com `source`.
- `tracking_lead_sources`: vazia (esperado — falta a chamada de `tracking-identify` na conversão).
- Clínicas `mkart` e `sanapta` têm `tracking.enabled` ausente e `allowed_domains` vazio.

A maior parte dos visitantes/sessões está sem origem porque foi gravada **antes** do deploy da nova `attribution.ts`. Como `tracking_sessions` usa `ignoreDuplicates: true`, esses registros antigos **nunca serão recalculados**. Os novos eventos já estão sendo atribuídos corretamente (a 1 sessão recente saiu como `direct/none/30/no_referrer_no_params`).

---

## Bugs reais

### 1. `applyRules` ignora regras de normalização por `medium`
`supabase/functions/tracking-event/index.ts` linhas 67–92. O tipo `Rule` tem `input_medium`, mas o loop só checa `input_source`. Qualquer regra cadastrada em `traffic_source_rules` que tente normalizar por `input_medium` (ex.: `medium="cpc"` sem source) é **silenciosamente ignorada**.

### 2. `last_non_direct` em `tracking_lead_sources` compara só `source`
`tracking-identify` linha 224: `conversionSession?.source !== visitor.last_non_direct_source`. Dois toques com mesmo `source` mas `medium`/`campaign` diferentes (ex.: `instagram/organic` vs `instagram/paid_social`) são tratados como iguais e o `last_non_direct` não é gravado — perde informação de mídia paga vs orgânica.

### 3. Pixel envia `ttclid`/`li_fat_id` mas `sanitizeUrl` os remove de `page_url`
`tracking-pixel` linha 24: `ALLOWED_QS` não inclui `ttclid` nem `li_fat_id`. Os campos chegam ao backend, mas a `page_url` registrada não preserva esses parâmetros (inconsistência com `gclid`/`fbclid`).

### 4. Domínio permitido vazio = aberto
`tracking-event` linha 130: `if (!allowed || allowed.length === 0) return true;`. Para as clínicas `mkart` e `sanapta`, que têm `allowed_domains: []`, qualquer origem na internet pode postar eventos. Combinado com `tcfg.enabled` não estar explicitamente `false`, ambas estão recebendo qualquer tráfego que mandar o slug delas. Risco real de pollution/spam.

### 5. Lookup de lead por email em `tracking-identify` não normaliza
Linha 117: `q.ilike("email", email.trim())` — não lowercase. Se o lead foi salvo como `Foo@bar.com` e a identificação chega como `foo@bar.com`, depende do collation. Telefone idem: só `replace(/\D/g, "")` — variações com/sem DDI (`+55`) não casam.

### 6. AttributionTab filtra por `created_at` com strings de data
`AttributionTab.tsx` linhas 52–53: `.gte("created_at", from).lte("created_at", to)`. Se `to` vier como `"2026-05-18"` (sem hora), o `lte` corta em 00:00 e exclui o dia inteiro de hoje. Precisa confirmar como `Tracking.tsx` formata `from/to`.

---

## Divergências / pontos de atenção (não-bug, mas vale saber)

### 7. Sessões antigas nunca serão preenchidas
`ignoreDuplicates: true` no upsert de `tracking_sessions` é correto para idempotência, mas significa que as 14 sessões pré-deploy ficam órfãs de atribuição para sempre. Se quiser limpar, dá pra rodar um backfill SQL apagando-as ou recomputando via `raw_querystring`/`raw_referrer` — mas todas têm `raw_referrer` nulo, então não há o que recuperar.

### 8. `first_channel_group` não existe em `tracking_visitors`
Gravamos `first_source/first_medium/first_campaign` mas não `first_channel_group`. A UI não pede, então é consistente, só falta paridade com `last_channel_group` e `last_non_direct_channel_group`.

### 9. Rate limiter é por-isolate
Comentário já admite (`Tiny in-memory`). Em produção com vários isolates Deno simultâneos, o limite efetivo é múltiplo do declarado. Para abuso real precisaria de Redis ou contador no Postgres.

### 10. `raw_referrer` nulo em 100% das sessões observadas
Não é bug — é comportamento real do site `clinicaohrpsiquiatria.com`. Provavelmente tem `Referrer-Policy: no-referrer` (ou `same-origin` + tráfego entre domínios), ou os visitantes chegam por bookmark/URL digitada. Sem `document.referrer` e sem UTM, cai em `direct` legitimamente.

### 11. Atribuição com `medium` sozinho devolve `source: "unknown"`
`attribution.ts` linha 161–169. Tecnicamente correto, mas a regra de normalização nunca vai consertar (ver bug #1). Lead com `?utm_medium=cpc` apenas vira `unknown/cpc` para sempre.

---

## Detalhes técnicos

```text
Severidade  | Arquivo                                | Linhas    | Resumo
------------|----------------------------------------|-----------|----------------------------------------
Alta        | tracking-event/index.ts                | 67-92     | applyRules ignora input_medium
Alta        | tracking-event/index.ts                | 128-133   | allowed_domains vazio = aberto
Média       | tracking-identify/index.ts             | 224       | last_non_direct compara só source
Média       | tracking-identify/index.ts             | 116-120   | email/phone lookup sem normalizar
Média       | tracking-pixel/index.ts                | 24        | ttclid/li_fat_id fora de ALLOWED_QS
Baixa       | tracking/AttributionTab.tsx            | 52-53     | filtro por created_at sem hora
Baixa       | tracking-event/index.ts                | 16-29     | rate limiter por isolate
```

---

## Próximos passos sugeridos

Se quiser corrigir, posso fazer numa segunda passada em ordem de impacto:

1. **Bugs 1, 2, 4** (alta) — regra de medium, comparação de last_non_direct, política de origin segura quando `allowed_domains` está vazio (ex.: bloquear se `enabled !== true`).
2. **Bugs 3, 5, 6** (média) — incluir `ttclid`/`li_fat_id` em ALLOWED_QS, normalizar email/phone na identify, ajustar range de datas na aba Atribuição.
3. **Limpeza opcional** — apagar as 14 sessões/visitantes pré-deploy sem atribuição, ou rodar script de recomputo para os que ainda têm `raw_querystring`.

Quer que eu já aplique as correções (e quais)?
