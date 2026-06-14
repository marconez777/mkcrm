---
title: "Auditoria: Extractor + Pipeline (Clínica Ór)"
topic: ai
kind: roadmap
audience: agent
updated: 2026-06-14
summary: Auditoria profunda do agente extractor-tick e das regras de pipeline-field-rules, com avaliação lead-a-lead da clínica cf038458 (Ór Psiquiatria) em fases.
code_refs:
  - supabase/functions/extractor-tick/
  - supabase/functions/field-rules-tick/
related_docs:
  - docs/maps/AI_RUNTIME.md
  - docs/maps/KANBAN_LEADS.md
---

# Auditoria: Extractor + Pipeline (Clínica Ór Psiquiatria)

> Clínica alvo: `cf038458-457d-4c1a-9ac4-c88c3c8353a1`
> Período base das estatísticas: últimos 30 dias até **14/06/2026**.
> Auditoria conduzida em fases. Cada fase é appendada (não reescreve as anteriores).

---

## Fase 0 — Base: objetivo, prompt, regras, estatísticas

### 0.1 Objetivo do robô

Dois ticks cooperam pra "pilotar" o Kanban automaticamente:

1. **`extractor-tick`** (cron 10 min). Lê leads marcados `needs_ai_review=true`. Pega as últimas N mensagens, manda pra OpenAI (`gpt-5-nano` por padrão, BYOK) via tool-call estruturado, e escreve `custom_fields` do lead. Salva `lead_ai_extraction_runs` com confidence/erros/tokens.
2. **`field-rules-tick`** (cron 2 min). Lê `pipeline_field_rules` ativas. Pra cada lead recente (24h), avalia regras em ordem de prioridade e move o lead pra `target_stage_id` da primeira regra que casar. Loga em `lead_stage_history` (reason `field_rule:<nome>`) e `lead_events.type='stage_auto_moved'`.

Resultado: o Kanban é **derivado**. O extractor escreve campo, a regra move o card.

### 0.2 Prompt do extractor (transcrito + crítica)

Sistema (resumo, ver `supabase/functions/extractor-tick/index.ts:144-175`):

- 6 procedimentos válidos: cetamina, emt, primeira_consulta, retorno, seguimento, terapia.
- EMDR e "qualquer outro" → `qualificacao=desqualificado`.
- `pagamento_confirmado=true` **só** se atendente confirmou recebimento.
- Distinção `consulta` vs `procedimento`:
  - CONSULTA = primeira avaliação com o médico.
  - PROCEDIMENTO = sessão/aplicação (cetamina, infusão, EMT).
  - Se `custom_fields.procedimentos` já contém algo, default p/ novos agendamentos é PROCEDIMENTO.
- Data preenchida tem que ser HOJE ou FUTURO. ISO 8601. Hora default 12:00.
- "Se a conversa é administrativa/interna (clínica conversando com médico, fornecedor, secretária), retorne tudo null — não é lead."

**Lacunas confirmadas pela auditoria (detalhe na Fase 6):**

1. Enum `procedimento_interesse` está restrito a 6 valores, mas o select `interesse` da clínica tem 9 opções (faltam **Tratamento Alcoolismo**, **Hipnoterapia**, **EMDR**, **Tratamento para Depressão**, **Outro**). EMDR está como desqualificado, ok — mas alcoolismo/hipnoterapia/depressão são ofertas reais e a IA nunca as classifica.
2. Prompt **não recebe a data de hoje**. Modelo precisa inferir o "agora" — `gpt-5-nano` chuta mal em "amanhã 07:30".
3. Regra "conversa administrativa retorne tudo null" **não está sendo seguida** quando a contraparte é parceiro médico/secretária — vide Fase 1 (Sérgio, Elton, Innovatio, Ana Maisa, Ivan, Serene).
4. Modelo `gpt-5-nano` rejeita `temperature=0.1`. Código já tem retry, mas o request inicial gasta latência. Pior: em 30 dias, 24 runs falharam por isso porque a flag de retry não cobre todos os caminhos (`gpt-5*` regex já cobre — mas erros existem; investigar timing entre deploy do fix e os runs).
5. URLs assinadas de mídia expiram. Extractor de **vision** (kind=vision) tenta baixar e estoura — 36 erros/mês. `transcribe-audio` já tem `ensureFreshUrl()`; aplicar ao extractor.
6. `confidence` sensível (datas) tem threshold 0.8. Confiança média real é **0.69** → datas viram null em ~70% dos casos.
7. `userPrompt` envia `JSON.stringify(custom_fields)` cru. Modelo se confunde com aspas, brackets e campos sistemicos (`enviar_dia`, `link_consulta`).

