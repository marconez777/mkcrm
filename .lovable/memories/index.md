# Project Memory

## Core
Pipeline Clínica ÓR está em v4.2 (11 colunas) — fonte de verdade: `docs/pipeline/`. Sem coluna "Procedimento pago" (virou campo `status_financeiro`). "Procedimento agendado" foi renomeado para "Tratamento agendado".
Lembretes vivem em `/automations` (UI), não em código. Reator humano (D7) reage a ações manuais; tag `precisa_atencao_humana` (D8) marca leads travados.
v4.2 adiciona Fase 2.5 com agentes auditores A1 (position-auditor cron), A2 (post-move-verifier hook), A3 (tool get_lead_history no classifier). Nenhum deles move card — só sinalizam via tag.

## Memories
- [Pipeline v4.2 decisions](mem://docs/pipeline-v4-2) — D1–D8, gates G1–G11, fases incluindo Fase 2.5 (A1/A2/A3)
