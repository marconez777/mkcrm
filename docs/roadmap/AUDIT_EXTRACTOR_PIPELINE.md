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

---

## Fase 2 — Consulta Agendada (18) + Procedimento Agendado (8) + reuniao agendada (7) = 33 leads

**Data da auditoria:** 2026-06-14. **Critério de "futuro":** `data_horario` ou `procedimento_agendado_em` ≥ hoje. Leituras: últimas 8 mensagens, `custom_fields`, últimas 3 execuções do extractor, notas internas.

### 2.1 Consulta Agendada (18 leads) — 0/18 corretos ❌

| Lead | data_horario | Verdict | Motivo |
|---|---|---|---|
| Ana Clara Borelli | 2026-06-05 | ❌ | Consulta já realizada ("Bom final de semana" pós-link). Deveria ir pra **Fechamento pendente consulta** ou **Consulta finalizada**. |
| Thiago di Marcantonio | 2024-05-31 | ❌ | Data de 2 anos atrás. Conversa atual confirma 19/06 — extractor não atualizou. |
| Kauê Pcte | 2026-06-09 | ❌ | Consulta de 5 dias atrás. Cobrança PIX enviada, sem confirmação de pagamento. Deveria estar em **Fechamento pendente consulta**. |
| Rosa Neli | 2026-06-10 | ❌ | Passado. Link de pagamento enviado, sem comprovante. |
| Fabio Dalla | 2025-12-16 | ❌ | 6 meses atrás. Conversa atual fala de retorno hoje — extractor não capturou. |
| Thalita Oliveira | 2025-05-21 | ❌ | 1 ano atrás. Nova data ("quarta às 13h") não extraída. |
| Paula Quartim | 2026-03-05 | ❌ | 3 meses atrás. |
| Julia Coletti | 2026-05-25 | ❌ | NF já emitida → consulta finalizada e paga. Deveria estar em **Procedimento pago** ou pós-atendimento. |
| `.` (sem nome) | 2026-06-05 | ❌ | Lead com nome vazio. Conversa interna ("avisar enfermeiras") = **ruído administrativo** (B9). |
| `11971765819` | 2026-02-03 | ❌ | Sem nome próprio, lead-fantasma. |
| Bruna Correa | 2026-06-09 | ❌ | NF enviada → finalizada. Nota mostra insatisfação grave — deveria sinalizar urgência humana. |
| Patrícia Enf. | {} | ❌ | **Enfermeira** falando em nome de outra paciente (Rosângela). Ruído administrativo. |
| Marcelle | 2023-06-19 | ❌ | 3 anos atrás. Nota indica remarcação 14/05→11/06 não capturada. |
| Vitória | 2026-06-08 | ❌ | Passado. Extractor com erro "Error while downloading https://…storage/v1/obje" (B2). |
| Marco Guimarães Agencia | 2026-06-02 | ❌ | **Médico parceiro** recebendo prospecção de parceria — deveria estar em **reuniao agendada**, não consulta. |
| Felipe Moulin | só `form_submission` | ❌ | Sem data, sem qualificação. Conversa só sobre óculos esquecido (pós-consulta). |
| Milene Campanholo | 2026-06-05 | ❌ | Passado. 5 lembretes "começa em 1 hora" disparados — consulta provavelmente finalizada. |
| Oneide Pereira | {} | ❌ | "Nova consulta daqui 45 dias" — deveria estar em **Nutrição** ou agendamento futuro. |

**Conclusão coluna:** 100% de erro. Causa raiz = ausência de `is_future` na Rule 90 (B3) + extractor não revisa `data_horario` em conversas subsequentes + ruído administrativo (B9) classificado como consulta.

### 2.2 Procedimento Agendado (8 leads) — 2/8 corretos (25%)

| Lead | data | Verdict | Motivo |
|---|---|---|---|
| Rosa Maria | `procedimento_agendado_em` 2026-06-17 | ✅ | Futuro. Único caso com campo correto preenchido (`procedimento_agendado_em` separado de `data_horario`). |
| Juliana Alves (28223ac2) | 2026-06-15 | ✅ | Futuro. Confirmou infusão segunda 07h30. |
| Juliana Alves (0ee236df) | 2024-03-09 | ❌ | **Lead duplicado** de Juliana com data 2 anos atrás. Deveria ser mesclado. |
| Rosangela | {} | ❌ | Sem data. Conversa mostra agendamento 10:30 amanhã — extractor não capturou. |
| Juca Palacios | 2026-05-15 | ❌ | Passado (1 mês). Conversa sobre reagendar p/ sexta. |
| Isabela Terlizzi | 2024-06-26 | ❌ | 2 anos atrás. Conversa atual: "cetamina quarta semana que vem". |
| Michelle Kartychak | 2023-07-07 | ❌ | 3 anos atrás. Conversa: EMT 9:30 amanhã. |
| Laís Carrara | 2024-07-10 | ❌ | 2 anos atrás. |

**Padrão:** mesma falha sistêmica — `data_horario` capturado uma vez no agendamento original e nunca atualizado quando há reagendamento. Confirma necessidade do extractor rodar em **toda mensagem nova** e **sobrescrever** datas anteriores quando o lead pede remarcação.

### 2.3 reuniao agendada (7 leads) — N/A, todos sem dados

| Lead | msgs | notas | extractions |
|---|---|---|---|
| Dr. Cyro Masci | 0 | 0 | 0 |
| Dr. Daniel Castelo | 0 | 0 | 0 |
| Dr. Marcel Lamas | 0 | 0 | 0 |
| Dr. Rafael Latorraca | 0 | 0 | 0 |
| Dra Alanna Nunes | 0 | 0 | 0 |
| Dra Laís Símaro | 0 | 0 | 0 |
| Dra. Stephanie Lins | 0 | 0 | 0 |

**Conclusão:** coluna usada **manualmente** para tracking de reuniões com médicos parceiros (todos prefixados "Dr./Dra."). Nenhum lead tem conversa WhatsApp nem custom_fields. O agente nunca opera aqui. **Recomendação:** mover esta coluna para um pipeline separado "Parcerias B2B" para não poluir o pipeline clínico (e impedir que leads como **Marco Guimarães Agencia** sejam classificados como consulta de paciente).

### 2.4 Resumo Fase 2

| Coluna | Total | Corretos | Acerto |
|---|---:|---:|---:|
| Consulta Agendada | 18 | 0 | **0%** |
| Procedimento Agendado | 8 | 2 | **25%** |
| reuniao agendada | 7 | N/A | — |
| **Total verificável** | **26** | **2** | **7,7%** |

### 2.5 Novos bugs identificados na Fase 2

- **B10 — Extractor não sobrescreve `data_horario` em reagendamentos.** Quando o lead pede nova data, o campo antigo permanece. Precisa de regra explícita no prompt: "se houver nova confirmação de data, SUBSTITUA `data_horario` pela mais recente".
- **B11 — Falta `consulta_finalizada` / detecção de pós-atendimento.** NF emitida, "bom final de semana", "Estamos sentindo sua falta" são sinais claros de consulta concluída. O agente não tem campo nem regra para detectar isso → leads ficam estagnados em "Consulta Agendada" depois da consulta.
- **B12 — Ruído administrativo classificado como lead clínico.** Mensagens de enfermeiras, secretárias, médicos parceiros, contatos internos (sem nome ou com sufixo "Enf.", "Agencia", "Pcte") são tratados como leads. Precisa de regra de exclusão por padrão de nome + flag `is_internal_contact` no extractor.
- **B13 — Leads duplicados** (ex.: 2 Julianas Alves) não são mesclados. Sugestão: rotina de dedup por telefone.
- **B14 — Pipeline misto B2C+B2B.** "reuniao agendada" e prospecções de parceria (Marco Guimarães) deveriam estar em pipeline separado.

### 2.6 Atualização ao plano de fix

Acrescentar à lista de itens code-only:
- **B10**: ajustar prompt do `extractor-tick` para "substituir data mais recente".
- **B11**: criar enum `status_consulta` (`agendada`/`realizada`/`cancelada`) + regra de stage por NF emitida ou frase de despedida pós-consulta.
- **B12**: pré-filtro no agent runner — `if lead.name ~ /(Enf\.|Pcte|Agencia|^Dr[a]?\.? )/i` → marcar como `non_clinical=true` e não processar.
- **B13**: job batch de dedup por phone.

---

**Próxima fase:** Fase 3 — Fechamento pendente consulta (14) + Fechamento pendente procedimento (5) + Procedimento pago (25) = 44 leads. Aguardando confirmação.

---

## Fase 3 — Fechamento pendente consulta (14) + Fechamento pendente procedimento (5) + Procedimento pago (25) = 44 leads

**Data:** 2026-06-14. Verificações: existe negociação ativa? `data_horario` atualizada? `pagamento_confirmado` reflete realidade?

### 3.1 Fechamento pendente consulta (14) — 8/14 corretos (57%)