### 0.3 Regras de pipeline ativas (7)

| Prio | Nome | Condição | Stage alvo |
|---:|---|---|---|
| 150 | Procedimento agendado | `procedimento_agendado_em` not_empty + is_future | Procedimento Agendado |
| 100 | Pagamento confirmado | `pagamento_confirmado=true` | Procedimento pago |
| 90 | Consulta agendada | `consulta_agendada_em` not_empty | Consulta Agendada |
| 80 | Tentou agendar consulta | `tentou_agendar=true` | Fechamento pendente consulta |
| 70 | Tentou pagamento | `tentou_pagamento=true` | Fechamento pendente procedimento |
| 60 | Lead desqualificado | `qualificacao=desqualificado` | Lead não qualificado |
| 50 | Interessado/negociação | `qualificacao in [interessado, em_negociacao]` | Qualificação |

**Stages-órfãos** (sem regra apontando): Contato inicial, Consulta finalizada, Retorno Tratamento Finalizado, Nutrição de Leads Inativos, Paciente antigo, reuniao agendada, Negou parceria, lead parou de responder, Antigo Consulta/proc agendado, Administrativo. Total: **10 stages 100% manuais**.

**Bug confirmado na regra "Consulta agendada"**: falta `is_future`. Datas passadas matcheiam e mandam o lead pra Consulta Agendada erradamente — depois alguém move manualmente, e a regra ainda pode trazer o lead de volta. Vide Harihadny e Silmara (Fase 1).

### 0.4 Estatísticas dos últimos 30 dias

- **68 runs** (`lead_ai_extraction_runs`):
  - 23 sucesso com campos preenchidos
  - 3 sucesso vazio (modelo respondeu mas não escreveu nada)
  - 24 erros (`temperature` 0.1 + texto)
  - 18 skipped (per_lead_daily_limit, manual_lock, etc.)
- **Erros (kind=vision/text) mais comuns:**
  - `Error while downloading https://…/storage/v1/object/sign/chat-attachments/…` — **36×** (URL assinada expirou)
  - `Unsupported value: 'temperature' does not support 0.1` — **24×** (modelo reasoning)
- **Confidence média (runs ok):** 0.674 — abaixo do threshold default (0.7) e muito abaixo do sensível (0.8).
- **Distribuição (top stages, 30d):** 655 Nutrição inativos, 545 Paciente antigo, 188 Não respondeu, 46 Administrativo, 25 Procedimento pago, 22 Qualificação, 18 Consulta Agendada, 17 Consulta finalizada, 14 Fechamento pendente consulta, 8 Procedimento Agendado.

### 0.5 Bugs concretos (referência rápida)

| # | Arquivo:linha | Bug | Impacto |
|---|---|---|---|
| B1 | `extractor-tick/index.ts:194-217` | Tenta `temperature=0.1` antes de retry sem temperature → +latência e contagem inflada de erros | Médio |
| B2 | `extractor-tick/index.ts:517-535` | Não chama `ensureFreshUrl()` antes de mandar URL de mídia pro modelo (caminho vision) | Alto (-35% erros) |
| B3 | `extractor-tick/index.ts:542` | `JSON.stringify(custom_fields)` cru no user prompt | Médio (-confiança) |
| B4 | `extractor-tick/index.ts:144-175` | Prompt não injeta `Hoje é {iso} ({fuso})` | Alto (datas relativas falham) |
| B5 | `extractor-tick/index.ts:64-72` | Enum `procedimento_interesse` sem alcoolismo/hipnoterapia/depressão/outro | Alto (categorização parcial) |
| B6 | `extractor-tick/index.ts:293` | Threshold sensível 0.8 com confiança média 0.67 | Alto (datas viradas null) |
| B7 | `field-rules-tick/index.ts:175-204` | `moved_by_agent_id` nunca preenchido | Métrica enviesada |
| B8 | DB | Regra "Consulta agendada" sem `is_future` | Falsos positivos |
| B9 | Prompt | Conversas administrativas (médico parceiro, secretária, dono) não detectadas | Crítico (entope Qualificação) |

---

## Fase 1 — Coluna "Qualificação" (22 leads)

**Definição:** lead respondendo, com interesse genuíno em algum procedimento da clínica, **ainda sem agendamento confirmado**. Não inclui parceiros, fornecedores ou conversas administrativas.

### Tabela-resumo

