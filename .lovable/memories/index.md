# Project Memory

## Core
Pipeline Clínica ÓR está em v4.1 (11 colunas) — fonte de verdade: `docs/pipeline/`. Sem coluna "Procedimento pago" (virou campo `status_financeiro`). "Procedimento agendado" foi renomeado para "Tratamento agendado".
Lembretes vivem em `/automations` (UI), não em código. Reator humano (D7) reage a ações manuais; tag `precisa_atencao_humana` (D8) marca leads travados.

## Memories
- [Pipeline v4.1 decisions](mem://docs/pipeline-v4-1) — D1–D8, gates G1–G11, fases de implementação