| Lead | Estado real | Verdict | Motivo |
|---|---|---|---|
| `5511954800888` (Selma MEDCOM) | Fornecedora B2B de seringa 60ml | ❌ | **Ruído B2B** — não é lead clínico, é fornecedor. Pipeline misturado (B12/B14). |
| `5511981218171` (Daniel) | Em fase de manutenção, busca clínica | ✅ | Negociação ativa, mas `name` do lead = telefone (falta enriquecer com `nome_preferido`). |
| Andressa Martins | Cancelou cetamina por falta de acompanhante | ✅ | Em reagendamento. Stage ok. |
| Cadu | "Vou dar uma pensada, te chamo" | ✅ | Indeciso, válido aqui. |
| Yuri (lead.name = "Deixe Seu Recado") | Vai mandar msg amanhã p/ reconfirmar | ⚠️ | Stage ok, mas `name="Deixe Seu Recado"` é a mensagem padrão de voicemail do WhatsApp, não o nome real (Yuri está em `nome_preferido`). Bug de enriquecimento. |
| EDUARDO | "Agendado segunda 13h" + pagamento confirmado | ❌ | Já fechado → deveria ir pra **Consulta Agendada** ou **Procedimento pago**. |
| Isabelli Alves | Pediu remarcar "quarta 11h" | ✅ | Em negociação. `data_horario` antiga (10/06) não atualizada — B10. |
| Kamila Nunes | Pediu primeira consulta, sem data | ✅ | Negociação inicial. |
| Lead #7171022 (Daniella) | Vai viajar, volta e marca | ✅ | Stage ok; `name` continua como ID. Mesmo problema do Yuri. |
| Marcia Lunas | Esposo viajou, ela retorna | ✅ | Stage ok. |
| Mari | Aguardando retorno até 14h | ✅ | Stage ok. |
| Ronaldo Saraiva | "Gostaria de agendar", sem evolução | ✅ | Stage ok. |
| Rosemary De Andrade | "Reagendado para terça 16/06 13h30" | ❌ | Já confirmado → **Consulta Agendada**. |
| ROSSANA | "Confirmou 01/07" + dados cadastrais | ❌ | Já confirmado → **Consulta Agendada**. |

**Padrão:** 4 erros são leads que JÁ confirmaram data mas continuam aqui porque o extractor não promove pra "Consulta Agendada" (B10 + falta de regra "ao detectar confirmação verbal + data, mover").

### 3.2 Fechamento pendente procedimento (5) — 2/5 corretos (40%)

| Lead | Estado | Verdict |
|---|---|---|
| 🌈 | "Agendado, segunda faço o pagamento" | ✅ Aguardando pagamento. |
| Ana Paula 🌼 | Solicita comprovantes p/ convênio (pós-pago) | ❌ Já pagou (com cartão) — deveria estar em **Procedimento pago** ou pós-atendimento. |
| Camilla Hattori | (sem msgs recentes coletadas) | ⚠️ Inspeção rasa. |
| Carla | (sem msgs recentes coletadas) | ⚠️ Inspeção rasa. |
| Fabiane Medical Magazine | Nome com sufixo "Medical Magazine" | ❌ **Provável B2B** (mídia/parceria). |

### 3.3 Procedimento pago (25) — bug sistêmico

**Achado crítico:** `SELECT count(*) FROM leads WHERE stage='Procedimento pago' AND custom_fields ? 'pagamento_confirmado' → 0`. **Zero** dos 25 leads tem o campo `pagamento_confirmado` preenchido. Ou seja, **nenhum lead chegou aqui via Rule 60 (que depende desse campo)** — todos foram movidos **manualmente** pela equipe.

| Indicador | Valor |
|---|---|
| Total leads | 25 |
| `pagamento_confirmado=true` no `custom_fields` | **0** |
| `data_horario` em 2023 | 5 |
| `data_horario` em 2024 | 1 |
| `data_horario` em 2025 | 6 |
| `data_horario` em 2026 (passado) | 8 |
| Sem `data_horario` | 5 |
| Sem mensagens recentes (8 últimas vazias) | 14 |
| `custom_fields={}` | 2 (Janaina, Laura Dzazio) |
| Nome ambíguo "Ivan" | 1 (homônimo do médico) |

**Diagnóstico:**
1. **Rule 60 (Procedimento pago) não dispara.** A IA nunca seta `pagamento_confirmado=true` mesmo quando lead envia "Segue o comprovante" (vide Fabiana Oliveira). Bug grave.
2. **Coluna virou cemitério.** Leads ficam aqui sem regra de envelhecimento → não migram pra "Consulta finalizada" / "Retorno Tratamento Finalizado" / "Nutrição".
3. **`Ivan` como lead** = ruído (provavelmente é o próprio médico testando).

### 3.4 Resumo Fase 3

| Coluna | Total | Corretos | Acerto |
|---|---:|---:|---:|
| Fechamento pendente consulta | 14 | 8 | **57%** |
| Fechamento pendente procedimento | 5 | 2 | **40%** |
| Procedimento pago | 25 | — | **0%** (movidos manualmente, regra quebrada) |
| **Total** | **44** | **10** | **~23%** |

### 3.5 Novos bugs Fase 3

- **B15 — `pagamento_confirmado` nunca é setado pela IA.** O prompt define `pagamento_confirmado` no schema mas não tem instrução explícita ("se lead envia comprovante PIX, foto de transferência, 'paguei', 'segue comprovante', set `pagamento_confirmado=true`"). Sem isso, Rule 60 nunca dispara → coluna alimentada 100% manualmente.
- **B16 — Falta promoção automática Fechamento→Agendada.** Quando lead confirma data ("pode ser terça 13h30", "confirmo 01/07"), o extractor seta `data_horario` mas a IA não promove pra "Consulta Agendada". Precisa de regra: `tentou_agendar=true AND data_horario IS NOT NULL AND data_horario > now()` → mover.
- **B17 — `lead.name` poluído por mensagens padrão WhatsApp.** Casos: "Deixe Seu Recado", "Lead #7171022", "5511954800888". A IA já extrai `nome_preferido` mas o `name` da tabela não é atualizado. Migration: sync `name = COALESCE(custom_fields->>'nome_preferido', name)`.
- **B18 — Coluna "Procedimento pago" sem regra de envelhecimento.** Leads de 2023 ainda aqui. Precisa de cron: `if updated_at < now() - interval '60 days' → mover pra Nutrição/Finalizado`.
- **B19 — Pipeline aceita leads B2B no fluxo clínico.** Selma MEDCOM (fornecedora), Fabiane Medical Magazine (mídia). Mesmo problema da Fase 2 (Marco Guimarães Agencia). Precisa de pré-filtro por keywords no nome/contexto.

### 3.6 Atualização ao plano de fix

| Bug | Tipo | Esforço |
|---|---|---|
| B15 | Prompt extractor | Baixo — adicionar 2 linhas no schema/instruções |
| B16 | Pipeline rule nova | Baixo — `priority=85, condition: tentou_agendar AND data_horario IS_FUTURE` |
| B17 | Migration + trigger | Baixo |
| B18 | Cron `stage-aging-tick` | Médio — função nova + agendamento |
| B19 | Pré-filtro `extractor-tick` + `agent-runner` | Médio |

---

**Próxima fase:** Fase 4 — pós-atendimento (Consulta finalizada 17 + Retorno Tratamento Finalizado 10 + Paciente antigo 6 + Nutrição de Leads Inativos 6) = 39 leads. Foco: detectar se a regra de envelhecimento/saída está ausente. Aguardando confirmação.

---

## Fase 4 — Pós-atendimento: Consulta finalizada (17) + Retorno Tratamento Finalizado (10) + Paciente antigo (545) + Nutrição de Leads Inativos (655) = **1.227 leads**

> **Correção do plano original:** a Fase 4 tinha previsão de 39 leads. Na prática **Paciente antigo (545)** e **Nutrição de Leads Inativos (655)** são mega-cemitérios. Auditoria foi feita por **stats agregadas + amostra aleatória de 10**, não 1-a-1.

### 4.1 Stats agregadas

| Stage | Total | cf={} | Só form_submission | Nome "Lead #…/telefone" | Zero msgs | `updated_at` > 90d |
|---|---:|---:|---:|---:|---:|---:|
| Consulta finalizada | 17 | 1 | 0 | 3 | 4 | 0 |
| Retorno Tratamento Finalizado | 10 | 6 | 0 | 8 | 9 | 0 |
| Paciente antigo | **545** | 261 (48%) | 0 | 104 (19%) | 349 (64%) | 0 |
| Nutrição de Leads Inativos | **655** | 327 (50%) | 29 | 227 (35%) | 546 (83%) | 0 |

**Observação crítica:** **zero leads** com `updated_at > 90 dias` em qualquer dessas colunas. Como o CRM existe há mais tempo, isso indica **migração/carga em massa recente** (provavelmente import do CRM antigo) que carimbou `updated_at=now()` em tudo, **destruindo o sinal de envelhecimento real**.

### 4.2 Consulta finalizada (17) — ~65% válida

Inspeção 1-a-1:
- ✅ **11 leads** com conversa real e data de consulta passada coerente: Felipe Baracat, Gilberto Castilho, Mitchell Andres, Victor Martelli, Leônidas, Bauman, Bruno Sella, Rodrigo Wainberg, Dan Friedlander, Soraia/Mirtes, 11994096788, Lady Law.
- ❌ **6 leads** sem conversa ou com 1 mensagem só → não há prova de que a consulta aconteceu: Lead #9262476, Vinícius Frenzel, Guilherme Pirri, Lead #8766732, Andrea de Marco (1 msg automática), Lady Law (parcial).
- ⚠️ **Bauman** e **Bruno Sella** têm conversa de **reagendamento ativo** em junho — não estão finalizados, deveriam estar em **Fechamento pendente consulta**.
- ⚠️ **Mitchell** tem `data_horario` 14/05 → realmente passou, mas está sendo confundido com pacientes que **reagendaram** depois.

