
# Auditoria: ÓR × MCD × MK Espanha

## Fase 1 — Documentação (nova doc `docs/clinics/COMPARATIVO.md`)

Levantamento inicial já feito no banco:

| Item | ÓR | MCD | MK Espanha |
|------|----|-----|------------|
| clinic_id | cf03…3a1 | 3c48…61a | 467e…c82 |
| Região / TZ | br / America/Sao_Paulo | br / SP | br / SP (⚠ deveria ser `es` / Europe/Madrid) |
| Instâncias WA | 3 (todas `open`, webhook_ok) | 1 (`close`, criada 01/07 02:18) | 1 (`close` desde 27/06) |
| Broadcasts rodados | 3 (`done`) | 0 | 1 (`done`, 9 grupos × 1 parte) |
| Pipelines completos, cron mensal, agentes IA | Sim (ver `docs/estudo/*`) | Só o padrão | Só o padrão |

A doc vai consolidar, por clínica: instâncias, pipelines, agentes IA, secrets (Evolution/OpenAI/Gemini), automações, e checklist do que ÓR tem e as outras 2 não.

## Fase 2 — Bug MK Espanha: broadcast envia só 1 mensagem por grupo

Achado no banco: a broadcast `ea28e01c…` (MK Espanha) tem **9 grupos × 1 parte cada** — nenhum grupo tem 3 partes salvas. Ou seja, o disparo do backend está correto (o `broadcast-tick` já faz loop em `parts` do grupo com drip de 1s — `supabase/functions/broadcast-tick/index.ts` linhas 138–231), o bug está no **frontend salvando só a primeira parte**.

Suspeitas no `src/pages/Broadcasts.tsx`:

1. `addPart` (linha 567): calcula `pos = (currentParts[last]?.position ?? 0) + 1`. Se `currentParts` foi lido stale (state não recarregado antes do próximo clique), o novo INSERT colide no UNIQUE `(group_id, position)` e é silenciosamente ignorado.
2. `updatePart` (linha 572) roda em `onBlur` do Textarea; se o usuário clica "Iniciar" sem tirar foco, a última parte fica com `content=""` e o tick pula (o executor manda vazio? conferir).
3. Ao duplicar broadcast (linha 130–133) o insert de partes usa o mesmo array — se position vem duplicada entre grupos ok, mas se o array de origem já vier truncado, propaga.

Correção planejada:
- Após `addPart`, chamar `reload()` **antes** de permitir novo clique e usar retorno do insert para position confirmada.
- Trocar `onBlur` por autosave debounced + `flushOnAction` no botão "Iniciar/Congelar".
- Guardar no broadcast-tick: se `content` vazio, pular parte com log em `broadcast_events` (hoje ele manda string vazia).
- Migration: backfill zero (só afeta broadcasts futuras).

## Fase 3 — Bug MCD: erro ao adicionar instância

Screenshot mostra `mcd-167c665a` "sessão expirada", mas no banco o registro atual é `mcd-00ea1be8` criado 01/07 02:18 (o antigo foi apagado e recriado). Ou seja o "pau" acontece no fluxo `evolution-provision` → `evolution-qr`. Sem logs armazenados. Preciso:

1. Adicionar log persistente em `error_events` dentro de `evolution-provision` / `evolution-qr` / `WhatsAppQrDialog` capturando `status`, `evolution_response`.
2. Reproduzir com Playwright logado como usuário MCD (auth injetada) clicando "Novo WhatsApp" na tela `/settings` → capturar network + screenshot.
3. Corrigir a causa raiz encontrada (provavelmente: instância órfã na Evolution com mesmo `evolution_instance` antigo, ou `webhook_token` colidindo).

## Fase 4 — Paridade de features ÓR → MCD / MK Espanha

Delta identificado que a ÓR tem e as outras podem estar sem:
- `stage_canonical_aliases` populada (foi origem do bug "Leads de entrada" já corrigido para ÓR).
- Agentes IA configurados (`ai_agents` + `agent_stages`).
- Cron mensal (`pipeline-monthly-cycle-or` é hardcoded para ÓR).
- MK Espanha está com `region='br'` — se for cliente Espanha deveria ser `es` (afeta moeda, TZ, templates i18n).

Doc vai listar isso como "gap list" acionável, sem alterar dados sem aprovação.

## Detalhes técnicos

Arquivos:
- Novo: `docs/clinics/COMPARATIVO.md`
- Edit: `src/pages/Broadcasts.tsx` (autosave partes, reload síncrono)
- Edit: `supabase/functions/broadcast-tick/index.ts` (skip parte vazia + log)
- Edit: `supabase/functions/evolution-provision/index.ts` + `evolution-qr/index.ts` (log `error_events`)
- Migration: nenhuma na Fase 2/3. Fase 4 só se você aprovar mudar `region` da MK Espanha para `es`.

## Ordem de entrega

1. Doc comparativa (Fase 1 + 4 gap list) — leitura sua.
2. Fix broadcast partes (Fase 2).
3. Instrumentar + reproduzir + corrigir MCD (Fase 3).

Confirma que posso seguir nessa ordem? Se quiser priorizar o bug do MCD primeiro, eu troco 3 ↔ 1.
