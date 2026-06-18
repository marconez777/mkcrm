## Plano v4.1 — Reconciliação dos docs com o brief da clínica

Escopo: **só docs em `docs/pipeline/`**. Nenhum código. Lembretes vão ser configurados depois direto na UI `/automations` (existente), não nos docs.

---

### 1. Decisões travadas

| # | Decisão | Impacto |
|---|---|---|
| D1 | "Procedimento pago" deixa de ser coluna. Vira campo `status_financeiro` (`pendente \| parcial \| pago \| reembolsado \| cancelado \| isento \| nao_se_aplica`). | Pipeline cai de 12 → **11 colunas**. v3 perde a regra `auto:procedimento-pago`. |
| D2 | "Procedimento agendado" → **"Tratamento agendado"**. "Procedimento" sai do vocabulário operacional. | Renomeia stage + todas referências. |
| D3 | Paciente antigo **não sai do stage** ao agendar nova consulta/tratamento. Controle por campos + tags + calendário. | `auto:appointment-agendado` ganha guard: se `current_stage = Paciente antigo`, não move, só anexa tag + campos. |
| D4 | "Sem resposta" e "Nutrição inativa" separadas com transição automática. 24h/3d/7d para follow-ups dentro de "Sem resposta"; após 7d → "Nutrição inativa". | Substitui `auto:inactivity` único da v3 por 3 regras escalonadas + 1 transição final. |
| D5 | Passou do horário → move **automático** para "Consulta finalizada" / mantém em "Em tratamento". Secretária reverte via `status_consulta` se necessário. | Auto-move por tempo + auto-correção por campo. |
| **D6** | **Lembretes configurados via UI `/automations` existente**, não codificados em regra `auto:*`. Cada consulta/tratamento ganha sua automação `before_appointment` configurada manualmente na interface (já suportado por `automations-tick`). | AUTOMATION_PLAN apenas **referencia** o sistema existente, sem reescrever lógica. Remove cenários C9 detalhados em código — viram nota "configurar em /automations". |
| **D7** | **Reator de ação humana**: quando humano move card ou edita `status_consulta`/`status_financeiro`, AI infere consequência determinística e ajusta o resto (limpar data se cancelou, mover pra Qualificação se reagendou, etc.). Se não souber inferir → trava com tag `precisa_atencao_humana`. | Nova seção "Reator humano" no AUTOMATION_PLAN com mapa de inferências. |
| **D8** | **Tag `precisa_atencao_humana`** ("lead travado") = fallback universal de baixa confiança. Aplicada por classifier quando confidence < threshold, por reator humano quando ação é ambígua, e por qualquer regra que não consiga decidir. Vira fila de retreino. | Documentada em CUSTOM_FIELDS_E_TAGS como tag de sistema. View dedicada no Kanban (futuro, fora desta rodada). |

---

### 2. Recomendações para os 13 pontos abertos do brief (item 18)

Decisões registradas direto nos docs:

- **Falta/cancelamento/reagendamento:** campo `status_consulta` no `appointments` + tags `no_show`, `reagendamento_pendente`. Reator humano (D7) reage à mudança de campo.
- **Entrada em "Em tratamento":** 1ª sessão `realizada` → move. Subsequentes incrementam `sessoes_realizadas`.
- **Saída de "Em tratamento":** humano marca `ciclo_concluido=true` → move para "Paciente antigo".
- **Múltiplos compromissos no mesmo card:** `appointments` é 1-N por `lead_id`. Card mostra próximo ativo + lista no detalhe.
- **Interesse duplo:** `interesse_consulta` (multi: `ivan|maisa`) + `interesse_tratamento` (multi: `cetamina|emt|hipnose|outro|nenhum`). Substitui `interesse_principal`.
- **Welcome message:** ação determinística da regra `auto:novo-lead` (Fase 1, sem LLM). Idempotente por `lead_events.type='welcome_sent'`.
- **Saída de "Leads de entrada" → "Qualificação":** primeira `messages.direction='outbound' AND sender_type='human'`. NÃO conta auto-reply. Regra `auto:secretary-replied`.
- **B2B/Stakeholders:** entrada manual ou classifier quando detecta intenção institucional. Critérios objetivos em SCENARIOS.md.
- **Desqualificado:** novo enum `motivo_desqualificacao`: `servico_nao_oferecido | especialidade_nao_atendida | contato_por_engano | fora_da_regiao | demanda_incompativel | outro`.
- **Guard IA contra sobrescrever appointments:** gate **G11** — classifier nunca cria/altera `appointments`. Só sugere via task + tag `agendamento_sugerido`.
- **Confirmação pré-criação:** cenário C15 do agente WhatsApp, fora do escopo da Fase 1.
- **Status financeiro x stage:** independentes. Regras de stage **nunca leem** `status_financeiro`.
- **Lembretes:** UI `/automations` (D6).

