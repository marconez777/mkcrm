# Memory: index.md
Updated: today

# Project Memory

## Core
Pipeline Clínica ÓR está em v4.2 (11 colunas) — fonte de verdade do ESTADO REAL: `docs/pipeline/runtime/`. `docs/pipeline/` raiz documenta o PLANO v4.2 (D1–D8). Sem coluna "Procedimento pago" (virou campo `status_financeiro`). "Procedimento agendado" foi renomeado para "Tratamento agendado".
Lembretes vivem em `/automations` (UI), não em código. Reator humano = cron diário criando task "Revisar lead travado" para leads com tag `precisa_atencao_humana` parados ≥7d.
Classifier (gpt-5-mini) roda 1/min, valida datas via sanitizeDateField (anchor=última msg), tem PROTECTED_TAGS, e regra anti "1ª consulta" em leads >90d ou tratados.
Auditores A1 (cron 03h BRT) e A2 (hook pós-move) só sinalizam via tag — nunca movem card.
Não existe scripts/docs-sync.mjs neste projeto.

## Memories
- [Pipeline v4.2 decisions](mem://docs/pipeline-v4-2) — D1–D8, gates G1–G11, fases incluindo Fase 2.5 (A1/A2/A3)
- [Docs maintenance progress](mem://docs/maintenance-progress) — pasta runtime/ criada em 2026-06-18 com 14 docs espelhando o estado deployado