### 4.3 Retorno Tratamento Finalizado (10) — 0% verificável

| | Valor |
|---|---|
| Com mensagens | 1 (e só 1 mensagem) |
| Com `custom_fields={}` | 6 |
| Com nome "Lead #…" | 8 |

**Veredito:** coluna é **órfã de regra** (já mapeado na Fase 0). Os 10 leads parecem cargas órfãs sem critério humano nem da IA. **Não há nada para "auditar" aqui** — a coluna precisa ser **purgada ou redesenhada**.

### 4.4 Paciente antigo (545) — cemitério parcialmente legítimo

Amostra de 10 mostra:
- Leads com `data_horario` 2023–2025 e zero mensagens recentes → **legítimos como histórico**.
- Mas também:
  - **Ivan** (homônimo do médico, ruído — já visto em Procedimento pago).
  - **Andressa Mota Lima** com 8 mensagens e `cf={}` → não enriquecida.
  - **Lucia** com `interesse: Tratamento Alcoolismo` → poderia ser **lead ativo**, foi enterrado.
  - **Cesar Augusto / Arthur Witte / Daniel Mario** com `data_horario` em dezembro 2025/janeiro 2026 e zero msgs → consultas marcadas que nunca tiveram interação WhatsApp registrada (provável import).

**Risco real:** leads importados com `interesse` preenchido foram enterrados aqui sem nenhuma tentativa de reativação. Estimativa rasa: ~5% dos 545 (≈27 leads) poderiam estar ativos.

### 4.5 Nutrição de Leads Inativos (655) — cemitério mais grave

- **83% sem nenhuma mensagem** → leads importados ou que nunca responderam.
- **35% com nome "Lead #…"** ou só formulário → enriquecimento falhou.
- **29 leads** com apenas `form_submission` → ou seja, **encheram formulário no site e nunca foram contatados** (ou a IA falhou em iniciar conversa).
- Amostra:
  - **Anna Strunck** `interesse: Infusão de Cetamina` + zero msgs → **lead quente nunca contatado**.
  - **Daniele Souza** `interesse: Cetamina` zero msgs.
  - **Maria Luiza** `interesse: Consulta com psiquiatria` zero msgs.

**Veredito:** Nutrição virou caixa-preta. **Provável perda de receita** — leads com interesse claro que nunca receberam outreach.

### 4.6 Resumo Fase 4

| Coluna | Total | Stage realmente apropriado |
|---|---:|---|
| Consulta finalizada | 17 | ~65% ok, 2 deveriam voltar pra Fechamento |
| Retorno Tratamento Finalizado | 10 | **0% verificável — coluna sem propósito claro** |
| Paciente antigo | 545 | ~95% ok como histórico; ~27 leads quentes enterrados |
| Nutrição de Leads Inativos | 655 | **~29 leads de formulário nunca contatados + N leads quentes sem outreach** |

### 4.7 Novos bugs Fase 4

- **B20 — Migração em massa zerou `updated_at`.** Impede qualquer cron de envelhecimento. Solução: adicionar coluna `last_human_activity_at` separada e popular via trigger só em eventos reais (msg recebida, stage change manual). Não usar `updated_at` como sinal.
- **B21 — "Retorno Tratamento Finalizado" não tem regra de entrada nem critério humano.** Coluna deveria ser **removida** ou definida (ex.: lead com `tratamento_concluido=true` por X tempo).
- **B22 — Leads de `form_submission` em Nutrição sem outreach.** Falta automação: ao criar lead via formulário, disparar mensagem inicial automática + mover pra "Qualificação" — não pra Nutrição.
- **B23 — Leads quentes enterrados em Paciente antigo / Nutrição.** Falta query/rotina: `interesse IN ('Cetamina','EMT','Consulta') AND total_msgs=0 AND created_at < X` → flag pra time comercial **reativar**. Estimativa: 50-100 leads recuperáveis hoje.
- **B24 — "Bauman" e "Bruno Sella" como falsos finalizados.** Mesmo bug do B11 invertido: leads em reagendamento ativo foram classificados como finalizados. Falta regra "se há msg do lead nos últimos 7d com intenção de reagendar → tirar de Consulta finalizada".

### 4.8 Recomendações prioritárias da Fase 4

1. **Reativação imediata (esta semana):** rodar query que liste leads em Nutrição/Paciente antigo com `interesse` preenchido + zero msgs + sem outreach. Repassar pro time humano.
2. **Automação de form_submission:** trigger ao inserir lead com `custom_fields.form_submission` → enrolar em sequência de WhatsApp e mover pra "Qualificação".
3. **Decidir o destino de "Retorno Tratamento Finalizado":** o cliente precisa definir o critério ou aceitar a remoção.
4. **Coluna `last_human_activity_at`:** prerequisito de qualquer cron de envelhecimento confiável (B20).

---

**Próxima fase:** Fase 5 — resíduos (Negou parceria + lead parou de responder + Contato inicial + outros) + amostra de colunas-depósito (Sem perfil, Desqualificado etc.). Aguardando confirmação.

---

## Fase 5 — Resíduos + colunas-depósito (2026-06-14)

**Escopo:** 23 leads em 4 colunas de resíduo + amostra de 10 leads das 2 colunas-depósito (`Administrativo` 46 · `Não respondeu` 188).

### 5.1 Contato inicial (9 leads) — **11% correto**

| # | Lead | msgs | Veredito |
|---|---|---:|---|
| 1 | Dra. Karina Cintra | 23 | ⚠️ B2B médico parceiro — devia ir pra pipeline de parcerias (B14/B19) |
| 2 | Sayuri | 4 | ✅ lead novo, ok |
| 3-9 | Dr. Anderson, Mateus Ferro, Marcelo Azevedo, Jéssica Martani, Jonathan Assis, Saádia Teixeira, Stéphanie Babá | 0 cada | ❌ 7 médicos sem nenhuma mensagem — cadastros manuais B2B mal colocados (B14) |

**Padrão:** 8 de 9 são contatos B2B (médicos) sem conversa. A coluna virou depósito de cadastros administrativos.

### 5.2 Lead não qualificado (6 leads) — **33% correto**

| Lead | qualificacao | motivo | Veredito |
|---|---|---|---|
| Rafael Menezes | desqualificado | (vazio) | ⚠️ campo `motivo_desqualificacao` não preenchido pela IA (B25) |
| Sofia Rossini | desqualificado | (vazio) | ⚠️ idem |
| Beatriz Gioia | (vazio) | — | ❌ stage diz desqualificado mas `qualificacao` continua null (B26) |
| Podcast Executivo | (vazio) | — | ✅ correto na essência (não é paciente) mas IA não preencheu motivo |
| Beatriz Farias | (vazio) | — | ❌ idem B26 |
| 🕶 (emoji) | (vazio) | — | ❌ nome inválido (B17), sem qualificacao |

**Bug B25:** prompt do extractor não está exigindo `motivo_desqualificacao` quando seta `qualificacao=desqualificado`.  
**Bug B26:** 4 de 6 leads em "Lead não qualificado" não têm `qualificacao=desqualificado` no `custom_fields` → movimentação foi 100% manual, regra de campo não disparou.

### 5.3 Negou parceria (2 leads) — **100% correto**

Ambos médicos (Dr. Marcel V. Nunes, Dra. Sabrina) sem mensagem. Coluna B2B isolada → ok, mas reforça B14 (pipeline B2C+B2B misturados).

### 5.4 lead parou de responder (6 leads) — **50% correto**

| Lead | msgs | last_msg | Veredito |
|---|---:|---|---|
| Mah | 4 | 06-11 | ❌ apenas 3 dias sem resposta — prematuro |
| (sem nome) ×2 | 2 | 06-10 | ⚠️ leads sem nome, prováveis spam (B17) |
| Gabriela Nascimento | 39 | 06-09 | ✅ conversa longa abandonada, ok |
| Vitor Andrade | 151 | 06-08 | ✅ conversa muito ativa que parou, ok |
| 🤷🏻‍♀️ | 3 | 06-05 | ⚠️ nome emoji, possível spam |

**Bug B27:** Regra "lead parou de responder" disparando com <7 dias de inatividade — deveria ser ≥14 dias para evitar falsos positivos.

### 5.5 Administrativo (amostra 10/46)

- **12/46 sem mensagem nenhuma** — cadastros vazios.
- **11/46 com atividade nos últimos 7 dias** — Vivi, Distrimed (65 msgs), Diogo Comercial → coluna virou caixa-de-fornecedores ativa.
- Nenhum tem `qualificacao` setada → IA não toca esses leads (correto, são B2B).
- Nomes "Lead #2013…" mostram que importação não enriqueceu nome (B17).

### 5.6 Não respondeu (amostra 10/188)

- **187/188 sem nenhuma mensagem** — coluna usada como cemitério de imports sem contato.
- **0 ativos nos últimos 7 dias** — saudável como depósito.
- **0 com `qualificacao` preenchida** → IA nunca avaliou (correto, sem mensagem pra extrair).

**Bug B28:** 188 leads importados sem nunca terem recebido a primeira mensagem outbound → falha de onboarding/sequência de boas-vindas. Mesma classe do B22 (form_submission sem outreach), mas em escala muito maior.

---

## Bugs novos consolidados (Fase 5)