---

### 3. Reator de ação humana (D7) — mapa de inferências

Documentado no AUTOMATION_PLAN.md como tabela. Trigger: UPDATE em `leads.stage_id` por usuário humano (`source='manual'` em `lead_stage_history`) OU UPDATE em campos chave.

| Ação humana detectada | Inferência da IA |
|---|---|
| Moveu para "Sem resposta" | Pausa follow-ups automáticos por 24h (deixa humano gerenciar primeiro round). |
| Moveu para "Desqualificado" sem `motivo_desqualificacao` preenchido | Tag `precisa_atencao_humana` + task "Preencher motivo da desqualificação". |
| Setou `status_consulta='cancelada'` | Limpa `appointment.scheduled_at`, move card para "Qualificação", adiciona tag `reagendamento_pendente`. |
| Setou `status_consulta='reagendada'` sem nova data | Mantém em "Consulta agendada", tag `aguardando_nova_data`, task "Confirmar nova data". |
| Setou `status_consulta='faltou'` | Move para "Sem resposta" com tag `no_show`, task D+1 "Oferecer reagendamento". |
| Setou `status_financeiro='reembolsado'` em paciente em "Em tratamento" | Tag `precisa_atencao_humana` (ambíguo: cancelou tratamento? Trocou de modalidade?). |
| Moveu para "B2B" um lead que tem `appointment` futuro | Tag `precisa_atencao_humana` + task "Confirmar reclassificação como B2B". |
| Qualquer movimento humano com `manual_lock_until` ativo | Renova `manual_lock_until` por +7 dias. |
| Movimento humano que IA não tem regra mapeada | Tag `precisa_atencao_humana`. |

---

### 4. Mudanças por arquivo

**`docs/pipeline/STAGES.md`** (edit)
- Renomear "Procedimento agendado" → "Tratamento agendado".
- Remover "Procedimento pago" + nota de migração (leads → "Tratamento agendado" com `status_financeiro='pago'`).
- Atualizar fluxograma para 11 colunas.
- Critérios de entrada/saída de "Paciente antigo" com regra D3.

**`docs/pipeline/SCENARIOS.md`** (edit)
- C1: welcome + transição por resposta manual.
- C9 (lembretes): **substituir conteúdo detalhado por nota** apontando para `/automations` (D6). Documentar só o padrão de configuração (1 automation `before_appointment` por tipo de procedimento, offset 24h e 1h).
- Substituir cenário de inatividade único pela versão tiered (24h/3d/7d + nutrição).
- C15 (confirmação pré-agendamento, P3, fora da Fase 1).
- C16 (interesse duplo consulta+tratamento).
- C17 (paciente antigo agenda retorno sem mover stage).
- C18 (B2B/Stakeholder — critérios objetivos).
- **C19 (novo): Reator humano** — exemplos práticos de cada linha da tabela D7.
- **C20 (novo): Lead travado** — fluxo de revisão da fila `precisa_atencao_humana`.
- Atualizar enum em cenário de desqualificação.

**`docs/pipeline/DATABASE.md`** (edit)
- Campos novos em `lead_custom_fields`: `status_financeiro`, `status_consulta`, `interesse_consulta`, `interesse_tratamento`, `ciclo_concluido`, `sessoes_realizadas`.
- Remover `interesse_principal` da lista planejada.
- Novo enum `motivo_desqualificacao`.
- Relação `appointments (N) ←→ (1) leads` com regras de exibição.
- Documentar fonte de detecção de ação humana (`lead_stage_history.source IN ('manual','ui')`).

