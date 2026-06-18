
# Roadmap de implementação completo — pipeline v4.2

Esta é a **trilha mestre**: 6 marcos sequenciais, cada um aprovado separadamente. Você só vai precisar dizer "vai" para um marco por vez. Nenhum marco depende de você programar nada — apenas observar e dizer se está ok antes do próximo.

**Princípio guia**: tudo nasce desligado (toggles `off`). Cada regra é ligada manualmente depois de 48h–14d de observação. Em qualquer momento dá pra desligar tudo sem perder dados.

---

## Marco 0 — Infra (1 dia) — **começamos por aqui**

Sem LLM. Sem mexer no fluxo atual. Só prepara o terreno.

### O que entra no banco (migration única)
1. **Renomear** stage `Procedimento agendado` → `Tratamento agendado` (D2).
2. **Eliminar** stage `Procedimento pago`: leads dela vão pra `Tratamento agendado` com `custom_fields.status_financeiro='pago'` preservado (D1).
3. **Novas colunas em `leads`**:
   - `last_processed_message_id_classifier uuid` (a partir de qual mensagem o classifier ainda não leu)
   - `last_processed_message_id_summarizer uuid` (idem para o summarizer)
4. **Tabela nova `stage_sequence_bindings`**: liga stages a sequências de mensagens (usada lá na Fase 4 para C13/C14; criada agora porque é barato).
5. **~25 toggles** em `app_settings`, todos `enabled=false` por default:
   - `automation.novo_lead.enabled`
   - `automation.secretary_replied.enabled`
   - `automation.appointment_agendado.enabled` (+4 do motor de appointments)
   - `automation.followup_24h.enabled` / `.followup_3d.enabled` / `.followup_7d.enabled`
   - `automation.reactivation.enabled`
   - `automation.modality_guard.enabled`
   - `automation.ciclo_concluido.enabled`
   - `automation.human_reactor.enabled`
   - `automation.classifier.enabled` / `.classifier.history_tool_enabled`
   - `automation.b2b_move.enabled` / `.urgency_flag.enabled` / `.field_patch.enabled` / `.tags_merge.enabled` / `.agendamento_sugerido.enabled`
   - `automation.summarizer.enabled` / `.nf_task.enabled` / `.payment_confirmed.enabled`
   - `automation.position_auditor.enabled` / `.position_auditor.batch_size=50`
   - `automation.post_move_verifier.enabled` / `.post_move_verifier.rules_enabled=[]`

### O que entra no código
6. **Helper compartilhado** `supabase/functions/_shared/pipeline-move.ts`:
   - Função única que TODA regra futura usa para mover card.
   - Aplica gates G1 (lock manual), G2 (lock de stage), G3 (toggle), G4 (idempotência via `lead_events`), G5 (preenche `source`), G8 (nunca tocar `pipeline_id`), e guard D3 (paciente antigo não sai do stage).
   - Retorna `{moved, reason}`. Se não moveu, explica por quê.

7. **Página `/admin/pipeline-automations`** (read-only):
   - Lista de todas as regras com toggle on/off (botão desligado nesta fase — só leitura).
   - Métricas placeholder (vão se preencher quando regras rodarem).
   - Aba "Leads travados" preparada (vazia agora).

### O que você vê depois do Marco 0
- Pipeline com 11 colunas (uma a menos: `Procedimento pago` sumiu).
- "Procedimento agendado" agora se chama "Tratamento agendado".
- Nada mais mudou no comportamento. Equipe continua mexendo manualmente.
- Página nova em `/admin/pipeline-automations` (vazia, normal).

**Risco**: baixo. Migration reversível por rollback de stage rename. Leads não somem.

---

## Marco 0.5 — Custom fields + tags (½ dia)

Migration adicional, sem código novo.

- **12 campos novos** em `lead_custom_fields` (catálogo + validações enum):
  - `status_financeiro` (pendente/parcial/pago/reembolsado/cancelado/isento/n/a)
  - `status_consulta` (realizada/faltou/cancelada/reagendada)
  - `interesse_consulta` (multi: ivan/maisa/ambos)
  - `interesse_tratamento` (multi: cetamina/emt/hipnose/outro/nenhum)
  - `ciclo_concluido` (bool)
  - `sessoes_realizadas` (int)
  - `nome_responsavel_financeiro` (text)
  - `possui_liminar_judicial` (bool)
  - `saldo_sessoes_pacote` (int)
  - `pagamento_alegado_em` (timestamptz)
  - `data_solicitacao_nf` (timestamptz)
  - `modalidade_preferida` (presencial/online)
  - `motivo_cancelamento` (text)