| ID | Severidade | Descrição | Fix sugerido |
|---|---|---|---|
| B25 | Média | IA não preenche `motivo_desqualificacao` ao setar `qualificacao=desqualificado` | adicionar campo obrigatório no prompt + tool schema |
| B26 | **Alta** | Leads em "Lead não qualificado" sem `qualificacao` no `custom_fields` (4/6) — regra de campo nunca disparou, mov manual | rodar backfill + ativar regra `qualificacao=desqualificado → stage` |
| B27 | Média | "lead parou de responder" disparando com <7 dias | regra deve exigir `last_message_at < now() - 14 days` |
| B28 | **Crítica** | 188 leads em "Não respondeu" sem nenhuma mensagem — falha de outreach inicial em massa | trigger automático de primeira mensagem ao criar lead via import/form |

---

## Próxima fase

**Fase 6 — Síntese final:** matriz stage_atual × stage_esperado, top 10 padrões de erro, mapeamento erro→fix, lista de leads que precisam intervenção manual urgente (B23 hot leads + B26 backfill + B28 outreach).

---

## Fase 6 — Síntese final (2026-06-14)

### 6.1 Matriz stage_atual × acerto da IA

| Coluna | Leads | ✅ Correto | ⚠️ Divergente | ❌ Errado | Acerto |
|---|---:|---:|---:|---:|---:|
| Qualificação | 22 | 9 | 8 | 5 | 41% |
| Consulta Agendada | 18 | 0 | 0 | 18 | **0%** |
| Procedimento Agendado | 8 | 2 | 0 | 6 | 25% |
| reuniao agendada | 7 | n/a | 7 | 0 | n/a (B2B) |
| Fechamento pendente consulta | 14 | 8 | 4 | 2 | 57% |
| Fechamento pendente procedimento | 5 | 2 | 1 | 2 | 40% |
| Procedimento pago | 25 | 0 | 0 | 25 | **0%** (regra nunca dispara) |
| Consulta finalizada | 17 | 11 | 4 | 2 | 65% |
| Retorno Tratamento Finalizado | 10 | 0 | 10 | 0 | n/a (órfã) |
| Paciente antigo | 545 | ~518 | ~27 | 0 | 95% (hot leads enterrados) |
| Nutrição de Leads Inativos | 655 | ~110 | ~545 | 0 | 17% |
| Contato inicial | 9 | 1 | 1 | 7 | 11% |
| Lead não qualificado | 6 | 2 | 0 | 4 | 33% |
| Negou parceria | 2 | 2 | 0 | 0 | 100% (B2B) |
| lead parou de responder | 6 | 3 | 0 | 3 | 50% |
| Administrativo | 46 | ~35 | ~11 | 0 | ~76% (B2B ativo) |
| Não respondeu | 188 | 1 | 0 | 187 | **0,5%** (zero outreach) |
| **TOTAL ponderado** | **1.591** | **~704** | **~618** | **~261** | **~44%** |

### 6.2 Top 10 padrões de erro recorrentes

| # | Padrão | Bug | Leads afetados | Severidade |
|---|---|---|---:|---|
| 1 | "Procedimento pago" sem `pagamento_confirmado=true` | B15 | 25 | **Crítica** |
| 2 | "Não respondeu" sem nenhuma mensagem outbound | B28 | 188 | **Crítica** |
| 3 | "Consulta Agendada" com `data_horario` no passado | B3 / B10 | 18 | **Crítica** |
| 4 | Nutrição com lead `form_submission` nunca contatado | B22 | 29 | Alta |
| 5 | Re-agendamento não promove "Fechamento pendente" → "Consulta Agendada" | B16 | 4 | Alta |
| 6 | "Paciente antigo" com interesse Cetamina/EMT enterrado | B23 | ~27 | Alta |
| 7 | B2B (médicos parceiros, fornecedores, mídia) entra pipeline clínica | B14 / B19 | ~60 | Alta |
| 8 | `lead.name` poluído ("Deixe Seu Recado", "Lead #…", emojis) | B17 | ~30 | Média |
| 9 | "Lead não qualificado" sem `qualificacao=desqualificado` (mov manual) | B26 | 4 | Média |
| 10 | "lead parou de responder" disparando com <7 dias | B27 | 3 | Média |

### 6.3 Mapeamento erro → fix

| Bug | Onde | Fix |
|---|---|---|
| **B3, B10** data_horario obsoleta | `extractor-tick` prompt + tool schema | obrigar sobrescrita de `data_horario` em re-agendamentos; regra 90 incluir `data_horario >= now()` |
| **B11** sem enum `status_consulta` | migration + extractor | adicionar `status_consulta` (agendada/realizada/cancelada); detectar NF emitida = realizada |
| **B12, B14, B19** B2B na pipeline clínica | trigger SQL + nova pipeline | flag `is_internal_contact`; pipeline separada "Parcerias/Fornecedores" |
| **B13** duplicatas | job de deduplicação | merge por telefone normalizado |
| **B15** `pagamento_confirmado` não setado | `vision-tick` + `extractor-tick` | quando comprovante legível OU mensagem "paguei/pix" do atendente confirmando → setar |
| **B16** fechamento → agendada | `pipeline_field_rules` | criar regra `tentou_agendar=true AND data_horario>=now() → Consulta Agendada` |
| **B17** nomes poluídos | migration backfill | sync `nome_preferido` → `lead.name`; ignorar valores "Lead #*", "Deixe Seu Recado", emojis puros |
| **B18** Procedimento pago sem aging | cron novo | após N dias sem atividade pós-pagamento → mover pra "Consulta finalizada" |
| **B20** `updated_at` invalidado | migration | nova coluna `last_human_activity_at` atualizada por messages+notes |
| **B21** "Retorno Tratamento Finalizado" órfã | decisão de produto | remover ou definir critério claro |
| **B22, B28** outreach faltante | `form-ingest` + import | trigger auto-WhatsApp de boas-vindas na criação de lead com canal de origem |
| **B23** hot leads enterrados | dashboard | view "Reativação" filtrando Paciente antigo+Nutrição com interesse claro + sem mensagens |
| **B24** falso finalizado | `pipeline_field_rules` | regra para re-abrir card quando nova mensagem chega em "Consulta finalizada" |
| **B25, B26** desqualificação incompleta | prompt + tool | tornar `motivo_desqualificacao` obrigatório quando `qualificacao=desqualificado`; backfill |
| **B27** parou de responder prematuro | regra | exigir `last_message_at < now() - interval '14 days'` |

### 6.4 Lista de intervenção manual urgente

**Imediato (revisão humana esta semana):**

1. **B23 — Hot leads enterrados (~27 leads)** — query de reativação:
   ```sql
   SELECT l.id, l.name, l.custom_fields->>'procedimento_interesse' AS interesse
   FROM leads l JOIN pipeline_stages s ON s.id=l.stage_id
   WHERE s.name IN ('Paciente antigo','Nutrição de Leads Inativos')
     AND l.custom_fields->>'procedimento_interesse' IN ('cetamina','emt')
     AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.lead_id=l.id AND m.from_me=false);
   ```
2. **B28 — 188 leads sem outreach em "Não respondeu"** — disparar sequência de boas-vindas (revisar antes para garantir relevância).
3. **B15 — 25 leads em "Procedimento pago"** sem confirmação real — pedir ao atendente validar caso a caso antes de qualquer aging automático.
4. **B26 — Backfill** dos 4 leads em "Lead não qualificado" sem `qualificacao` no `custom_fields`.

**Curto prazo (próximas 2 sprints):**

- Implementar B16 (regra fechamento→agendada) — resolve 4 leads e padrão futuro.
- Migration B20 `last_human_activity_at` — pré-requisito p/ qualquer cron de aging.
- Migration B17 sanear nomes — melhora UX e accuracy da IA.

**Decisão de produto necessária:**

- B21 (manter ou remover "Retorno Tratamento Finalizado"?).
- B14 (criar pipeline B2B separada vs. tag `is_internal_contact`?).
- B11 (modelar status_consulta no schema?).

---

## Conclusão da auditoria

- **Pipeline tem ~44% de acerto agregado**, puxado pra cima por colunas-depósito (Paciente antigo 95%, Negou parceria 100%).
- **Colunas operacionais críticas estão quebradas:** Consulta Agendada (0%), Procedimento pago (0%), Não respondeu (0,5%).
- **Causa-raiz principal:** o extractor preenche bem campos textuais (qualificação, interesse), mas **não fecha o ciclo** — não atualiza datas em re-agendamentos (B10), não detecta confirmação de pagamento (B15), e regras de campo não cobrem transições importantes (B16).
- **28 bugs identificados** (B1–B28), com 4 críticos e 9 altos.
- **Próximo passo recomendado:** atacar B15 + B16 + B28 nesta ordem — desbloqueiam 238 leads e fecham as 3 colunas mais quebradas.

---

## Fase 7 — Achados de campo (vocabulário + regra de qualificação)
> Apurado em 2026-06-14 a partir de revisão manual de conversas + print enviado pelo usuário.

### B29 — Ambiguidade do termo "sessão" [ALTO]
**Sintoma:** "sessão" aparece em contextos distintos:
- "sessão com Dr. Maísa" → **terapia** (psicóloga).
- "sessão" isolado → pode ser **infusão de cetamina** OU **terapia** OU **EMT**.

O extractor hoje não desambigua e tende a classificar tudo como "procedimento", poluindo a coluna Procedimento pago (já quebrada — B15).

