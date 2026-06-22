# Auditoria — Coluna "Qualificação" (Clínica ÓR)

A coluna **Leads de entrada** está vazia, então a primeira coluna com leads é **Qualificação** (44 leads). Vou auditar esses 44 contra a régua canônica do pipeline.

## Régua de referência (Qualificação)

Lead deveria estar em Qualificação se:
- `interesse_consulta = true` **OU** `interesse_tratamento = true` (ou ambos)
- **Não** é paciente antigo (`paciente_antigo` ≠ true)
- **Não** tem consulta agendada (`procedimento_agendado_em` / `consulta_agendada_em` vazio ou futuro confirmado pertence à próxima coluna)
- Conversa ativa nos últimos N dias (sem resposta > 3 dias → "Sem resposta"; > 14 dias inativo → "Nutrição Inativa")
- Não é B2B/stakeholder e não foi desqualificado

## Quatro dimensões da auditoria

### 1. Campos personalizados (`lead_custom_fields` da ÓR vs. `leads.custom_fields`)

Para cada lead em Qualificação, comparar o schema de campos personalizados configurado para a ÓR com o que está preenchido em `custom_fields`. Reportar:
- **Campos esperados mas vazios**: ex. `interesse_consulta`, `interesse_tratamento`, `tipo_contato`, `modalidade_preferida`, `nome_responsavel_financeiro` (se aplicável)
- **Causa provável** (por categoria):
  - classifier nunca rodou no lead (sem `last_classified_at`)
  - classifier rodou mas falhou (`pipeline_run_items.status='skipped'` com `agent_error`)
  - mensagem nunca trouxe sinal suficiente (heurística)
  - campo bloqueado por edição humana (`custom_fields_last_human_edit`)

Entregável: tabela `lead_id | nome | campos_faltando | causa_provavel`.

### 2. Chips / Tags

Para cada lead, comparar `leads.tags` com o esperado:
- **Auto-tags da etapa de entrada**: a stage Qualificação não define `auto_tag_on_enter`, mas leads herdam tags de etapas anteriores
- **Tags legadas que deveriam ter sido removidas**: ex. `paciente_antigo` (lead deveria estar na coluna Paciente antigo), `sem_resposta` (mas voltou a responder), `nutricao_inativa`, `consulta_finalizada_mes`, segmentos antigos
- **Tags faltando**: tag de segmento ativo para campanhas, tag de interesse

Entregável: tabela `lead_id | tags_atuais | tags_obsoletas | tags_faltando`.

### 3. Movimentação por regra (classifier / determinístico)

Para cada lead, verificar se o conteúdo da conversa indica que ele deveria estar em outra etapa:
- `interesse_consulta=false` e `interesse_tratamento=false` → deveria estar em Desqualificado
- `procedimento_agendado_em` preenchido com data futura → Consulta agendada
- Sinais de "já é paciente" na conversa → Paciente antigo
- Mensagens de B2B/parceria → B2B/Stakeholders

Checar também `pipeline_run_items` recente: erros, skip, último `result`. Cruzar com `lead_stage_history` para ver se houve tentativa de move bloqueada (`lock_auto_move`, `manual_lock_until`).

Entregável: tabela `lead_id | etapa_atual | etapa_correta | motivo | bloqueio_detectado`.

### 4. Movimentação por inatividade

Cruzar `last_message_at` e última mensagem **inbound** (`messages.from_me=false`) com regras de inatividade:
- Sem resposta do lead há > 3 dias → **Sem resposta**
- Sem resposta há > 14 dias → **Nutrição Inativa**
- Sem resposta há > 60 dias e paciente antigo → **Nutrição Antigos**

Para os que deveriam ter movido mas não moveram, investigar:
- `pipeline-deterministic` tick falhou na clínica?
- Lead tem `lock_auto_move` na stage atual? (a stage Qualificação tem `lock_auto_move=false`, então não é isso)
- `manual_lock_until` ativo?
- `is_internal_contact=true` (excluído da automação)?

Entregável: tabela `lead_id | dias_sem_resposta | etapa_destino | bloqueio`.

## Saída

Um relatório único em `dry-run-pr2/AUDIT_QUALIFICACAO.md` com as 4 tabelas e um resumo executivo no topo. **Nenhuma alteração de dados** — apenas leitura e relatório, igual ao PR2 da migração. Decisões de correção (mover leads, limpar tags, repreencher campos) ficam para PRs separados que você aprova depois.

## Detalhes técnicos

Consultas principais:
- `leads JOIN messages` agregando `MAX(timestamp) FILTER (WHERE from_me=false)` por lead
- `leads.custom_fields ?| array[<schema_keys>]` para detectar ausências
- `pipeline_run_items` filtrado por `lead_id IN (...)` e `step='classify'` ordenado por `created_at DESC`
- `lead_stage_history` últimos 30 dias para detectar tentativas de move

Tudo executado via `supabase--read_query` em batch único por dimensão.
