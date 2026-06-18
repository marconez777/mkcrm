---
title: "Pipeline — Cenários canônicos do estudo (v4.2)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-18
summary: "Catálogo de cenários reais das 441 conversas + cenários v4.1 (welcome, transição por resposta humana, paciente antigo agenda, reator humano, lead travado, B2B critérios) + cenários v4.2 (auditor de posição C21, verificador pós-move C22)."
related_docs:
  - docs/pipeline/STAGES.md
  - docs/pipeline/AUTOMATION_PLAN.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
  - docs/estudo-geral.md
---

# Cenários canônicos — extraídos do estudo (v4.2)

Cada cenário é uma situação que **acontece com frequência suficiente** para virar regra/automação. Detalhe completo nas pastas `docs/estudo/<coluna>.md`.

## Convenções

- **Sinal**: o que o sistema observa.
- **Ação manual hoje**: o que o atendente faz.
- **Ação automatizada futura**: regra/IA, com confiança mínima.
- **Stage destino**: ver `STAGES.md`.
- **Prio**: P0 (urgente, alto volume) → P3 (nice-to-have).

---

## C1. Novo lead chega no WhatsApp (v4.1)
- **Sinal**: número novo OU contato existente sem stage → criado em "Leads de entrada".
- **Hoje**: secretária responde manualmente, sem mensagem automática prévia.
- **Automação v4.1**:
  - `auto:novo-lead` (Fase 1, sem LLM): dispara welcome message via template configurável. Idempotente por `lead_events.type='welcome_sent'` (1x por `lead_id`, nunca repete em remarketing).
  - `auto:secretary-replied` (Fase 1, sem LLM): primeira `messages.direction='outbound' AND sender_type='human'` move card de "Leads de entrada" → "Qualificação". **Não conta auto-reply** (welcome message tem `sender_type='system'`).
- **Stage destino**: Leads de entrada → Qualificação. **Prio: P0**.