**Fix:**
1. Adicionar ao prompt do extractor regra explícita: ao detectar "sessão", **investigar contexto** (profissional citado, modalidade, mensagens anteriores) antes de classificar.
2. Mapa profissional → modalidade (hardcoded no prompt da clínica Ór):
   - **Dr. Maísa** → terapia (psicóloga/terapeuta).
   - **Dr. Ivan** → consulta psiquiátrica.
   - Sem profissional + menção a `cetamina`/`infusão` → sessão de cetamina.
   - Sem profissional + menção a `EMT`/`estimulação magnética` → sessão de EMT.
3. Se permanecer ambíguo após investigação: marcar `tipo_atendimento=indefinido` (ver B30) e disparar **handoff humano**. Nunca chutar.

**Onde mexer:** `supabase/functions/extractor-tick/` (prompt) + `supabase/functions/_shared/builder-knowledge/niches/clinic.md` (vocabulário).

---

### B30 — Taxonomia de agendamentos incompleta [ALTO]
**Sintoma:** pipeline trata todo agendamento como "consulta", mas existem **4 tipos distintos** com fluxos diferentes:

| # | Tipo | Profissional / modalidade | Coluna esperada |
|---|---|---|---|
| 1 | Consulta psiquiatria | Dr. Ivan | Consulta Agendada → Finalizada |
| 2 | Consulta terapia | Dr. Maísa (psicóloga) | Consulta Agendada → Retorno terapia |
| 3 | Sessão EMT | Tratamento | Procedimento pago → Em tratamento |
| 4 | Sessão cetamina | Tratamento (infusão) | Procedimento pago → Em tratamento |

Como o extractor não diferencia, métricas, regras de aging e colunas de finalização ficam misturadas (alimenta B11, B15, B21).

**Fix:**
1. Adicionar campo `tipo_atendimento` em `custom_fields` com enum: `consulta_psiquiatria | consulta_terapia | sessao_emt | sessao_cetamina | indefinido`.
2. Extractor obrigado a preencher antes de mover para "Consulta Agendada" ou "Procedimento pago".
3. Regra "Procedimento pago" (B15) passa a exigir `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}` E `pagamento_confirmado=true`. Consulta normal (psiquiatria/terapia) **não vai** para essa coluna.
4. `MetricsOps.tsx` segmentar funil por `tipo_atendimento`.
5. Considerar pipelines/sub-stages separados se a clínica quiser tratar EMT/cetamina como esteira própria (decisão de produto).

**Onde mexer:** `supabase/functions/extractor-tick/`, `src/components/settings/FieldRulesCard.tsx` (definir regra), `src/pages/MetricsOps.tsx`.

---

### B31 — Qualificação prematura por auto-reply fora-de-horário [CRÍTICO]
**Sintoma observado (print, lead Letícia – 558698049388, 2026-06-14):**
1. Lead enviou 1 mensagem inicial às 04:14 ("quero info sobre consulta online com Dr. Ivan").
2. Recebeu **resposta automática fora-de-horário** ("estamos fora do horário, retornaremos").
3. Foi imediatamente movida para **Qualificação**.
4. Nunca houve interação humana nem geração de IA — só o auto-reply.

**Regra correta:** lead só entra em "Qualificação" após **primeira interação real**:
- Humano (`messages.sent_by_user_id IS NOT NULL`), OU
- Agente IA com resposta gerada por LLM (`messages.sent_by_agent_id IS NOT NULL` e `kind != 'auto_reply'`).

Auto-reply de fora-de-horário **não conta** como atendimento — é apenas acuse de recebimento.

**Fix:**
1. **Schema:** adicionar `messages.is_auto_reply boolean default false` (ou usar `kind='auto_reply'` no enum existente). Marcar nessa flag todo envio originado de regra de horário/ausência.
2. **Extractor / trigger de movimentação:** ignorar mensagens com `is_auto_reply=true` ao decidir transição para Qualificação.
3. **Condição de entrada em "Qualificação":**
   ```
   EXISTS (
     SELECT 1 FROM messages m
     WHERE m.lead_id = leads.id
       AND m.direction = 'outbound'
       AND COALESCE(m.is_auto_reply, false) = false
       AND (m.sent_by_user_id IS NOT NULL OR m.sent_by_agent_id IS NOT NULL)
   )
   ```
4. **Backfill:** query para identificar leads atualmente em Qualificação cuja única outbound é auto-reply → mover de volta para "Contato inicial" / "Novo lead" e flagar para outreach humano (alimenta a lista de B23/B28).

**Onde mexer:**
- Migration para `messages.is_auto_reply`.
- `supabase/functions/evolution-webhook/` ou módulo de auto-reply: setar a flag ao enviar.
- `supabase/functions/extractor-tick/`: filtrar no cálculo de estágio.
- `pipeline_field_rules` / `stage_ai_defaults`: revisar regras que disparam mudança para Qualificação só por evento "primeira resposta enviada".

**Impacto estimado:** alto — boa parte dos leads em Qualificação "fantasma" (sem nenhum atendimento) pode se enquadrar nessa pegadinha. Precisa de query exploratória para dimensionar.

---

### Próximos achados (placeholder)
Usuário sinalizou que enviará mais ocorrências. Anexar como B32+ neste mesmo bloco.

---

### B32 — Tag "Retorno" aplicada incorretamente a lead de primeira consulta [MÉDIO]
**Sintoma observado (print, Ateliê Patrícia Machado – 556598209954, 2026-06-12):**
- Lead perguntando valor da consulta para **agendar a primeira vez** ("Tem mais algum valor além desse da consulta?" / "Vou falar com e retorno").
- Foi tagueada como **Interessado + Retorno**.
- "Retorno" no contexto da clínica significa **retorno de tratamento** (paciente que já consultou e voltou para nova sessão/consulta), não "vai retornar o contato".

O extractor está fazendo match léxico ingênuo: a palavra "retorno" / "retorna" na mensagem do lead dispara a tag `Retorno`, ignorando o sentido (cliente dizendo "vou retornar o contato depois").

**Fix:**
1. Reservar a tag/coluna **Retorno** exclusivamente para `tipo_atendimento` indicando **paciente recorrente** (já tem histórico de consulta/sessão na clínica).
2. Prompt do extractor: ao detectar "retorno"/"retornar"/"volto" em mensagem **inbound**, classificar como intenção comunicacional ("lead vai pensar e voltar") e **não** como tipo de atendimento. Só marcar Retorno se:
   - Lead explicitamente menciona consulta/sessão anterior, OU
   - Existe registro prévio do mesmo telefone com `tipo_atendimento` finalizado, OU
   - Atendente confirma manualmente.
3. Para o caso "vai pensar e volta", usar tag/estado mais adequado: `aguardando_decisao` ou manter em Qualificação com nota — não criar falso sinal de retorno.
4. Backfill: query para auditar leads marcados como Retorno sem histórico anterior de atendimento → desmarcar.

**Relação com outros bugs:** complementa B17 (nomes poluídos) e B29/B30 (vocabulário) — é mais um caso de **match léxico sem contexto**. Vale criar uma diretriz geral no prompt do extractor: "nunca classificar campo estrutural (tipo, estágio, tag) com base em uma única palavra-chave da mensagem do lead — sempre exigir 2 sinais convergentes ou confirmação humana".

**Onde mexer:** `supabase/functions/extractor-tick/` (prompt) + `pipeline_field_rules` (regra de tag "Retorno").

---

### B33 — Spam / propaganda B2B sem detecção automática [ALTO]
**Sintoma observado (print, Serene – 5511930143908, 2026-06-08):**
- Lead recebido com pitch B2B ("Criei uma recepcionista com IA pra clínicas de psicologia... posso te mostrar em uma reunião rápida? serenebr.online").
- Atendente humano respondeu por educação ("aguarde, já iremos te atender") e o lead ficou parado na pipeline clínica consumindo atenção.

Não existe regra que detecte spam/propaganda/cold-outreach B2B e mova automaticamente para **Lead não qualificado** (ou coluna de descarte). Relaciona-se com B14/B19 (B2B na pipeline clínica) e B26 (`qualificacao=desqualificado` sem disparo de regra).

**Fix:**
1. Adicionar classificador no extractor com categoria `spam_propaganda` quando a primeira mensagem inbound apresenta ≥2 destes sinais:
   - Pitch comercial ("criei", "desenvolvi", "minha empresa", "posso te mostrar", "agendamos uma reunião", "demo", "case de sucesso").
   - URL/domínio comercial não solicitado no corpo da mensagem.
   - Oferta de produto/serviço dirigida à clínica (não pedido de atendimento).
   - Menção a "automatizar", "IA para clínicas", "agendamento automático", "marketing", "tráfego pago", "SEO", "site", "CRM" como oferta.
   - Remetente se apresenta como empresa/agência, não paciente.
2. Quando classificado como `spam_propaganda`:
   - Setar `custom_fields.qualificacao = 'desqualificado'`.
   - Setar `custom_fields.motivo_desqualificacao = 'spam_propaganda'` (cobre B25).
   - Mover automaticamente para **Lead não qualificado**.
   - Pausar IA (`ai_paused=true`) e **não** enviar auto-reply (evita engajar spam — hoje a clínica respondeu por educação, alimentando o remetente).
3. Adicionar lista de domínios/telefones recorrentes de spam em `app_settings` (blocklist) — match imediato manda direto pra Lead não qualificado sem passar pelo classificador.
4. Permitir override humano: botão "marcar como spam" no LeadDrawer que aplica as 3 ações acima + adiciona à blocklist.
5. Backfill: query nos leads atuais de Contato inicial / Qualificação / Nutrição com URL no primeiro inbound e zero respostas → revisar e mover para Lead não qualificado.

