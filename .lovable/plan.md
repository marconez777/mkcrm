## PR4 — Higiene de regras do pipeline ÓR

Consolida 4 decisões da auditoria de "Qualificação". Falhas do classifier ficam para PR separado (acordado).

### Escopo

1. **Canonizar "paciente antigo"** (resolve 15 leads parados em Qualificação).
2. **Auditar e desmarcar `is_internal_contact` indevido** (11 leads).
3. **Remover feature `manual_lock_until`** (10 leads travados).
4. **Remover campo `modalidade_preferida`** (não usado).

---

### 1. Campo canônico `eh_paciente_antigo` (booleano)

**Por que:** `tipo_contato` é string livre e não casa com regras determinísticas. Um booleano canônico evita ambiguidade e conflito entre classifier e humano.

- Adicionar definição em `lead_custom_fields` para a clínica ÓR: chave `eh_paciente_antigo`, tipo `boolean`, label "É paciente antigo?".
- Regra de derivação (executada pelo classifier e por job único de backfill):
  - `true` se qualquer um: `tipo_contato in ('paciente','paciente_antigo')` no `custom_fields_legacy`; tag legada `paciente_antigo`; `procedimento_pago_em` no passado; primeira mensagem > 60 dias atrás com histórico de atendimento.
  - `false` caso contrário; humano pode sobrescrever (registra `source=human`).
- `tipo_contato` continua existindo como descritivo, mas **não dispara movimentação**.
- Atualizar `pipeline-deterministic`: nova regra → `if eh_paciente_antigo=true and stage in ('Leads de entrada','Qualificação') → move para Paciente antigo`. Roda antes das regras de inatividade.
- Backfill: identificar os 15 leads em Qualificação com `tipo_contato=paciente*` no legacy, setar `eh_paciente_antigo=true`, mover para "Paciente antigo" registrando em `lead_stage_history` com `reason='backfill_pr4_canonical'`.

### 2. `is_internal_contact` — auditoria e correção

- Listar os 11 leads marcados, com nome/telefone/última mensagem.
- Classificar cada um em: (a) membro real da equipe/teste → mantém `true`; (b) paciente real marcado por engano → vira `false`.
- Critério de "real": telefone bate com `clinic_members` ou `attendants`, ou conversa contém apenas testes internos.
- Aplicar `UPDATE leads SET is_internal_contact=false WHERE id IN (...)` apenas para os reais.
- Registrar no relatório `dry-run-pr2/AUDIT_INTERNAL_CONTACT.md` antes do update (lista + decisão por lead).
- Após desmarcar, `pipeline-deterministic` passa a movê-los normalmente.

### 3. Remover `manual_lock_until`

**Estratégia conservadora** (1 release de transição):

- Limpar agora: `UPDATE leads SET manual_lock_until=NULL WHERE manual_lock_until > now()` (10 leads).
- Remover leitura da coluna em todas as funções/edge functions que consultam (auditar com grep: `pipeline-deterministic`, `pipeline-classifier`, hooks de pipeline).
- Remover UI que escreve nessa coluna (se existir em LeadDrawer/CustomFieldsPanel).
- **Manter a coluna no banco** este PR — não dropar ainda. Vira morta. PR seguinte (após confirmar que nada quebrou) faz `DROP COLUMN`.
- Substituto futuro (não neste PR): pausa por tag (`pausado_manual`) com TTL curto e motivo obrigatório.

### 4. Remover `modalidade_preferida`

- Remover a linha em `lead_custom_fields` para a clínica ÓR (`DELETE WHERE clinic_id=... AND key='modalidade_preferida'`).
- Limpar valores em `leads.custom_fields` (`UPDATE ... SET custom_fields = custom_fields - 'modalidade_preferida'`).
- Remover do prompt do classifier (se já existia) e da UI de CustomFieldsPanel se renderizar fixo.

---

### Detalhes técnicos

**Arquivos provavelmente tocados:**
- `supabase/functions/pipeline-deterministic/index.ts` — nova regra `eh_paciente_antigo`, remover leitura de `manual_lock_until`.
- `supabase/functions/pipeline-classifier/index.ts` — derivar `eh_paciente_antigo`, remover `modalidade_preferida` do schema/prompt.
- `src/components/inbox/CustomFieldsPanel.tsx` e `src/hooks/useCustomFieldDefs.ts` — se houver referência fixa a `modalidade_preferida` ou `manual_lock_until`.
- Migrations:
  - Insert em `lead_custom_fields` (def `eh_paciente_antigo`).
  - Delete em `lead_custom_fields` (def `modalidade_preferida`).
- Data ops (via insert tool, sem migration):
  - Update de `eh_paciente_antigo=true` nos 15 leads + move stage + lead_stage_history.
  - Update `is_internal_contact=false` nos leads identificados como reais.
  - Update `manual_lock_until=NULL` nos 10.
  - Update `custom_fields - 'modalidade_preferida'` nos leads ÓR.

**Ordem de execução:**

```text
1. Migration: add def eh_paciente_antigo, remove def modalidade_preferida
2. Edit pipeline-deterministic (nova regra + remove manual_lock_until)
3. Edit pipeline-classifier (deriva eh_paciente_antigo + remove modalidade_preferida)
4. Remove UI/escrita de manual_lock_until
5. Data ops:
   a) backfill eh_paciente_antigo + move 15 leads
   b) audit + update is_internal_contact
   c) clear manual_lock_until
   d) clear modalidade_preferida em leads.custom_fields
6. Relatório final em dry-run-pr2/AUDIT_QUALIFICACAO_AFTER.md (verifica coluna vazia/correta)
```

**Coluna `leads.manual_lock_until`:** mantida nesta release; dropar em PR posterior.

**Reversibilidade:** todos os UPDATEs registram `reason='pr4_*'` no histórico. Coluna manual_lock_until ainda existe se precisar reverter.

### Fora do escopo (próximos PRs)

- Falhas do classifier (timeout, schema, no_new_messages, heartbeat) — PR separado.
- Substituto do `manual_lock_until` (pausa por tag) — após confirmação de que a remoção não impactou.
- Tags vazias em 37 leads — PR de tags/segmentação.
- DROP COLUMN `manual_lock_until` — PR de cleanup posterior.
- Auditoria das próximas colunas do pipeline (Paciente antigo, Consulta agendada, etc).