**`docs/pipeline/AUTOMATION_PLAN.md`** (edit, mais profundo)
- **Fase 1** (regras determinísticas):
  - Adicionar `auto:novo-lead` (welcome).
  - Adicionar `auto:secretary-replied` (move para Qualificação).
  - Substituir `auto:inactivity` por `auto:followup-24h`, `auto:followup-3d`, `auto:followup-7d→nutrição`.
  - Atualizar `auto:appointment-agendado` com guard D3.
  - **Remover** subseção de lembretes — apontar para `/automations` (D6).
  - **Remover** `auto:procedimento-pago` (stage não existe mais).
  - Adicionar `auto:ciclo-concluido`.
  - **Nova seção: "Reator humano"** com tabela D7.
- **Gates:** G11 (classifier nunca escreve em appointments).
- **Pendências resolvidas:** marcar as 13 perguntas como fechadas.
- **Decisões v4:** seção dedicada com D1–D8 e rastreabilidade.

**`docs/pipeline/CUSTOM_FIELDS_E_TAGS.md`** (edit)
- Grupo "Financeiro": `status_financeiro` com enum completo.
- Grupo "Status operacional": `status_consulta`, `ciclo_concluido`, `sessoes_realizadas`.
- Substituir `interesse_principal` por `interesse_consulta` + `interesse_tratamento`.
- Tags novas: `tratamento_em_andamento`, `agendamento_sugerido`, `welcome_sent`, `no_show`, `reagendamento_pendente`, `aguardando_nova_data`, **`precisa_atencao_humana`**.
- Seção dedicada "Tag de sistema: `precisa_atencao_humana`" explicando quem aplica, quando, e que vira fila de retreino do classifier.
- Atualizar enum `motivo_desqualificacao`.

**`docs/pipeline/LEAD_SAMPLES.md`** (edit)
- Reanalisar 5 leads/coluna no novo modelo (sem "Procedimento pago", com `status_financeiro`).
- Marcar contradições atuais como casos a migrar.

**`docs/pipeline/README.md`** (edit)
- Sumário v3 → v4.1.
- Tabela das 8 decisões + 13 recomendações.
- Atualizar lista de colunas (12 → 11) e fluxograma.
- Seção "Lembretes": apontar para `/automations`, não detalhar.

**`docs/README.md`** (edit)
- Atualizar referência ao número de stages.

**`docs/roadmap/DOCS_MAINTENANCE.md`** (consultar antes de salvar — exigência do mem://index.md). Atualizar progresso após salvar.

**Pós-edição obrigatório:** `node scripts/docs-sync.mjs` para regenerar `docs/INDEX.json`, `public/docs-*.json`, `DRIFT.md` e manifest da KB de suporte.

---

### 5. Fora desta rodada (próximos planos)

- Migration do banco (Fase 0 da implementação).
- Edge functions / triggers das regras de Fase 1.
- Reator humano em código (após docs aprovados).
- UI de `status_consulta`, `status_financeiro` nos cards.
- View Kanban "Leads travados" (lista filtrada por tag `precisa_atencao_humana`).
- Configuração manual das automações de lembrete em `/automations`.
- Migração dos 424 leads de "Nutrição inativa" e dos leads de "Procedimento pago".

---

### 6. Critério de pronto

- 8 arquivos atualizados, consistentes (sem "Procedimento pago" coluna, sem `interesse_principal`, sem lembretes detalhados em código, sem `auto:inactivity` único).
- Reator humano (D7) documentado com tabela de inferências.
- Tag `precisa_atencao_humana` documentada como fallback universal.
- `docs/INDEX.json` regenerado, `DRIFT.md` sem novos `code_refs` quebrados.
- D1–D8 rastreáveis no AUTOMATION_PLAN.md.
- Fase 0+1 implementável lendo só `docs/pipeline/`.