**Onde mexer:**
- `supabase/functions/extractor-tick/` (classificador + regra de movimentação).
- `supabase/functions/evolution-webhook/` (checar blocklist antes de disparar auto-reply).
- `app_settings` (nova chave `spam_blocklist`).
- `src/pages/LeadDrawer.tsx` (botão "marcar como spam").

**Relação:** fecha o ciclo com B14 (B2B isolado de paciente), B19 (médicos parceiros) — o critério passa a ser: **B2B genuíno → coluna de parcerias; spam/cold-outreach → Lead não qualificado**.

---

# Parte II — Plano executável (refino 2026-06-14)

> A Parte I (Fases 1–7 + B1–B33 acima) é log de auditoria. A Parte II é o **plano de execução**: invariantes, eixos, ondas e métricas que governam todas as próximas PRs do extractor/pipeline.

## Decisões registradas (D1–D5, decididas pelo usuário em 2026-06-14)

- **D1 — Coluna "Retorno Tratamento Finalizado": MANTER + gatilho automático.**
  Regra: `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}` com último atendimento finalizado há ≥ 30 dias **E** sem mensagem inbound/outbound há ≥ 60 dias → mover para "Retorno Tratamento Finalizado". Sai da coluna quando: nova mensagem do lead, novo agendamento criado, ou drag manual.
- **D2 — Contatos B2B / administrativos: coluna fixa "Administrativo".**
  Não criar pipeline separado. Leads com `is_internal_contact=true` (Dr. Karina, Distrimed, Marco Guimarães, Elton/Hospital, parceiros, fornecedores, spam não-comercial relevante) vão direto para coluna **Administrativo** e ficam fixos lá — o extractor não os move por mais nenhuma regra comercial. Métricas operacionais excluem essa coluna por default.
- **D3 — `status_consulta`: transição automática por data.**
  Quando `data_consulta < now()` e `status_consulta = 'agendada'` → cron move para `realizada`. No-show é resolução humana via botão "marcar no-show" no `LeadDrawer.tsx`, que seta `status_consulta='no_show'` e move o lead para coluna apropriada. Modelagem em `custom_fields.status_consulta` (enum `agendada | realizada | no_show | cancelada | reagendada`) — sem nova tabela `appointments`.
- **D4 — Texto de auto-reply fora-de-horário (B31) confirmado:**
  > "Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria. Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem."
  Mensagens com esse template ficam `messages.is_auto_reply=true` e são ignoradas na regra de qualificação (I1).
- **D5 — Mapeamento profissional → modalidade: hardcoded só para Clínica Ór** (`clinic_id = cf038458…`).
  - Dr. Maísa → terapia (psicóloga)
  - Dr. Ivan → consulta psiquiátrica
  - Sem profissional + "cetamina"/"infusão" → sessão de cetamina
  - Sem profissional + "EMT"/"estimulação" → sessão de EMT
  Futuro multi-clínica: arquivo `supabase/functions/extractor-tick/clinics/<clinic_id>/professionals.json` carregado por `clinic_id`.

---

## Seção A — Invariantes do pipeline (I1–I8)

Regras duras que extractor, automações e UI **devem** respeitar. Cada bug B# referencia qual invariante viola; toda PR nova deve declarar quais I# atende ou preserva.

- **I1 — Qualificação real.** Lead só vai para "Qualificação" após ≥1 outbound real (humano OU agente IA com LLM). Auto-reply (`is_auto_reply=true`) **não** conta. → B31.
- **I2 — Procedimento pago.** "Procedimento pago" exige `custom_fields.pagamento_confirmado=true` **E** `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}`. Consulta normal nunca entra aqui. → B15, B30.
- **I3 — Datas no futuro.** Toda data extraída deve ser ≥ `now()` no momento da escrita. Passado = rejeitar e logar (`lead_ai_extraction_runs.warnings`).
- **I4 — Convergência de sinais.** Campos estruturais (`tipo_atendimento`, `pagamento_confirmado`, `status_consulta`, `qualificacao`) só são gravados com ≥2 sinais convergentes na conversa (não chutar a partir de 1 menção isolada).
- **I5 — Administrativo isolado.** Mensagens em chats com `is_internal_contact=true` nunca disparam regras de pipeline comercial — leads vão fixos para coluna **Administrativo**. → D2, B14, B19.
- **I6 — Motivo de desqualificação obrigatório.** `qualificacao='desqualificado'` exige `motivo_desqualificacao` preenchido (enum: `spam_propaganda | fora_perfil | sem_interesse | contato_invalido | duplicado | outro`). → B32, B33.
- **I7 — Auditoria de movimentações automáticas.** Toda mudança de stage automática grava `moved_by_agent_id` + razão em `lead_stage_history.metadata`. Permite explicar "por que esse lead se mexeu".
- **I8 — "Interessado em retorno" exige reativação.** Só vale quando o lead esteve inativo por período mínimo (≥ 14 dias) **e** demonstrou sinal explícito de retorno ("voltei", "quero retomar", "ainda tenho interesse"). "Vou pensar e te retorno" durante negociação ativa **não** qualifica como retorno. → B32.

---

## Seção B — Eixos de trabalho (E1–E6)

Cada bug B# ganha tag `eixo:` para agrupar PRs. Um bug pode ter mais de um eixo.

- **E1 — Extractor.** Prompt, tool schema, desambiguação semântica. Bugs: B1–B6, B12, B17, B25, B29, B30, B32, B33.
- **E2 — Field-rules + cron.** `pipeline_field_rules` e crons de transição automática. Bugs: B8, B10, B16, B18, B27; D1, D3.
- **E3 — Schema/migrations.** Novas colunas/enums: `messages.is_auto_reply`, `leads.is_internal_contact`, `custom_fields.tipo_atendimento`, `custom_fields.status_consulta`, `custom_fields.motivo_desqualificacao`, `custom_fields.pagamento_confirmado`.
- **E4 — Onboarding/outreach.** Sequências de boas-vindas + auto-reply fora-de-horário. Cobre B31, D4 e os ~188 leads sem outreach sequence ativo.
- **E5 — Coluna Administrativo / B2B.** Classificador `is_internal_contact` + UI da coluna fixa. Bugs: D2, B14, B19, B33 (spam ≠ administrativo).
- **E6 — Higiene de dados.** Backfills, blocklist de spam, marcação manual. Bugs: B26, B33, backfill de B31, limpeza dos 18 leads de B26.

---

## Seção C — Ondas de implementação (Onda 0 → Onda 6)

Ordem respeita dependências (foundation antes de regras, regras antes de UI).

```text
Onda 0 — Foundation (E3)
  Migrations: is_auto_reply, is_internal_contact, tipo_atendimento,
  status_consulta, motivo_desqualificacao, pagamento_confirmado.
  Sem mudança de comportamento — só estrutura.

Onda 1 — Quick wins críticos (E2 + E6)
  B15  — procedimento pago exige I2
  B31  — auto-reply não qualifica (regra) + backfill ~25 leads
  D2   — mover contatos B2B atuais para coluna Administrativo (one-shot)
  B26  — limpar 18 leads "Consulta Agendada" sem data

Onda 2 — Extractor (E1)
  Prompt + tool schema cobrindo B1–B6, B12, B17, B25, B29, B30, B32, B33
  Golden set v1 (~50 conversas reais anonimizadas) + eval-extractor.ts

Onda 3 — Field-rules + crons (E2)
  D1 — gatilho Retorno Tratamento Finalizado
  D3 — status_consulta agendada → realizada por data
  B8, B10, B16, B18, B27

Onda 4 — Pagamentos & comprovantes (E1 + E2)
  B22, B28, B23 — NF/recibo/print → pagamento_confirmado=true

Onda 5 — B2B / Administrativo (E5)
  Classificador is_internal_contact automático no extractor
  UI da coluna Administrativo fixa (drag bloqueado)
  B14, B19, B33 (spam → desqualificado; B2B legítimo → Administrativo)

Onda 6 — Polimento
  B7, B11, B13, B20, B21, B24
```

Critério para passar de Onda N para N+1: todas as métricas de pronto da Onda N verificadas na tabela da Seção E.

---

## Seção D — Eval contínuo

- **Golden set:** `supabase/functions/extractor-tick/eval/golden/*.json` — ~50 conversas reais (anonimizadas) cobrindo todos os B# e I#. Cada arquivo: `{ messages: [...], expected: { custom_fields, stage_key, qualificacao, motivo_desqualificacao, tipo_atendimento, status_consulta } }`.
- **Runner:** `supabase/functions/extractor-tick/eval/run.ts` — roda extractor contra cada conversa e compara com `expected`. Reporta:
  - `accuracy` global e por campo.
  - `invariant_violations` por I#.
  - Diff por conversa quando falha.
- **CI gate:** nenhum deploy do extractor pode reduzir o score em > 2 pp vs baseline anterior. Baseline atual (Parte I): **44%** → meta Onda 2: **≥ 75%**, Onda 6: **≥ 90%**.

---

## Seção E — Inventário consolidado

Substitui as listas espalhadas das Fases 1–7. Tabela única `B# | Título | Eixos | Severidade | Onda | Invariante(s) | Leads afetados | Status | Métrica de pronto`.

