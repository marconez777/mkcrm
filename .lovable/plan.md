# Plano — Novos achados no AUDIT_EXTRACTOR_PIPELINE

Apenas atualização de documentação. Sem mudanças de código nesta etapa.

## Arquivos a editar
- `docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md` — anexar seção "Fase 7 — Achados de campo (vocabulário + regra de qualificação)"
- `docs/DRIFT.md` — registrar atualização
- `docs/INDEX.json` + `public/docs-content.json` + `public/docs-index.json` — via `scripts/docs-sync.mjs`

## Conteúdo a adicionar

### B29 — Ambiguidade do termo "sessão"
**Sintoma:** "sessão com Dr. Maísa" = terapia; "sessão" sozinho pode ser infusão de cetamina **ou** terapia.
**Regra:** extractor não pode mapear `sessão → procedimento` sem desambiguar.
**Fix:**
- Adicionar ao prompt do extractor regra: quando aparecer "sessão", investigar contexto (profissional citado, modalidade, mensagens anteriores) antes de classificar.
- Mapa de profissional → modalidade:
  - Dr. Maísa → terapia (psicóloga)
  - Dr. Ivan → consulta psiquiátrica
  - Sem profissional + menção a "cetamina"/"infusão" → sessão de cetamina
  - Sem profissional + menção a "EMT"/"estimulação" → sessão de EMT
- Se ambíguo após investigação: marcar `tipo_procedimento=indefinido` e disparar handoff humano (não chutar).

### B30 — Taxonomia de agendamentos incompleta
**Sintoma:** pipeline trata tudo como "consulta", mas existem 4 tipos distintos com fluxos diferentes:
1. Consulta com psiquiatra (Dr. Ivan)
2. Consulta com terapeuta/psicóloga (Dr. Maísa)
3. Sessão/tratamento de EMT
4. Sessão/tratamento de cetamina
**Fix:**
- Adicionar campo `tipo_atendimento` em `custom_fields` com enum: `consulta_psiquiatria | consulta_terapia | sessao_emt | sessao_cetamina`.
- Extractor obrigado a preencher antes de mover para "Consulta Agendada".
- Stage "Procedimento pago" (B15) passa a exigir `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}` — consulta normal não vai para essa coluna.
- Métricas em `MetricsOps` segmentadas por tipo.

### B31 — Qualificação prematura por resposta automática
**Sintoma:** Print (Letícia, 558698049388): lead enviou 1 mensagem inicial, recebeu **resposta automática fora-de-horário**, e foi movida para "Qualificação". Não houve contato humano nem IA — só auto-reply.
**Regra correta:** lead só vai para "Qualificação" após **primeira interação real** (humano OU agente IA com resposta gerada por LLM). Auto-reply de fora-de-horário **não conta**.
**Fix:**
- Marcar mensagens de auto-reply com flag `messages.is_auto_reply=true` (ou usar `kind='auto_reply'`).
- Trigger/regra do extractor: ignorar `is_auto_reply=true` ao decidir mover para Qualificação.
- Condição de entrada em "Qualificação": existe pelo menos 1 mensagem outbound onde `is_auto_reply=false` E (`sent_by_user_id IS NOT NULL` OR `sent_by_agent_id IS NOT NULL`).
- Backfill: query para identificar leads atualmente em "Qualificação" cuja única outbound é auto-reply → mover de volta para "Contato inicial" ou "Novo lead".

## Não incluído nesta etapa
- Implementação SQL/código (criação de coluna `is_auto_reply`, ajustes no extractor, migrations).
- Decisão sobre nome final do enum `tipo_atendimento` (ficará para refinamento na implementação).