- **Enum reescrito** `motivo_desqualificacao`: `servico_nao_oferecido | especialidade_nao_atendida | contato_por_engano | fora_da_regiao | demanda_incompativel | outro`.
- **Whitelist de tags v4.2** registrada (inclui `precisa_atencao_humana`, `auditor_sugere_*`, `post_move_warning`).
- Trigger `trg_validate_lead_custom_fields_enums` atualizada.

### O que você vê
- No card de qualquer lead, os campos novos aparecem editáveis.
- Equipe já pode começar a preencher `status_financeiro`, `interesse_consulta` etc. Vai virar combustível para a IA depois.

**Risco**: muito baixo. Só adiciona campos opcionais.

---

## Marco 1 — Regras determinísticas (1 semana de implementação + 1 semana ligando uma por vez)

Tudo sem LLM. Cada regra é uma edge function + trigger.

### 1.1 — Welcome + transição
- `auto:novo-lead`: número novo entra → envia template welcome (1x por lead).
- `auto:secretary-replied`: primeira resposta humana → move "Leads de entrada" → "Qualificação".

### 1.2 — Motor de appointments (5 regras, 1 trigger)
- `appointments.status` muda → `pipeline-appointment-sync` lê e move card de acordo:
  - `agendado` → "Consulta agendada" ou "Tratamento agendado" (respeitando D3).
  - `realizado` (consulta) → "Consulta finalizada".
  - `realizado` (procedimento) → "Em tratamento" na 1ª sessão; senão só incrementa `sessoes_realizadas`.
  - `faltou` → "Sem resposta" + tag `no_show` + task reagendar.
  - `cancelado` → "Qualificação" + tag `reagendamento_pendente` + task.

### 1.3 — Inatividade tiered (3 regras)
- Cron horário verifica leads sem resposta. 24h → template #1. 3d → template #2. 7d → move "Sem resposta" (ou "Nutrição inativa" se já estiver em "Sem resposta").

### 1.4 — Reativação
- Lead em "Sem resposta"/"Nutrição inativa" que volta a falar → "Qualificação" (ou "Consulta agendada" se tinha `no_show`).

### 1.5 — Outras
- `auto:modality-guard`: bloqueia template com `{{endereco}}` se modalidade é online.
- `auto:ciclo-concluido`: humano marca ciclo concluído → "Em tratamento" → "Paciente antigo".

### 1.6 — Lembretes
- **Nada de código novo** (D6). Equipe configura na UI `/automations` que já existe: 1 automação por procedimento, offsets 24h e 1h.

### 1.7 — Reator humano (D7) — **liga por último**
- Trigger em `lead_stage_history` quando humano move → `pipeline-human-reactor` infere consequência (ex.: humano marca `status_consulta='cancelada'` → cancela appointment → dispara cascata).
- Casos ambíguos → tag `precisa_atencao_humana`.

### Rollout do Marco 1
- Construo as 12 regras todas com toggle `off`.
- Ligamos **uma de cada vez** com janela de 48h de observação.
- Ordem sugerida: 1.1 → 1.2 → 1.5 → 1.3 → 1.4 → 1.7.
- A cada uma você vê na página `/admin/pipeline-automations`: "X leads tocados, Y% desfeitos por humano". Se >5% desfeito, desligamos e ajustamos.

### O que você vê
- Cards começam a se mover sozinhos quando a equipe muda `appointments.status` ou cliente responde.
- Welcome message dispara em todo lead novo.
- Inatividade encaminha pra "Sem resposta" sem ninguém precisar mexer.

**Risco**: baixo (toggles + idempotência). O reator humano é o mais sensível — sai por último.

---

## Marco 2 — Classifier LLM (2 semanas)

Adiciona inteligência sobre conversas.

- Edge function `pipeline-classify` roda a cada mensagem inbound (debounce 5s).
- Saída estruturada (Zod): `intent`, `tags_to_add`, `custom_fields_patch`, `urgency`, `suggested_stage_id`, `confidence`, `reasoning`.
- Confiança <0.6 → tag `precisa_atencao_humana` automática.
- **A3 (v4.2)**: classifier ganha a tool `get_lead_history` para buscar mensagens antigas quando o resumo não basta.
- Validação golden: 260 leads B2B existentes → exigir ≥90% precisão antes de ligar `auto:b2b-move`.

### Regras que consomem o classifier
- `auto:b2b-move`, `auto:urgency-flag`, `auto:field-patch`, `auto:tags-merge`, `auto:agendamento-sugerido` (este só cria task — G11 proíbe LLM criar appointment).