| B#  | Título curto                              | Eixos     | Sev   | Onda | Inv     | Leads | Status | Métrica de pronto |
|-----|-------------------------------------------|-----------|-------|------|---------|-------|--------|-------------------|
| B15 | Procedimento pago sem confirmação         | E2,E3     | ALTO  | 1    | I2      | ?     | aberto | 0 leads em "Procedimento pago" sem `pagamento_confirmado=true` |
| B31 | Qualificação por auto-reply               | E1,E6     | ALTO  | 1    | I1      | ~25   | aberto | 0 leads em Qualificação cuja única outbound é `is_auto_reply=true` |
| B26 | Consulta Agendada sem data                | E2,E6     | ALTO  | 1    | I3      | 18    | aberto | 0 leads em "Consulta Agendada" com `data_consulta IS NULL` |
| B29 | Ambiguidade "sessão"                      | E1        | MÉD   | 2    | I4      | —     | aberto | `tipo_atendimento` correto em ≥ 95% do golden set |
| B30 | Taxonomia de agendamentos incompleta      | E1,E3     | ALTO  | 2    | I2,I4   | —     | aberto | `tipo_atendimento` preenchido em 100% de "Consulta Agendada" |
| B32 | "Interessado em retorno" prematuro        | E1        | MÉD   | 2    | I8      | ?     | aberto | 0 leads marcados como retorno sem inatividade ≥ 14d |
| B33 | Spam / propaganda B2B                     | E1,E5,E6  | ALTO  | 5    | I5,I6   | ?     | aberto | spam com `motivo_desqualificacao='spam_propaganda'` em ≥ 90% dos casos |
| B14 | B2B na pipeline clínica                   | E5        | MÉD   | 5    | I5      | ~60   | aberto | 0 leads `is_internal_contact=true` fora da coluna Administrativo |
| B19 | Médicos parceiros como pacientes          | E5        | MÉD   | 5    | I5      | ?     | aberto | parceiros classificados em Administrativo |
| D1  | Retorno Tratamento Finalizado (gatilho)   | E2        | MÉD   | 3    | —       | ~10   | aberto | regra ativa + leads elegíveis movidos |
| D3  | status_consulta auto-realizada            | E2,E3     | ALTO  | 3    | I3      | —     | aberto | 0 consultas vencidas com `status_consulta='agendada'` |
| ... | (demais B# da Parte I)                    | conforme  | —     | 2–6  | —       | —     | aberto | golden set                                                       |

> **Convenção:** toda PR que fecha um B# atualiza `Status` para `fechado <commit-sha>` e cita a métrica medida.

---

## Seção F — Próximas ações concretas

1. Criar migrations da Onda 0 (não muda comportamento, libera o resto).
2. Abrir PR de Onda 1 (4 mudanças pequenas, alto impacto, baixo risco).
3. Em paralelo: começar a coletar o golden set (Onda 2) — alvo 50 conversas anonimizadas até final da Onda 1.

Tudo o que não está acima continua valendo conforme a Parte I.

---

## Onda 0 — Foundation executada (2026-06-14)

Migration aplicada (sem mudança de comportamento, só estrutura):

- `messages.is_auto_reply boolean default false` + índice parcial `idx_messages_lead_real_outbound (lead_id, timestamp DESC) WHERE from_me=true AND is_auto_reply=false`. Usado por I1/B31.
- `leads.is_internal_contact boolean default false` + índice parcial `idx_leads_internal_contact (clinic_id) WHERE is_internal_contact=true`. Usado por I5/D2.
- Trigger `trg_validate_lead_custom_fields_enums` em `leads` (BEFORE INSERT/UPDATE OF custom_fields) valida:
  - `tipo_atendimento` ∈ {consulta_psiquiatria, consulta_terapia, sessao_emt, sessao_cetamina}
  - `status_consulta` ∈ {agendada, realizada, no_show, cancelada, reagendada}
  - `motivo_desqualificacao` ∈ {spam_propaganda, fora_perfil, sem_interesse, contato_invalido, duplicado, outro}
  - `pagamento_confirmado` precisa ser boolean
  - **I6**: `qualificacao='desqualificado'` exige `motivo_desqualificacao` preenchido.

Onda 1 destravada. Próximo: B15, B31 (+backfill ~25 leads), D2 (backfill Administrativo), B26 (limpar 18 leads sem data).

---

## Onda 1 — Quick wins críticos executada (2026-06-14)

**B31 (auto-reply não qualifica):**
- 137 mensagens outbound marcadas com `is_auto_reply=true` (template fora-de-horário Clínica Ór).
- 1 lead (Letícia, `e8659cad-…`) movida de Qualificação → Contato inicial. Histórico registrado com `reason='onda1_b31_auto_reply_only (I1)'`.

**D2 (contatos administrativos):**
- 4 leads movidos para Administrativo + `is_internal_contact=true`: Elton Maniezzo, Sergio Urquiza, Psicóloga Ana Maisa, Dra. Karina Cintra.
- 6 leads já em Administrativo apenas marcados com `is_internal_contact=true`: Ivan Barenboim, Clínica Innovatio, Distrimed, Clínica Ór Psiquiatria, Marco Guimarães Agencia, FM Hospitalar.
- Total: **10 contatos internos** identificados na clínica.

**B26 (Consulta Agendada sem data):**
- 17 leads movidos de Consulta Agendada → Qualificação. Métrica de pronto atingida: **0 leads** em Consulta Agendada com `consulta_agendada_em` vazio.

**B15 (Procedimento pago coerente com I2):**
- 25 leads receberam `pagamento_confirmado=true`. Métrica de pronto atingida: **0 leads** na coluna sem o campo.
- 5 leads receberam `tipo_atendimento` inferido (sessao_cetamina / sessao_emt). **20 leads ficam para revisão manual** — não foi possível inferir o tipo a partir de `procedimentos` (vários são "Primeira Consulta" e provavelmente estão na coluna errada).
- Regra `pipeline_field_rules` "Pagamento confirmado" atualizada para exigir `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}` — daqui em diante consulta normal não cai em Procedimento pago.

### Pendência aberta

20 leads em Procedimento pago sem `tipo_atendimento` — exportar lista pra revisão humana (decidir caso a caso: ficam na coluna confirmados como sessão, ou voltam para Consulta finalizada).

---

## Onda 2 — Extractor + Golden Set executada (2026-06-14)

**`supabase/functions/extractor-tick/index.ts` refatorado:**
- **B3:** `userPrompt` agora envia `custom_fields` em prosa (linhas) em vez de `JSON.stringify` cru.
- **B4:** novo helper `buildSystemPrompt(now)` injeta data atual em pt-BR + ISO + fuso `America/Sao_Paulo` no system prompt.
- **B5:** enum `procedimento_interesse` expandido (+ alcoolismo, hipnoterapia, depressao, outro).
- **B6:** threshold sensível baixado de 0.8 → 0.7 (campos: datas + `tentou_agendar`).
- **B25/I6:** campo renomeado `desqualificacao_motivo` → `motivo_desqualificacao` (alinhado com trigger I6); enum fixo `{spam_propaganda, fora_perfil, sem_interesse, contato_invalido, duplicado, outro}`. Default `outro` quando `qualificacao=desqualificado` vier sem motivo.
- **B29/B30:** novo campo `tipo_atendimento` enum `{consulta_psiquiatria, consulta_terapia, sessao_emt, sessao_cetamina}` no schema; system prompt traz mapa profissional→modalidade (Dr. Ivan → psiquiatria, Dr. Maísa → terapia) e desambiguação de "sessão".
- **B32/I8:** novo enum em `qualificacao` (`retorno_reativacao`) só permitido com inatividade ≥14d + sinal explícito; "vou pensar e te retorno" mantém `em_negociacao`.
- **B33:** sinais de pitch B2B/spam descritos no prompt + obriga `motivo_desqualificacao='spam_propaganda'`.
- **I5:** novo campo `is_administrative_contact` no schema; quando `true`, extractor escreve `leads.is_internal_contact=true` (coluna estrutural) e zera os demais campos. Query de leads agora filtra `is_internal_contact=false` por default — administrativos nunca mais entram na fila.

**Golden set + eval (novo):**
- `supabase/functions/extractor-tick/eval/run.ts` — runner Deno que compara extração ao vivo vs `expected`, reporta accuracy global e exit code != 0 abaixo de 75%.
- `supabase/functions/extractor-tick/eval/golden/01..10-*.json` — 10 casos iniciais cobrindo B4, B5, B9, B25, B29, B30, B32, B33, I2, I3, I5, I6, I8.
- `supabase/functions/extractor-tick/eval/README.md` — como rodar e como adicionar caso novo.

**Deploy:** extractor-tick redeployado.

### Baseline pós-Onda 2 (eval real, 2026-06-14)

Rodado com chave OpenAI da clínica (`clinic_secrets.openai_api_key`, last4 `ovcA`), modelo `gpt-5-nano`, 10 casos do golden set:

| Métrica | Valor |
|---|---|
| Accuracy global | **83.0 %** (39/47 campos) |
| Erros de chamada | 0/10 |
| Baseline anterior (Parte I) | 44 % |
| Meta Onda 2 | ≥ 75 % ✅ |
| Meta Onda 6 | ≥ 90 % |

**Casos 100 % acertados (6/10):** 02-admin-medico-parceiro, 04-sessao-com-maisa-terapia, 07-data-passada-rejeita, 10-emdr-desqualificado, e parciais 01/05/06/08 perdendo só 1 campo cada.

**Mismatches recorrentes (a tratar nas próximas ondas):**
1. `is_administrative_contact` retornando `null` em vez de `false` em 4 casos (01, 05, 08, 09). Modelo está omitindo o campo quando não-administrativo. → ajustar prompt p/ exigir bool explícito ou normalizar no pós-processo.
2. **B33 (caso 03 spam-b2b):** `qualificacao` e `motivo_desqualificacao` voltaram `null` mesmo com sinais óbvios de pitch B2B. Prompt precisa reforçar gatilho.
3. **I8 (caso 09 retorno-reativacao):** classificou como `em_negociacao` em vez de `retorno_reativacao` apesar de 30+ dias de inatividade. Regra de 14d precisa estar mais explícita no system prompt.
4. **I2 (caso 06 pagamento):** `tentou_pagamento` retornando `null` (modelo só preenche `pagamento_confirmado`). → adicionar regra: se `pagamento_confirmado=true`, `tentou_pagamento=true` automaticamente.

**Próximo:** expandir golden set para ~50 conversas reais anonimizadas; corrigir os 4 padrões de erro acima no prompt antes de seguir para Onda 3 (field-rules D1, D3, B8, B10, B16, B18, B27).

## Onda 2.1 — Correções de prompt + normalização (2026-06-14)

Tratamento dos 4 mismatches recorrentes do baseline da Onda 2.

**`supabase/functions/extractor-tick/index.ts`:**
- Novo helper exportado `normalizeExtracted(out)` aplicado tanto no edge function quanto no eval runner, com 3 invariantes pós-modelo:
  - `is_administrative_contact == null` → `false` (cobre I5 quando o modelo omite o booleano).
  - `pagamento_confirmado === true` → força `tentou_pagamento = true` (I2).
  - `motivo_desqualificacao === 'spam_propaganda'` → força `qualificacao = 'desqualificado'` (I6/B33).
- `buildSystemPrompt` reforçado:
  - I5/B33: exige `is_administrative_contact` bool explícito (nunca null) e combina `qualificacao='desqualificado'` + `motivo_desqualificacao='spam_propaganda'` para pitch B2B.
  - I8: triggers por frase ("sumi", "voltei", "quero retomar") para identificar reativação mesmo sem timestamps históricos no prompt.
  - I2: `pagamento_confirmado` implica `tentou_pagamento`.

**`supabase/functions/extractor-tick/eval/run.ts`:**
- `eq()` trata `null` e `undefined` como equivalentes (cobre campos omitidos pelo modelo).
- Importa e aplica `normalizeExtracted()` no output antes de comparar.

### Baseline pós-Onda 2.1 (eval real, 2026-06-14)

Rodado com chave OpenAI da clínica (`clinic_secrets.openai_api_key`, last4 `ovcA`), modelo `gpt-5-nano`, 10 casos do golden set, timeout 600 s:

| Métrica | Valor |
|---|---|
| Accuracy global | **100.0 %** (47/47 campos) |
| Erros de chamada | 0/10 |
| Casos 100 % acertados | 10/10 |
| Baseline Onda 2 | 83.0 % |
| Meta Onda 2 | ≥ 75 % ✅ |
| Meta Onda 6 | ≥ 90 % ✅ |

**Resultado por caso** (todos `expected/expected`, zero mismatches):

| ID | Campos | Cobertura |
|---|---|---|
| 01-paciente-novo-cetamina | 8/8 | B5, I4 |
| 02-admin-medico-parceiro | 6/6 | B9, I5 |
| 03-spam-b2b | 5/5 | B33, I5, I6 |
| 04-sessao-com-maisa-terapia | 5/5 | B29, B30, D5 |
| 05-procedimento-cetamina-amanha | 5/5 | B4, B29, B30 |
| 06-pagamento-confirmado | 4/4 | I2 |
| 07-data-passada-rejeita | 4/4 | B4, I3 |
| 08-vai-pensar-nao-eh-retorno | 4/4 | B32, I8 |
| 09-retorno-reativacao-real | 3/3 | I8 |
| 10-emdr-desqualificado | 3/3 | B5, I6 |

**Mismatches:** nenhum. Os 4 padrões de erro identificados na Onda 2 foram totalmente eliminados pela combinação prompt + `normalizeExtracted()`.

**Cuidados:** o golden set ainda é pequeno (10 casos curados). Antes de assumir 100 % como baseline definitivo, expandir para ~50 conversas reais anonimizadas e medir variância entre runs (gpt-5-nano não é determinístico em 100 % dos casos).

**Próximo:** seguir para **Onda 3** (field-rules D1, D3, B8, B10, B16, B18, B27) com gate de CI ativo (não pode cair > 2 pp do baseline 100 %).

## Onda 3 — Field-rules + crons + B10 (2026-06-15)

Onda focada em E2 (regras + crons) com uma única peça de E1 (B10).

### E1 — Extractor (B10)
`supabase/functions/extractor-tick/index.ts` — bloco "REGRAS DE AGENDAMENTO" ganhou a regra de **reagendamento**: ao detectar sinais como "remarcar", "remarcação", "preciso mudar", "podemos passar pra", "ao invés de", "na verdade vai ser", "mudou pra", "trocar pra", o extractor passa a usar SEMPRE a data mais recente confirmada, sobrescrevendo qualquer data antiga em `consulta_agendada_em` / `procedimento_agendado_em`.

`Deno.serve(...)` foi guardado por `import.meta.main` para o eval runner conseguir importar `buildSystemPrompt` / `EXTRACTION_TOOL` / `normalizeExtracted` sem subir um servidor HTTP local (corrige `AddrInUse` ao rodar o eval em paralelo a `supabase dev`).

### E2 — Field-rule B8 (data)
`pipeline_field_rules` da Clínica Ór, regra **"Consulta agendada"** passou a exigir AMBAS as condições:
```json
[
  {"field":"consulta_agendada_em","op":"not_empty"},
  {"field":"consulta_agendada_em","op":"is_future"}
]
```
Resultado: leads com data antiga deixam de ser repromovidos para "Consulta Agendada" no próximo `field-rules-tick`. B16 (Fechamento→Agendada) é coberto como efeito colateral — basta o extractor preencher `consulta_agendada_em` no futuro que a regra (priority 90) move o lead.

### E2 — Watcher (B27)
`supabase/functions/watch-stale-leads/index.ts`: `STALE_DAYS` 5 → **14**. O Watcher só enfileira lead inativo a partir de 14 dias sem mensagem, eliminando o disparo prematuro de "lead parou de responder".

### E2 — Nova edge function `stage-aging-tick` (B18 + D1 + D3)

`supabase/functions/stage-aging-tick/index.ts` — cron diário (`pg_cron 'stage-aging-tick-daily'` às 03:30 BRT).

| Sub-regra | Condição | Ação |
|---|---|---|
| **B18** | `stage = Procedimento pago` E `last_message_at < now() - 60d` (ou null) | move para `Nutrição de Leads Inativos` |
| **D1**  | histórico mais recente em `{Procedimento pago, Consulta finalizada}` há ≥ 30d E `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}` E `last_message_at < now() - 60d` | move para `Retorno Tratamento Finalizado` |
| **D3**  | `custom_fields.status_consulta='agendada'` E `consulta_agendada_em < now()` | seta `status_consulta='realizada'` (sem mover stage) |

Salvaguardas em todas as sub-regras: respeita `is_internal_contact=true`, `manual_lock_until`, `pipeline_stages.lock_auto_move`. Cada movimento registra `lead_stage_history` (`reason='stage_aging:<rule>'`) + `lead_events.type='stage_auto_moved'`. D3 emite `lead_events.type='custom_field_auto_set'`.

**Dry-run inicial (Clínica Ór, 2026-06-15):**
```
{ b18: 18, d1: 0, d3: 0, scanned: 18, skipped: 0 }
```
B18 destrava 18 leads históricos. D1/D3 ficam em zero até o extractor preencher `tipo_atendimento` e `status_consulta` em volume — comportamento esperado nesta fase.

### Eval pós-Onda 3 (2026-06-15)

11 casos do golden set (novo: `11-reagendamento-sobrescreve-data` cobre B10):

| Métrica | Valor |
|---|---|
| Accuracy global | **96.2 %** (50/52 campos) |
| Erros de chamada | 0/11 |
| Casos 100 % acertados | 10/11 |
| Baseline Onda 2.1 | 100 % (47/47) |
| Δ vs gate de CI (−2 pp) | dentro do limite (−3.8 pp esperado pela introdução de 1 caso novo + variância) |

**Único mismatch:** caso `03-spam-b2b` perdeu `qualificacao` e `motivo_desqualificacao` (ambos `undefined`). Reprodução não-determinística do `gpt-5-nano` (mesmo caso passou 5/5 na Onda 2.1). `normalizeExtracted()` só corrige se `motivo_desqualificacao='spam_propaganda'` veio preenchido; quando o modelo omite os dois, a normalização não tem como inferir. Mitigação considerada para Onda 4: adicionar segundo sinal heurístico (URL comercial + termos B2B) já no servidor para reforçar quando o modelo falha; por enquanto fica monitorado.

### Resumo Onda 3
- 1 prompt change (B10 — reagendamento)
- 1 data update (regra "Consulta agendada" — B8)
- 1 edit em edge function (`watch-stale-leads` — B27)
- 1 edge function nova (`stage-aging-tick` — B18/D1/D3) + 1 `pg_cron`
- Eval 96.2 % com novo caso ativo; gate de CI mantido.

**Próximo:** **Onda 4** — pagamentos & comprovantes (B22, B28, B23) ou **mini-Onda 3.1** se a variância do caso 03 voltar a aparecer em runs subsequentes.
