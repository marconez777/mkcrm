---
title: "Pipeline — Amostra real de leads por stage (v4.1)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Snapshot pseudonimizado de 5 leads por stage da Clínica ÓR no modelo v4.1 (11 colunas, sem 'Procedimento pago'). Casos a migrar marcados."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
---

# Amostra real de leads por stage (v4.1)

> **Pseudonimização**: nomes substituídos por `Lead <STAGE>-N`. Dados clínicos/psiquiátricos são PII sensível; nunca colar nomes reais aqui. Telefones/emails removidos.

## Volumetria geral (snapshot recente, ajustada para v4.1)

| Stage v4.1 | # leads atuais (aprox.) | Origem |
|---|---|---|
| Sem resposta | ~684 | base atual |
| Paciente antigo | ~457 | base atual |
| Nutrição inativa | ~424 | base atual |
| B2B / Stakeholders | 260 | base atual |
| Tratamento agendado | volume operacional | **inclui ex-"Procedimento pago"** (a migrar com `status_financeiro='pago'`) |
| Demais stages | volume menor | base atual |

**Implicação para automação:** 70%+ da base está em stages finais (Sem resposta + Paciente antigo + Nutrição). Scans temporais (`auto:followup-*`) **excluem** stages finais — processá-los queima custo.

## Amostra (5 leads por stage)

Template por linha: `# | pseudônimo | tags | custom_fields chave | last_message_at | sinais relevantes`.

> Conteúdo da amostra real é gerado por script `scripts/sample-leads.ts` (a criar na Fase 0). Aqui ficam observações qualitativas da inspeção do estudo + casos de migração v3→v4.1.

### Leads de entrada
- Maioria sem tags, sem custom_fields. Mistura B2B + paciente + spam.
- **v4.1**: passa a receber `welcome_sent` automaticamente via `auto:novo-lead`. Saída desencadeada por `auto:secretary-replied`.
- Sinal forte para Classifier Fase 2: 1ª mensagem decide.

### Qualificação
- Variedade alta. Alguns com `modalidade` preenchido, outros não.
- Padrão P2 (familiar fala pelo paciente) aparece em ~1 a cada 4 leads → preencher `nome_responsavel_financeiro`.
- **v4.1**: `interesse_consulta` + `interesse_tratamento` substituem `interesse_principal`. Migration deve mapear valores antigos.

### Consulta agendada
- Tem `appointments` ativo na maioria. Idade do appointment varia (até +30d).
- Caso de borda: lead "agendou e sumiu" — sem mensagens há 3+ dias mas com appointment futuro. **Não pode** ser movido por inactivity (exclusão explícita).
- **v4.1**: `status_consulta` agora aceita `reagendada` (novo valor de enum).

### Consulta finalizada
- Maioria aguardando decisão sobre tratamento (Cetamina/EMT) ou NF.
- Casos de C3 (pedido de NF) recorrentes.
- **v4.1**: `status_financeiro` desacopla pagamento da etapa (ex.: consulta realizada com pagamento pendente — antes ficava em limbo).

### Tratamento agendado (renomeada D2)
- Leads com `interesse_tratamento` preenchido.
- **v4.1**: também contém os leads migrados da antiga "Procedimento pago" — agora com `status_financeiro='pago'`. **Caso a migrar**: rodar UPDATE do `STAGES.md` Migration na Fase 0.

### Em tratamento
- Múltiplas sessões. Necessidade do contador `sessoes_realizadas` (criar na Fase 0.5).
- **v4.1**: saída controlada por `ciclo_concluido` (humano marca) → `auto:ciclo-concluido`.

### Paciente antigo (~457)
- **Final state** — não roda em scans.
- Inbound aciona C8 (renovação de receita) via classifier.
- **v4.1 (D3)**: novos agendamentos **não movem o card daqui**. Em vez disso anexam tags `consulta_agendada` ou `tratamento_em_andamento`. Casos atuais que estão em "Paciente antigo" e têm appointment futuro são exatamente o cenário C17 e devem ter as tags aplicadas na Fase 0.

### Sem resposta (~684)
- **Maior bucket**. Inbound aciona `auto:reactivation` (C6).
- Vários leads com tag `no_show` (vindos de futuro `auto:appointment-faltou`).
- **v4.1**: entrada agora via `auto:followup-7d-nutricao` (tiered) em vez de regra única de 5d.

### Nutrição inativa (~424)
- **Final state**. Inbound aciona reativação.
- Casos C7 (judicial) concentrados aqui.
- **v4.1**: entrada via 2ª passada de `auto:followup-7d-nutricao` (lead que já estava em Sem resposta e segue inativo).

### B2B / Stakeholders (260)
- **Final state, terminal.**
- Golden set para validar `auto:b2b-move` (Fase 2): aceite ≥90% precisão antes de ligar.
- Critérios objetivos: ver C18 em `SCENARIOS.md`.

### Desqualificado / Fora de escopo
- **Final state, terminal.**
- Sempre acompanhado de `motivo_desqualificacao`.
- **v4.1**: enum reescrito (`servico_nao_oferecido | especialidade_nao_atendida | contato_por_engano | fora_da_regiao | demanda_incompativel | outro`). Migration mapeia valores antigos.

## Casos de migração v3 → v4.1 (a tratar na Fase 0)

| Caso | Volume | Ação |
|---|---|---|
| Leads em "Procedimento pago" | ~ (verificar com query abaixo) | Move para "Tratamento agendado" + seta `status_financeiro='pago'`. |
| Leads em "Paciente antigo" com appointment futuro | ~ (verificar) | Anexar tag `consulta_agendada` ou `tratamento_em_andamento` conforme `kind`. |
| Leads com `interesse_principal` setado | (todos com este custom_field) | Migrar para `interesse_consulta` ou `interesse_tratamento` conforme valor. |
| Leads em "Desqualificado" com `motivo_desqualificacao` antigo | (todos com este custom_field) | Mapear para enum v4.1. |

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

Para auditar casos a migrar:

```sql
-- Quantos leads em "Procedimento pago"?
SELECT count(*) FROM leads l
 JOIN pipeline_stages s ON s.id = l.stage_id
 WHERE s.name = 'Procedimento pago'
   AND s.pipeline_id = '17c27f4d-8256-4ea7-b5b9-ed706494f686';

-- Quantos em "Paciente antigo" com appointment futuro?
SELECT count(DISTINCT l.id) FROM leads l
 JOIN pipeline_stages s ON s.id = l.stage_id
 JOIN appointments a ON a.lead_id = l.id
 WHERE s.name = 'Paciente antigo'
   AND a.status = 'agendado'
   AND a.scheduled_at > now();
```

Roda em SQL editor com role autenticada na clínica ÓR. **Não colar resultado bruto neste arquivo** — pseudonimizar antes.