| # | Lead | Stage real (correto?) | Coluna esperada | Motivo |
|---:|---|:---:|---|---|
| 1 | Ateliê Patrícia Machado | ✅ | Qualificação | Pediu valor, "vai falar e retorna". Negociação ativa. |
| 2 | Helton Rene | ✅ | Qualificação | Pediu info de cetamina, conversa ainda nas primeiras trocas. |
| 3 | Beatriz Ortega | ✅ | Qualificação | Indicada por psicóloga, pediu info, atendente respondeu por áudio. |
| 4 | (sem nome — Carmem) | ❌ | **Fechamento pendente consulta** | Atendente já enviou dados de PIX (R$ 750,00), aguarda comprovante. IA não setou `tentou_pagamento`. |
| 5 | Gisele | ✅ | Qualificação | Pediu info de tratamento de bipolaridade. Negociação inicial. |
| 6 | 👧🏻♾️👶🏽 | ✅ | Qualificação | Primeira consulta, atendente está investigando o caso. |
| 7 | Clínica Innovatio Pamplona | ❌ | **Administrativo / Negou parceria** | Outra clínica oferecendo opção terapêutica. IA classificou interesse em "cetamina". |
| 8 | Elton Maniezzo | ❌ | **Administrativo** | Hospital encaminhando paciente Enzo Yugo ao Dr. Ivan. Não é lead. IA setou primeira_consulta. |
| 9 | Sergio Urquiza | ❌ | **Administrativo** | Médico psiquiatra falando sobre paciente Vitor de Andrade. Atendente já redirecionou pro Dr. Ivan. |
| 10 | Serene | ❌ | **Lead não qualificado** | Vendedora de "recepcionista IA". Spam. IA não rodou (sem custom_fields). |
| 11 | Priscila | ❌ | **Lead não qualificado** | Vendedora de água destilada (RVD Saúde). Wrong-number/spam. IA não rodou. |
| 12 | João Eduardo | ✅ | Qualificação | Negociação ativa: quer entender custo total do tratamento de fobia/TST. IA não rodou (erro temperature). |
| 13 | Harihadny Otero | ❌ | **Consulta finalizada** | Consulta foi 10/06 17:00 (já passou). Atendente enviou receitas. Ping-pongou entre Consulta Agendada e Qualificação. |
| 14 | Rubia Oliveira | ✅ | Qualificação | Pediu agendar, atendente fez triagem. Sem agendamento confirmado. IA sem campos. |
| 15 | Rosangela | ❌ | **Retorno Tratamento Finalizado** | Já fez Procedimento Pago (histórico). Conversa atual é pós-tratamento (atendente pediu avaliação no Google). IA falhou todas runs. |
| 16 | Laura | ❌ | **Procedimento Agendado** | Cliente confirmou "amanhã 12:00" pra cetamina. IA falhou todas runs (temperature). Conversa explícita. |
| 17 | Ednaldo | ❌ | **Procedimento Agendado** | Familiar pedindo Cetamina pra Xirlene, atendente confirmou "amanhã 11:50". IA falhou (temperature + vision). |
| 18 | Silmara Funi Gonzalez | ❌ | **Procedimento Agendado** | Cliente antiga pediu próxima infusão pra 25/06 11:30, atendente confirmou. IA escreveu `procedimentos` mas não `procedimento_agendado_em` (run falhou — temperature). |
| 19 | Mirela Cardoso | ❌ | **Procedimento Agendado** | Paciente antiga, receita validada, "já podemos agendar a sua infusão". IA falhou (temperature). |
| 20 | Psicologa Ana Maisa | ❌ | **Administrativo** | É a própria psicóloga da clínica (Dra Maisa) tratando da agenda de pacientes. IA marcou interesse em "terapia". |
| 21 | Leonardo/Ariane Pcte | ❌ | **Procedimento Agendado** | Parente pedindo Cetamina pra Ariane, atendente confirmou "amanhã 07:30". IA escreveu `consulta_agendada_em` em vez de `procedimento_agendado_em` — caiu na regra errada. |
| 22 | Ivan Barenboim | ❌ | **Administrativo** | É o **dono da clínica** (médico responsável). IA marcou interesse em EMT. |

### Taxa de acerto da Fase 1

- ✅ Corretos: **7/22 = 32%**
- ❌ Incorretos: **15/22 = 68%**

### Padrões de erro recorrentes (Fase 1)

