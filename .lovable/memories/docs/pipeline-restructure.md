---
name: Pipeline restructure 2026-06
description: Reestruturação ativa do pipeline Clínica ÓR (15→9 colunas) — fonte única de verdade do projeto, fases F0-F7, decisões aprovadas, estratégia pipeline-sombra.
type: feature
---

Documento principal: `docs/roadmap/PIPELINE_RESTRUCTURE_2026_06.md`.

Decisões já aprovadas pelo usuário:
- Orçamento de IA: até US$ 3 (estimado ~US$ 2 com gpt-5-nano).
- Administrativo (265 leads) = 100% B2B → vai para "B2B / Stakeholders".
- "Fechamento pendente" → Qualificação.
- "Em tratamento" só com `sessao_total > 0` e `saldo_sessoes_pacote > 0`; senão → Paciente antigo.
- Estratégia pipeline-sombra: criar pipeline novo paralelo dentro da própria Clínica ÓR, duplicar leads via `leads.shadow_of_lead_id`, validar lado a lado, cutover atômico (UPDATE em 1 transação).

Fases: F0 verificações · F1 schema + appointments + shadow_of_lead_id · F2 contrato campos/extractor · F3 edge `pipeline-shadow-build` + IA lote · F4 avaliação humana · F5 cutover · F6 limpeza · F7 docs.

Sucede `docs/roadmap/CLINIC_PIPELINE.md` (já marcado com sucessor).

Próximo passo quando usuário voltar ao tema: começar F0 (relatório de verificação, sem migrations).
