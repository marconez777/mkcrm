---
title: "Pipeline — Amostra real de leads por stage"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Snapshot pseudonimizado de 5 leads por stage da Clínica ÓR. Usar para validar regras de automação contra dados reais antes de ligar em prod."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
---

# Amostra real de leads por stage

> **Pseudonimização**: nomes substituídos por `Lead <STAGE>-N`. Dados clínicos/psiquiátricos são PII sensível; nunca colar nomes reais nesta doc. Telefones/emails removidos.

## Volumetria geral (snapshot recente)

| Stage | # leads atuais |
|---|---|
| Sem resposta | ~684 |
| Paciente antigo | ~457 |
| Nutrição inativa | (alto) |
| B2B / Stakeholders | 260 |
| Demais stages | volume operacional menor |

**Implicação para automação:** 70%+ da base está em stages finais (Sem resposta + Paciente antigo). Por isso scans temporais (`auto:inactivity-5d`) **excluem** stages finais — processá-los queima custo sem retorno.

## Amostra (5 leads por stage)

Template por linha: `# | pseudônimo | tags | custom_fields chave | last_message_at | sinais relevantes`.

> Conteúdo da amostra real é gerado por script `scripts/sample-leads.ts` (a criar na Fase 0). Aqui ficam apenas observações qualitativas extraídas da inspeção feita durante o estudo.

### Leads de entrada
- Maioria sem tags, sem custom_fields preenchidos. Mistura B2B + paciente + spam.
- Sinal forte para Classifier Fase 2: 1ª mensagem é o que decide.

### Qualificação
- Variedade alta. Alguns com `custom_fields.modalidade` preenchido, outros não.
- Padrão P2 (familiar fala pelo paciente) aparece em ~1 a cada 4 leads.

### Consulta agendada
- Tem `appointments` ativo na maioria. Idade do appointment varia (do dia atual até +30d).
- Caso de borda: lead "agendou e sumiu" — sem mensagens há 3+ dias mas com appointment futuro. **Não pode** ser movido por inactivity (regra R7 do AUTOMATION_PLAN).

### Consulta finalizada
- Maioria aguardando decisão sobre tratamento (Cetamina/EMT) ou NF.
- Casos de C3 (pedido de NF) recorrentes.

### Procedimento agendado
- Leads com `custom_fields.procedimento_interesse` preenchido.
- C4 (pagamento) é o próximo movimento esperado.

### Procedimento pago
- Pequeno volume. **Stage com `lock_auto_move=true` na v3.**
- Movimento de entrada exige sinal real de pagamento.

### Em tratamento
- Múltiplas sessões. Necessidade do contador `custom_fields.sessoes_realizadas` (a criar na Fase 0.5).

### Paciente antigo (~457)
- **Final state** — não roda em scans.
- Inbound aqui aciona C8 (renovação de receita) via classifier.

### Sem resposta (~684)
- **Maior bucket** da base. Inbound aqui aciona `auto:reactivation` (C6).
- Vários leads com tag `no_show` (vindos de `auto:appointment-faltou` futuro).

### Nutrição inativa
- **Final state**. Inbound aciona reativação.
- Casos C7 (judicial) concentrados aqui.

### B2B / Stakeholders (260)
- **Final state, terminal.** Não retorna ao funil clínico.
- Golden set para validar `auto:b2b-move` (Fase 2): aceite ≥90% de precisão antes de ligar.

### Desqualificado / Fora de escopo
- **Final state, terminal.**
- Sempre acompanhado de `custom_fields.motivo_desqualificacao` (trigger valida).

## Como reproduzir a amostra

```sql
WITH stages AS (
  SELECT id, name FROM pipeline_stages
  WHERE pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686'
)
SELECT s.name, l.id, l.tags, l.custom_fields, l.last_message_at, l.stage_changed_at
FROM stages s
JOIN LATERAL (
  SELECT * FROM leads
  WHERE stage_id = s.id AND archived_at IS NULL
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 5
) l ON true
ORDER BY s.name;
```

Roda em SQL editor com role autenticada na clínica ÓR. **Não colar resultado bruto neste arquivo** — pseudonimizar antes.