| Código | Padrão | Quantos | Causa-raiz | Conserto |
|---|---|---:|---|---|
| P1 | **Conversa administrativa** (médico parceiro, secretária, dono, hospital encaminhando) classificada como lead interessado | 6 (Innovatio, Elton, Sérgio, Ana Maisa, Ivan, Serene parcial) | Prompt diz "retorne tudo null se administrativo" mas modelo não reconhece os sinais: clínica/hospital nas primeiras mensagens, papel profissional, encaminhamento. **B9** | Reforçar prompt com exemplos few-shot. Mover heurística pré-extractor: telefone fixo, palavras "clínica", "hospital", "consultora", "paciente …" como sujeito → marcar `pipeline=internal` antes de chamar IA. |
| P2 | **Cliente antigo pedindo nova sessão** classificado como `qualificacao=interessado` em vez de extrair `procedimento_agendado_em` | 4 (Silmara, Mirela, Ednaldo, Laura) | IA falhou run inteira por erro de temperature. Fallback ficou em Qualificação (regra prio 50). **B1+B4+B6** | Corrigir B1 (deploy do retry), B4 (data atual no prompt), baixar B6 pra 0.7. |
| P3 | **Agendamento de procedimento extraído como consulta_agendada_em** | 1 confirmado (Leonardo/Ariane) + provável em outros | Modelo confundiu "agendar cetamina" como tipo `consulta`. Mesmo com a regra de "default procedimento se já tem procedimentos no custom_fields", ele errou. | Reforçar regra no prompt + injetar `procedimentos atuais: Infusão de cetamina` em prosa (não JSON). |
| P4 | **Vendedor/spam** não classificado como desqualificado | 2 (Serene, Priscila) | Prompt só tem "EMDR" como exemplo. Não cita "wrong number", "vendedor", "fornecedor". | Adicionar categoria `desqualificacao_motivo=spam_vendedor`. |
| P5 | **Consulta passou mas lead segue em Consulta Agendada/Qualificação** | 1 (Harihadny) | Não há regra que dispare `Consulta Agendada → Consulta finalizada` pelo passar do tempo. | Criar regra prio 200 ou job separado: `consulta_agendada_em < now() - 1 dia AND stage=Consulta Agendada → Consulta finalizada`. |
| P6 | **Pós-tratamento** sem regra que detecte | 1 (Rosangela) | Idem P5: nenhum mecanismo move automaticamente. | Regra de tempo `last_inbound_at > X dias após Procedimento pago → Retorno Tratamento Finalizado`. |
| P7 | **`tentou_pagamento` perdido** quando atendente envia PIX mas lead ainda não respondeu | 1 (#4 Carmem) | Prompt define `tentou_pagamento` ambíguo. Atendente enviar dados ≠ lead tentou pagar. | Adicionar `aguardando_comprovante: boolean` no schema e regra prio 75: `aguardando_comprovante=true → Fechamento pendente consulta`. |

### Achados auxiliares

- **2/22 leads (Serene, Priscila, Rubia)** têm `custom_fields={}` — extractor nunca rodou neles. Possivelmente porque `needs_ai_review` nunca foi marcado, ou já estava lá quando os runs falharam. Auditar trigger que marca `needs_ai_review`.
- **Várias notas de histórico mostram ping-pong**: Silmara `Procedimento Agendado → Consulta Agendada → Qualificação` em 2 dias. Mirela mesma coisa. Causado pela regra **B8** (`Consulta agendada` sem `is_future`) e pela regra prio 50 que reverte quando IA escreve `qualificacao=interessado` mas as datas saem.
- **Nenhuma das 22 mudanças de stage tem `moved_by_agent_id` preenchido** (B7).

### Recomendações específicas da Fase 1 (em ordem de ROI)

1. **B9 — Detecção de conversa administrativa.** Corrige 6 dos 15 erros (40% da Fase 1).
2. **B1 + redeploy.** Corrige 4 erros (cliente antigo onde a IA falhou).
3. **B4 — Injetar data atual.** Habilita extração de "amanhã/segunda" → corrige Silmara/Ednaldo/Leonardo se combinado com B1.
4. **Nova regra "consulta passou → finalizada"** (P5). Corrige Harihadny e várias futuras.
5. **B8 — `is_future` na regra "Consulta agendada".** Para o ping-pong de Silmara/Mirela.

---

## Próximos passos

- Fase 2 (Consulta Agendada 18 + Procedimento Agendado 8 + reuniao agendada 7 = 33 leads).
- Fase 3 (fechamento + pago = 44 leads).
- Fase 4 (pós-atendimento = 39 leads).
- Fase 5 (resíduos + amostra de colunas-depósito = ~37 leads).
- Fase 6 (síntese: matriz, top-10 erros, mapeamento erro→fix).

Aguardando confirmação pra prosseguir.