## C1b. Contato B2B / representante farmacêutico
- **Sinal**: 1ª mensagem menciona "amostra", "representante", "portfólio", "parceria", "laboratório", CNPJ, "comercial".
- **Hoje**: secretária identifica e descarta manualmente; muitos vazam (problema #1 do estudo; 260 leads B2B já marcados).
- **Automação**: Classifier Fase 2 → `auto:b2b-move` para `B2B/Stakeholders` com tag `b2b_auto` se confidence ≥ 0.85.
- **Stage destino**: B2B/Stakeholders. **Prio: P0**.

## C2. Crise de saúde mental / urgência
- **Sinal**: palavras-chave "ideação suicida", "não aguento mais", "morrer", "emergência", "crise" + contexto familiar.
- **Hoje**: atendente prioriza e oferece horário.
- **Automação**: Classifier → tag `urgencia_clinica` + notificação imediata para humano. **Não move stage automaticamente.** Trigger `tg_lead_risk_handler` já injeta `risco_clinico` — sempre MERGE, nunca SET.
- **Stage destino**: mantém + flag. **Prio: P0**.

## C3. Fluxo de reembolso (NF + relatório)
- **Sinal**: pós-consulta, paciente pede "nota fiscal", "recibo", "relatório para convênio", "reembolso".
- **Automação**: criar `lead_tasks` "Emitir NF/Relatório" `due_at=+24h úteis`. Registra `lead_events.type='nf_solicitada'`. Preenche `custom_fields.data_solicitacao_nf`.
- **Stage destino**: mantém. **Prio: P1**.

## C4. Pagamento (v4.1 — campo, não coluna)
- **Sinal**: webhook do provedor de pagamento (futuro), OU comprovante (imagem) + confirmação humana, OU mensagem texto.
- **Automação v4.1**:
  - Webhook real → seta `custom_fields.status_financeiro='pago'` automaticamente. **Stage não muda** (D1: pagamento é campo).
  - Comprovante (imagem detectada) + texto "paguei" → tag `pagamento_alegado` + task "Confirmar pagamento" + notifica humano. Humano seta `status_financeiro`.
  - Só texto "paguei" → tag `pagamento_alegado` + task. **Nunca** seta `status_financeiro` sozinho.
- **Stage destino**: nenhum (campo, não stage). **Prio: P1**.

## C5–C5c. Inatividade tiered (v4.1)

Substitui o `auto:inactivity-5d` único da v3 por **3 regras escalonadas** + transição final (D4).

| Cenário | Sinal | Ação |
|---|---|---|
| C5a `auto:followup-24h` | `last_message_at > 24h`, último msg é inbound, stage não-final, sem appointment futuro | Enviar template de follow-up #1. Registra `followup_sent` com `attempt=1`. **Não move stage.** |
| C5b `auto:followup-3d` | `last_message_at > 3d`, ainda inbound, já tem `followup_sent attempt=1` | Template #2. `attempt=2`. **Não move stage.** |
| C5c `auto:followup-7d→nutrição` | `last_message_at > 7d`, ainda inbound, já tem `attempt=2` | Move para `Sem resposta`. Se já estiver em `Sem resposta` (re-disparou) → move para `Nutrição inativa`. |

Exclusões aplicam-se a todas: stages finais (`Paciente antigo`, `Nutrição inativa`, `B2B`, `Desqualificado`) **e** leads com `appointments.scheduled_at > now()`.

**Prio: P0** (substitui o que era P0 na v3).

## C6. Reativação de lead inativo
- **Sinal**: lead em `Sem resposta` ou `Nutrição inativa` envia nova mensagem.
- **Automação**:
  - Tem tag `no_show` → mover para `Consulta agendada` + tag `reagendamento_solicitado` + task "Oferecer novo horário".
  - Tem tag `reagendamento_pendente` → idem.
  - Caso contrário → `Qualificação` + tag `reativacao`.
  - Se `manual_lock_until > now()` → **não mover**, só tag `reativacao_durante_lock` + notifica.
- **Stage destino**: variável. **Prio: P1**.

## C7. Aguardando decisão judicial / liminar
- **Sinal**: menção a "liminar", "processo", "ação contra o convênio", "advogado", "judicial".
- **Automação**: Classifier seta `custom_fields.possui_liminar_judicial=true` + tag `judicializacao` + task recorrente "Follow-up status liminar" a cada 15 dias. **Não move stage** — humano decide.
- **Stage destino**: nenhum. **Prio: P2**.

## C8. Paciente antigo pedindo renovação de receita
- **Sinal**: lead em `Paciente antigo` envia mensagem com "receita", "renovar", controlado.
- **Automação**: classifier **não roda em scans** aqui (final state); só em inbound. Cria task "Validar receita" ou "Agendar retorno" conforme intervalo desde último appointment.
- **Stage destino**: mantém (D3 — paciente antigo não sai). **Prio: P2**.

## C9. Lembretes de consulta e tratamento (v4.1 — D6)

**Lembretes não são regras `auto:*` codificadas.** São configurados na UI `/automations` (sistema já existente — `automations-tick` suporta `trigger_type='before_appointment'`).

Padrão de configuração recomendado:
- **1 automation por tipo de procedimento** (cetamina, EMT, hipnose, consulta psiquiatria, consulta terapia), filtrando por `stage_id` correspondente.
- **2 offsets por automation**: 24h antes (`offset_minutes=1440`) + 1h antes (`offset_minutes=60`).
- **Edge cases já cobertos pelo `automations-tick`**:
  - Agendamento criado <24h da consulta → o lembrete 24h é skip ("same_day_short_notice").
  - Agendamento criado <5h da consulta → ambos lembretes são skip.
  - Reagendamento (mudou `appointment_at`) → libera novo disparo (não cai no cooldown).

**Não documentar a lógica do lembrete aqui** — vive em `supabase/functions/automations-tick/index.ts` e é configurada por humano.

**Stage destino**: nenhum (não move). **Prio: configuração manual, sem código novo.**

## C10. Mistura de modalidade (presencial vs online)
- **Sinal**: `custom_fields.modalidade='online'` mas template tem `{{endereco}}`.
- **Automação**: `auto:modality-guard` valida pré-envio. Bloqueia template incompatível.
- **Stage destino**: nenhum. **Prio: P1**.

## C11. Fora de escopo
- **Sinal**: lead quer serviço que a clínica não oferece (não confundir com "sem dinheiro" ou "longe").
- **Automação**: classifier sugere `motivo_desqualificacao` do novo enum v4.1 (`servico_nao_oferecido | especialidade_nao_atendida | contato_por_engano | fora_da_regiao | demanda_incompativel | outro`). **Não move** — humano confirma.
- **Stage destino**: Desqualificado (manual). **Prio: P3**.

## C12. Objeção de preço aceitando reembolso
- **Sinal**: lead questiona valor, depois pergunta sobre NF/reembolso.
- **Automação**: sugerir resposta pronta no painel. Não envia.
- **Stage destino**: mantém. **Prio: P2**.

## C13. Pesquisa pós-consulta / pós-tratamento
- **Sinal**: `appointments.status` muda para `realizado`.
- **Automação**: ao entrar em `Consulta finalizada` (ou contar 1ª sessão em `Em tratamento`), enrollar lead em sequência via `stage_sequence_bindings`. NPS D+1, follow-up clínico D+7.
- **Stage destino**: nenhum (não move). **Prio: P2**.

## C14. Enrollment de sequência por entrada em stage
- **Mecanismo**: tabela `stage_sequence_bindings` mapeia `(pipeline_id, stage_id) → message_sequences.id`. Trigger em `lead_stage_history` enrolla automaticamente.
- **Casos iniciais**:
  - `Sem resposta` → sequência "Reativação 3-toques" (já coberta por C5a–c).
  - `Consulta finalizada` → "Pós-consulta NPS+follow-up".
  - `Tratamento agendado` (com `status_financeiro=pago`) → "Pré-procedimento" (D-2, D-1).
- **Prio: P2**.

## C15. Confirmação pré-criação de appointment pelo agente WhatsApp (v4.1)
- **Sinal**: agente WhatsApp coleta intent "agendar" + data + profissional + tipo.
- **Antes de criar `appointments`**, o agente envia mensagem-padrão:
  > "Só pra confirmar: você quer agendar consulta com Dr. Ivan no dia 20/06 às 14h, certo? Se você já tem outro compromisso marcado, ele será mantido."
- Só cria o registro após resposta positiva.
- **Escopo**: agente WhatsApp (auto-reply), **fora da Fase 1** deste plano. Documentado aqui para alinhar com gate G11.
- **Prio: P3** (depende do roadmap do agente WhatsApp).

## C16. Interesse duplo: consulta + tratamento (v4.1)
- **Sinal**: lead quer agendar consulta E tratamento ao mesmo tempo (cenário comum: "quero falar com Dr. Ivan e marcar a cetamina").
- **Schema**: dois campos multi-select independentes:
  - `interesse_consulta` (multi: `ivan | maisa`).
  - `interesse_tratamento` (multi: `cetamina | emt | hipnose | outro | nenhum`).
- Substitui o antigo `interesse_principal` (single-select).
- **Automação**: Classifier escreve ambos. Atendente pode preencher manualmente. Card pode ter qualquer combinação.
- **Stage destino**: nenhum (campos puros). **Prio: P1**.

## C17. Paciente antigo agenda novo compromisso (v4.1 — D3)
- **Sinal**: lead em `Paciente antigo` cria novo `appointment` (consulta ou tratamento).
- **Automação**:
  - `auto:appointment-agendado` checa stage atual. Se = `Paciente antigo`, **aborta movimentação**.
  - Anexa tag `consulta_agendada` ou `tratamento_em_andamento` conforme `kind`.
  - Calendário mostra o appointment normalmente.
  - Quando appointment for `realizado`/`faltou`/`cancelado`, regras `auto:appointment-*` continuam respeitando o guard (não movem).
- **Stage destino**: Paciente antigo (mantém). **Prio: P0** (cobre 13/14 do estudo).

## C18. B2B / Stakeholders — critérios objetivos (v4.1)
- **Quando colocar nesta coluna**:
  - Médico ou clínica parceira (CRM + identificação clínica).
  - Fornecedor / representante farmacêutico (palavras: "amostra", "portfólio", "comercial", "laboratório").
  - Parceiro de encaminhamento (envia pacientes pra cá ou recebe daqui).
  - Contato institucional (imprensa, evento, palestra, consultoria, advogado parceiro).
- **Quando NÃO colocar**:
  - Paciente que também trabalha em outra clínica → continua como paciente.
  - Familiar de paciente perguntando sobre tratamento → P2 (familiar fala pelo paciente), classifier preenche `nome_responsavel_financeiro`.
- **Automação**: entrada manual ou Classifier Fase 2 com confidence ≥0.85.
- **Stage destino**: B2B/Stakeholders (terminal, sem retorno). **Prio: P1**.

## C19. Reator de ação humana (v4.1 — D7)

Quando humano move card ou edita `status_consulta`/`status_financeiro`/`motivo_desqualificacao`, a IA respeita e tenta inferir a consequência. Tabela completa em `AUTOMATION_PLAN.md` seção "Reator humano". Exemplos práticos:

| Humano fez | IA infere |
|---|---|
| Moveu pra "Consulta agendada" sem haver `appointment` no banco | Cria task "Registrar dados do agendamento" + tag `aguardando_nova_data`. |
| Setou `status_consulta='cancelada'` no card | Limpa `appointment.scheduled_at` (do registro vinculado), move card pra "Qualificação", tag `reagendamento_pendente`. |
| Setou `status_consulta='faltou'` | Move pra "Sem resposta" + tag `no_show` + task D+1 "Oferecer reagendamento". |
| Moveu pra "Desqualificado" sem preencher motivo | Tag `precisa_atencao_humana` + task "Preencher motivo da desqualificação". |
| Moveu pra "B2B" um lead com appointment futuro | Tag `precisa_atencao_humana` + task "Confirmar reclassificação". |
| Qualquer movimento que IA não tem regra mapeada | Tag `precisa_atencao_humana`. |

**Stage destino**: variável. **Prio: P1**.

## C20. Lead travado — fila de revisão (v4.1 — D8)

A tag `precisa_atencao_humana` é o fallback universal de baixa confiança. Aplicada:
- Pelo Classifier quando `confidence < 0.6`.
- Pelo reator humano (C19) quando ação é ambígua.
- Por qualquer regra que não consiga decidir.

**Fluxo de revisão**:
1. View Kanban "Leads travados" (futura, fora desta rodada) filtra por essa tag.
2. Humano abre, analisa, decide stage + remove tag.
3. O caso vira material de retreino: anotar contexto no painel de avaliação do Classifier (`agent_evals`).
4. Quando o padrão for absorvido por nova regra, leads similares param de cair na fila.

**Métrica de saúde**: <5% dos leads ativos devem ter essa tag em regime estável. Volume alto = retreino necessário.

**Stage destino**: nenhum (mantém onde estava). **Prio: P0** (gate de segurança da IA).

---

## Padrões cross-coluna observados

| P | Padrão | Colunas afetadas | Implicação |
|---|---|---|---|
| P1 | **Confusão B2B vs paciente** | Leads de entrada, Qualificação | Classifier Fase 2; manter humano enquanto não estiver em prod. |
| P2 | **Familiar fala pelo paciente** | Qualificação, Consulta agendada, Tratamento agendado, Em tratamento, Paciente antigo, Sem resposta | Classifier escreve `custom_fields.nome_responsavel_financeiro`. Nunca renomeia `leads.name`. |
| P3 | **Modalidade inconsistente** | Consulta agendada, Tratamento agendado | `auto:modality-guard` pré-envio. |
| P4 | **Pagamento só no texto** | Tratamento agendado | Status financeiro é campo (D1); texto vira tag `pagamento_alegado`, nunca seta `status_financeiro`. |
| P5 | **Lembretes duplicados** | Consulta agendada, Tratamento agendado | Dedup por `lead_events` com `appointment_id` no `automations-tick`. |
| P6 | **Inatividade silenciosa** | Qualificação, Consulta finalizada | C5a–c tiered com exclusões. |
| P7 | **No-show vira "fui esquecido"** | Sem resposta | Reativação consciente de tag `no_show` (C6). |
| P8 | **Renovação de receita = novo episódio** | Paciente antigo | C8 só em inbound; humano decide (D3 mantém em Paciente antigo). |
| P9 | **Múltiplos compromissos simultâneos** | Paciente antigo, Em tratamento | `appointments` é 1-N por `lead_id`; card mostra próximo ativo + lista. |
| P10 | **Humano corrige IA** | Todos | Reator humano (C19) infere consequência ou trava com `precisa_atencao_humana`. |

---

## 11 situações que exigem humano (NÃO automatizar)

1. Crise/ideação suicida (C2) — só taggear + notificar.
2. Decisão final de desqualificação (C11) — só sugere.
3. Confirmação de pagamento sem webhook (C4) — só tag + task.
4. Mover lead com `manual_lock_until` ativo — bloqueio absoluto.
5. Resposta livre ao paciente (agente WhatsApp é separado).
6. Conclusão de ciclo de tratamento (Em tratamento → Paciente antigo).
7. Movimentação para `Desqualificado` ou `B2B` (terminais).
8. Renomear lead.
9. Sobrescrever `custom_fields` com valor humano-escrito <7d (G10).
10. Mover lead com appointment futuro por inatividade.
11. **Criar/alterar `appointments` por LLM** (G11 v4.1) — só humano ou webhook externo. Classifier só sugere via task + tag `agendamento_sugerido`.

---

## Erros do agente IA antigo (a NÃO repetir)

| E | Erro | Cenário | Mitigação v4.1 |
|---|---|---|---|
| E1 | Confundir B2B com paciente | C1b | Classifier Fase 2, confidence ≥ 0.85, tag `b2b_auto` para rollback. |
| E2 | Loop/spam de lembretes (5x) | C9 | `automations-tick` já trata dedup + cooldown por `appointment_at`. |
| E3 | Trocar nome do paciente | P2 | `custom_fields.nome_responsavel_financeiro`, nunca `leads.name`. |
| E4 | Endereço para consulta online | C10 | `auto:modality-guard`. |
| E5 | Mensagem motivacional fora de contexto | — | Sem trigger explícito = nenhum envio. |
| E6 | Mover lead que humano acabou de tocar | — | `manual_lock_until` 7d + renovação pelo reator (D7). |
| E7 | Sobrescrever tags do trigger de risco | C2 | MERGE sempre (G6, R1). |
| E8 | Mover para Desqualificado sem motivo | C11 | Trigger valida; classifier preenche junto. |
| E9 | Escrever `pipeline_id` direto | — | Trigger `sync_lead_pipeline_id` deriva. |
| E10 | Mover por texto "paguei" | C4 | Status financeiro é campo (D1), nunca movido por texto. |
| **E11** | **IA criou appointment fantasma** | — | **G11 v4.1**: classifier nunca escreve em `appointments`. Só sugere. |
| **E12** | **IA fez algo inesperado e ninguém viu** | — | **Reator humano (C19) + tag `precisa_atencao_humana` (C20)**: tudo que IA não tem certeza vira fila de revisão. |
| **E13** | **Lead entrou certo mas a conversa evoluiu e ninguém releu** | C21 | **A1 v4.2 — auditor de posição**: cron diário revisa leads parados ≥7d e tagga discordâncias. |
| **E14** | **Move automático ruim só é detectado quando humano percebe** | C22 | **A2 v4.2 — verificador pós-move**: segunda opinião barata em todo `auto:*` move, sinaliza warning sem reverter. |

---

## C21. Auditor de posição revisa lead parado (v4.2)
- **Sinal**: lead com `last_stage_change_at < now() - 7d`, stage não-final, sem appointment futuro, `qualificacao != 'desqualificado'`.
- **Hoje**: ninguém faz auditoria periódica; lead pode estar na coluna errada por dias.
- **Automação v4.2**: `pipeline-position-auditor` (cron 03:00 BRT, batch 50/dia) roda classifier "revisor". Se `suggested_stage != current_stage` e `confidence ≥ 0.75` → tags `precisa_atencao_humana` + `auditor_sugere_<stage>` + `lead_tasks` "Revisar posição".
- **Não move o card**. Só sinaliza para humano decidir. Idempotente por 14 dias.
- **Prio: P2**. Critério de entrada: Fase 2 estável ≥14d.

## C22. Verificador pós-move discorda de regra automática (v4.2)
- **Sinal**: regra `auto:*` acabou de mover card (ex.: `auto:b2b-move`, `auto:reactivation`).
- **Hoje**: erro de classificação só é detectado quando humano abre o card e desfaz; métrica reativa "% undo em 24h".
- **Automação v4.2**: hook async em `pipeline-move` chama `pipeline-post-move-verifier` (Flash-Lite) com `{from, to, source, last_5_events}`. Se "não faz sentido" + `confidence ≥ 0.8` → tags `precisa_atencao_humana` + `post_move_warning`.
- **Não reverte**. Só sinaliza. Toggle seletivo por regra em `app_settings.automation.post_move_verifier.rules_enabled`.
- **Prio: P2**. Critério de entrada: Fase 2 estável ≥14d.