### O que você vê
- Cards de B2B vão automaticamente pra coluna B2B.
- Campos `interesse_consulta`, `interesse_tratamento`, `nome_responsavel_financeiro` se preenchem sozinhos.
- Urgências aparecem flagadas em tempo real.
- Painel `/admin/pipeline-automations` mostra custo estimado em R$ e volume de `precisa_atencao_humana` (= leads onde a IA não teve certeza).

**Risco**: médio. Por isso golden set primeiro + toggles separados por regra.

---

## Marco 2.5 — Agentes auditores (1 semana, depois de 14d de Marco 2 estável)

- **A1 `pipeline-position-auditor`**: cron diário 03:00 BRT, lê 50 leads parados ≥7d, classifier "revisor" sugere se mudaria a posição. Discordância → tag + task. Não move.
- **A2 `pipeline-post-move-verifier`**: depois de todo move `auto:*`, segunda opinião barata. Discordância → tag `post_move_warning`. Não reverte.
- Custo combinado: ~R$ 4/mês. Toggles separados — pode ligar A1 sem A2.

### O que você vê
- Tag "Leads travados" começa a aparecer com discordâncias.
- Aba `/admin/pipeline-automations` ganha 3 linhas novas (A1, A2, A3).

**Risco**: muito baixo (só sinalizam, nunca movem).

---

## Marco 3 — Summarizer + tarefas (1 semana)

- `pipeline-summarize` atualiza `ai_summary` (≤800 chars) de forma incremental.
- `auto:nf-task`: detectou pedido de NF → cria task automática "Emitir NF" com prazo +1 dia útil.
- `auto:payment-confirmed`: webhook de pagamento real → seta `status_financeiro='pago'`. **Não move stage** (D1).

### O que você vê
- Card mostra resumo curto da conversa no topo.
- Tarefas de NF aparecem na fila sem ninguém criar à mão.
- Pagamentos confirmados via gateway atualizam o campo financeiro automaticamente.

**Risco**: baixo. Summarizer é incremental e barato.

---

## Marco 4 — Retenção e nutrição (depois de 30d com tudo estável)

- `auto:judicializacao` (detecta liminar/processo → tag + alert).
- `auto:renovacao-receita` (só inbound de paciente antigo pedindo receita).
- `auto:objection-suggest` (sugere resposta para objeção; equipe decide enviar).
- View **"Leads travados"** no Kanban (filtro por `precisa_atencao_humana`) — fila oficial de retreino.
- Bindings `stage_sequence_bindings` ativos para C13/C14 (sequências pós-consulta).
- Avaliação offline contínua com `agent_evals`.

**Risco**: baixo. Tudo opcional, tudo opt-in.

---

## Tabela-resumo de prazos

| Marco | Esforço meu | Janela de observação | Quando você vê valor |
|---|---|---|---|
| 0 — Infra | 1 dia | — | Imediato (pipeline limpo) |
| 0.5 — Campos | ½ dia | — | Imediato (campos novos no card) |
| 1 — Regras | 1 sem + 1 sem rollout | 48h por regra | 1ª regra ligada (48h depois do build) |
| 2 — Classifier | 2 sem | 14d antes de Marco 2.5 | B2B automático, campos preenchidos |
| 2.5 — Auditores | 1 sem | 30d | Fila de leads travados útil |
| 3 — Summarizer | 1 sem | — | Resumo + tarefas automáticas |
| 4 — Retenção | 1 sem | contínuo | Cobertura completa |

**Total ~6 semanas de implementação + janelas de observação.**

## Como vamos operar a partir de agora

1. Eu construo o **Marco 0** (migration + helper + página) assim que você aprovar este roadmap.
2. Você abre o Kanban e confere se os leads ainda estão lá, se a coluna nova ("Tratamento agendado") existe e se "Procedimento pago" sumiu.
3. Diz "ok" → vou pro Marco 0.5.
4. Repete o ciclo. Cada marco fica isolado: se algo der errado, desligamos toggles ou damos rollback sem impactar os outros.

## O que NÃO está neste plano (intencional)

- Migrar dados históricos dos 424 leads existentes para os novos campos (vira um marco separado se você quiser; hoje os campos ficam vazios e a equipe preenche conforme o lead aparece).
- Refazer a UI do Kanban (continua igual; só ganha colunas atualizadas).
- Trocar o agente de WhatsApp / auto-reply (continua independente).
- Build de RAG com embeddings (não é necessário para a v4.2).

## Primeira ação concreta

Se você aprovar este roadmap, **eu já abro a migration do Marco 0** na sequência. Ela aparece como uma caixa pra você confirmar — vai mostrar exatamente quais comandos SQL vão rodar (rename de stage, drop de "Procedimento pago", criação dos toggles). Você confirma uma vez e está feito.
