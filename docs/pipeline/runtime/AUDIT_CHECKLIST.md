---
title: "Audit checklist — 30 perguntas para outro agente"
topic: kanban
kind: troubleshooting
audience: agent
updated: 2026-06-18
summary: "30 perguntas que outro agente deve conseguir responder a partir da pasta runtime/. Cada pergunta linka para a doc com a resposta. Use como roteiro de revisão."
code_refs:
  - docs/pipeline/runtime/README.md
related_docs:
  - docs/pipeline/runtime/README.md
  - docs/pipeline/runtime/ARCHITECTURE.md
  - docs/pipeline/runtime/CLASSIFIER.md
  - docs/pipeline/runtime/AUDITORS.md
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
  - docs/pipeline/runtime/HUMAN_REACTOR.md
  - docs/pipeline/runtime/FIELDS_LIVE.md
  - docs/pipeline/runtime/TAGS_LIVE.md
  - docs/pipeline/runtime/DATABASE_LIVE.md
  - docs/pipeline/runtime/EVENTS_TELEMETRY.md
  - docs/pipeline/runtime/KNOWN_ISSUES.md
---

# 30 perguntas para auditar o pipeline

## Estrutura

1. **Qual o UUID do pipeline da Clínica ÓR e quantos stages tem?** → `STAGES_LIVE.md` (11 stages, `17c27f4d-…`)
2. **Algum stage está com `lock_auto_move=true`?** → `STAGES_LIVE.md` (não, nenhum)
3. **Quais stages são terminais?** → `STAGES_LIVE.md` (B2B / Stakeholders, Desqualificado)
4. **Como o código resolve "Novo" para um stage_id real?** → `STAGES_LIVE.md` (alias em `stage_canonical_aliases`)

## Classifier

5. **Qual modelo o classifier usa?** → `CLASSIFIER.md` (gpt-5-mini)
6. **Com que frequência o classifier roda?** → `CLASSIFIER.md` (cron 1/min + executor manual)
7. **Quantos leads o classifier processa por tick?** → `CLASSIFIER.md` (50)
8. **Que threshold de confidence move um lead?** → `CLASSIFIER.md` + `app_settings` (0.75 default; 0.9 para B2B)
9. **O que acontece se confidence < 0.6?** → `CLASSIFIER.md` (tag `precisa_atencao_humana`, sem move)
10. **Onde se valida que `consulta_agendada_em` não está no passado?** → `CLASSIFIER.md` § Validações (`sanitizeDateField`)
11. **Como o classifier evita rotular paciente antigo como "1ª consulta"?** → `CLASSIFIER.md` § Prompt + `KNOWN_ISSUES.md#1`
12. **Que tags o classifier NUNCA remove?** → `CLASSIFIER.md` (PROTECTED_TAGS)
13. **O classifier pode tocar em `appointments`?** → `GATES.md` § G11 (não)
14. **Que side-effects o `intent` dispara?** → `CLASSIFIER.md` § Side-effects (NF, pagamento, judicialização, renovação, objeção)

## Auditores

15. **Quando A1 roda e qual seu critério de discordância?** → `AUDITORS.md` § A1 (cron 03h BRT, ≥7d parado, conf ≥0.75)
16. **A1 pode mover um card?** → `AUDITORS.md` (não)
17. **A2 reverte moves ruins?** → `AUDITORS.md` (não, só sinaliza com tag `post_move_warning`)
18. **Qual o modelo de A2 e por quê?** → `AUDITORS.md` (gpt-5-nano, mais barato)
19. **Que tag o A1 cria quando discorda?** → `AUDITORS.md` (`auditor_sugere_<canon_slug>`)

## Regras determinísticas

20. **Como o lead vira "Qualificação"?** → `DETERMINISTIC_RULES.md` (auto:secretary-replied, mensagem da secretária)
21. **O que acontece quando appointment vira `realizado` + `consulta`?** → `DETERMINISTIC_RULES.md` (move para Consulta finalizada + `status_consulta='realizada'`)
22. **Quantos tiers de inatividade existem?** → `DETERMINISTIC_RULES.md` (3: 24h, 3d, 7d → Nutrição)
23. **Lembretes vivem em código?** → `README.md` (não, em `/automations` UI)

## Lock manual e reator humano

24. **Qual a duração do lock manual?** → `HUMAN_REACTOR.md` (7d default, 90d em ciclo-concluído)
25. **Como o usuário remove o lock?** → `HUMAN_REACTOR.md` (chip "Destravar" no Kanban → `unlockLeadManually`)
26. **Quem aplica `precisa_atencao_humana` e quem remove?** → `HUMAN_REACTOR.md` (múltiplos aplicam; só humano remove)

## Banco

27. **Como o `pipeline_id` é mantido em sync com `stage_id`?** → `DATABASE_LIVE.md` (trigger `sync_lead_pipeline_id` deriva)
28. **Onde a idempotência de moves é gravada?** → `DATABASE_LIVE.md` + `EVENTS_TELEMETRY.md` (`lead_events.type='pipeline_move_attempted'`)
29. **Quais crons estão registrados?** → `DATABASE_LIVE.md` § crons + `TRIGGERS_AUDIT.md` (9 jobs do pipeline + 3 das automações da ferramenta)

## Operação

30. **Como reprocessar tudo do zero para a clínica?** → `DATABASE_LIVE.md` § `reset_ai_classifications(clinic_id)` + executor manual

---

## Roteiro sugerido para auditor externo

1. Ler `README.md` (5 min).
2. Ler `ARCHITECTURE.md` para ter o diagrama mental (5 min).
3. Ler `CLASSIFIER.md` integralmente (15 min) — é o componente com mais decisões.
4. Ler `AUDITORS.md` (5 min) — para entender o que checa o classifier.
5. Ler `GATES.md` (5 min) — para saber o que estrutura nunca deixa quebrar.
6. Ler `KNOWN_ISSUES.md` (5 min) — para não cair em armadilhas já conhecidas.
7. Rodar as queries de `EVENTS_TELEMETRY.md` para ver dados reais.
8. Responder às 30 perguntas acima sem voltar ao código.

Se conseguiu responder ≥27 das 30 só com a pasta `runtime/`, a documentação cumpriu o objetivo.
