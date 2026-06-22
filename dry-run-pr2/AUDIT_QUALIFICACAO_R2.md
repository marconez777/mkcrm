# Auditoria — Coluna "Qualificação" (Clínica ÓR) — Rodada 2

Gerado em 2026-06-22, pós-PR4 e pós correções do classifier (retry de schema, heartbeat 6min, schemas relaxados, remoção de `manual_lock_until`/`modalidade_preferida`, canônico `eh_paciente_antigo`).

> **Sem escrita.** Tudo abaixo é leitura. As ações propostas vêm com SQL pronto mas só são aplicadas após sua aprovação por bloco.

---

## Resumo executivo

- **Total na coluna:** 14 leads (rodada anterior tinha 44 → PR4 moveu 22 para Paciente antigo / reorganizou; 8 saíram daqui via outras automações; sobraram 14).
- **Leads com inatividade preocupante (>5d sem inbound):** 11 / 14 — vão cruzar o gatilho de 7d nos próximos 1–2 dias e serão movidos automaticamente para "Nutrição Inativa".
- **Leads com classifier errando AGORA (schema mismatch):** 3 — `c7d84fa3` Giovanna, `34351be1` Jaqueline, `4f82d8e5` Gabriela. As correções do PR anterior ou não foram deployadas ainda, ou o erro reincidiu (verificar deploy).
- **Leads que precisam ir para outra coluna por conteúdo:** 4 (ver §4).
- **🔴 BUG NOVO descoberto (fora deste audit):** o classifier, em 21/jun, **apagou em massa** campos personalizados úteis de quase todos os leads — keys fora da whitelist (`observacoes`, `tipo_contato`, `qualificacao`, `procedimento_interesse`, `motivo_consulta`, `atendente`, `codigo_fila`…) foram zeradas pelo enforcement. **Isso explica a maior parte das "lacunas de campo".** Recomendo abrir PR separado.
- **Lead interno na coluna:** 1 (`0d23bf1c` Valéria Godoy — psicóloga; deveria ir para B2B/Stakeholders ou Desqualificado).

---

## 1) Snapshot — Inatividade

| Lead | Nome | d_in | d_out | n_msgs | tag # | d_stage | Avaliação |
|---|---|---:|---:|---:|---:|---:|---|
| fdbc1822 | Edmara Schröder | 6 | 6 | 3 | 4 | 3 | ⚠️ 1 dia para cair em "Nutrição inativa" automaticamente |
| dd387d25 | Márcia/Beatriz Hiroko | 5 | 5 | 25 | 0 | 4 | ⚠️ vai cair em 2d |
| 4f82d8e5 | Gabriela Paiva | 5 | 5 | 17 | 0 | 4 | ⚠️ vai cair em 2d; classifier falhando |
| 0ee236df | Juliana Alves | 5 | 5 | 45 | 0 | 4 | ⚠️ vai cair em 2d |
| d7a9528f | Patty Araujo | 5 | 5 | 22 | 0 | 4 | ⚠️ vai cair em 2d |
| c42b41f1 | Rafael Savassi | 5 | 5 | 35 | 0 | 4 | ⚠️ vai cair em 2d; é **renovação de receita** (ver §4) |
| 7be2e675 | Monique Pontes | 5 | 5 | 14 | 0 | 4 | ⚠️ vai cair em 2d; é **B2B** (representante orçamento — ver §4) |
| 34351be1 | Jaqueline Galdino | 4 | 4 | 12 | 0 | 4 | classifier falhando |
| 0d23bf1c | Valéria Godoy | 3 | 3 | 73 | 0 | 4 | 🔴 marcado como **interno** — não deveria estar aqui |
| fdb73c36 | Lead #7171022 | 3 | 3 | 71 | 1 | 4 | conversa ativa, mas sem nome |
| 26109147 | Ariane | 3 | 3 | 24 | 0 | 0 | recém-entrou hoje (stage_changed_at=hoje) |
| 9daddb44 | Ednaldo | 2 | 2 | 112 | 0 | 4 | conversa muito ativa |
| 135cb78a | Marina | 2 | 2 | 24 | 1 | 4 | ativo |
| c7d84fa3 | Giovanna Maia | 2 | 2 | 14 | 0 | 2 | classifier falhando |

Legenda: `d_in` = dias desde a última mensagem do paciente, `d_out` = dias desde a última saída da clínica, `d_stage` = dias na coluna.

**Conclusão de inatividade:** o `pipeline-deterministic` está **funcionando** — usa `last_message_at < now()-7d` para mover para "Nutrição Inativa". Nenhum lead aqui ainda cruzou os 7d (o máximo é 6d). Em até 2 dias, 7 leads cairão sozinhos. Não é necessário mover nada à força.

> ⚠️ **Observação fina:** a regra usa `last_message_at` (qualquer mensagem, inclusive da secretária). Se a clínica mandar follow-up no dia 6, o relógio reseta e o lead nunca cai. Isso pode ser desejável (ainda há tentativa ativa) ou indesejável (vira "loop de follow-up sem resposta"). Decisão sua — virou item para PR separado se quiser trocar para `last_inbound_at`.

---

## 2) Campos personalizados — estado e causa

Matriz: 1 = preenchido, 0 = vazio.

| Lead | Nome | int_consulta | int_tratamento | origem | eh_paciente_antigo | status_financeiro | Causa principal |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 26109147 | Ariane | ✓ | ✓ | – | – | – | recém-entrou; classifier vai rodar |
| fdbc1822 | Edmara | ✓ | ✓ | – | – | – | classifier OK, campos extra **apagados** em 21/jun |
| 9daddb44 | Ednaldo | ✓ | ✓ | – | – | – | classifier OK, campos extra **apagados** em 21/jun |
| 4f82d8e5 | Gabriela | ✓ | ✓ | – | – | – | classifier **falhando** desde 18/jun (schema) |
| c7d84fa3 | Giovanna | ✓ | – | – | – | – | classifier **falhando** (schema) — várias tentativas hoje |
| 34351be1 | Jaqueline | ✓ | ✓ | ✓ | – | – | classifier **falhando** (schema) |
| 0ee236df | Juliana Alves | ✓ | ✓ | – | – | – | classifier OK, campos extra **apagados** em 21/jun |
| fdb73c36 | Lead #7171022 | ✓ | ✓ | – | – | – | classifier OK, campos extra **apagados** |
| dd387d25 | Márcia/Beatriz | ✓ | ✓ | – | – | – | classifier OK, campos extra **apagados** |
| 135cb78a | Marina | ✓ | ✓ | ✓ | – | – | OK |
| 7be2e675 | Monique | ✓ | ✓ | – | – | – | classifier OK; é **B2B** (Senne Liquid) — ver §4 |
| d7a9528f | Patty Araujo | ✓ | ✓ | – | – | – | classifier OK, extras **apagados** |
| c42b41f1 | Rafael Savassi | ✓ | – | – | – | – | classifier OK, mas é **renovação de receita**, não consulta |
| 0d23bf1c | Valéria Godoy | ✓ | – | – | – | – | **interno** (psicóloga parceira) |

**Diagnóstico de fundo (🔴 bug):** olhando os eventos `custom_fields_changed` de 21/jun (escapeable em `dry-run-pr2/`), o classifier produziu patches onde múltiplas chaves não-canônicas vão de `from: <valor>` para `to: null`. Exemplo `c7d84fa3`:

```
atendente:            "Marisa"   → null
codigo_fila:          "6f24..."  → null
interesse_em:         "consulta" → null
deseja_agendar:       true       → null
motivo_consulta:      "depressão"→ null
primeira_consulta:    true       → null
solicitou_valores:    true       → null
```

Isso é **dano colateral do enforcement da whitelist** em `apply.ts` do classifier. Sintoma: campos preenchidos pelo formulário de entrada (ou pelo classifier antigo) são apagados ao primeiro pass do novo Preenchedor. **Recomendo PR separado:** apply deve fazer **merge não-destrutivo** — só sobrescrever keys que apareçam explicitamente no patch, nunca setar `null` automaticamente.

---

## 3) Tags / Chips

| Lead | Tags atuais | Avaliação |
|---|---|---|
| fdbc1822 | `lead-phq9, 1a_consulta, interesse_psiquiatria, agendamento_pendente` | OK; `agendamento_pendente` sinaliza que precisa cobrar data |
| fdb73c36 | (1 tag, não inspecionada nesta amostra) | OK |
| 135cb78a | (1 tag) | OK |
| **Outros 11 leads** | vazio | classifier rodou mas não atribuiu tag por falta de sinal específico OU por erro de schema. **Comportamento correto:** sem sinal claro de welcome/urgência/objeção/etc, fica vazio. Não há "tag default" para Qualificação. |

**Nenhuma tag antiga/obsoleta pendurada.** Não há nada a remover.

---

## 4) Movimentação por conteúdo (sugerida)

Releitura do resumo + tipo de conversa de cada lead com sinal claro:

| Lead | Nome | Etapa atual | Sugerida | Justificativa |
|---|---|---|---|---|
| 0d23bf1c | Valéria Godoy | Qualificação | **B2B / Stakeholders** | `is_internal_contact=true`, é psicóloga parceira (73 msgs, conversa de coordenação, não paciente). |
| 7be2e675 | Monique Pontes - Financeiro | Qualificação | **B2B / Stakeholders** | Representante comercial (Senne Liquid); patches mostram `orcamento_solicitado=true`, `contato_representante=true`. |
| c42b41f1 | Rafael Savassi | Qualificação | **Em tratamento** ou tag `renovacao_receita` | Patch mostra `medicamentos_solicitados=Donarem 50mg…Venvanse 70mg…`, `prazo_retirada=7 dias úteis`. É paciente em uso, pedindo receita. |
| 0ee236df | Juliana Alves | Qualificação | **Tratamento agendado** (voltar) | Estava em Tratamento agendado e foi rebaixada por `field_rule:Qualificação (interessado)` em 17/jun. Tem 45 msgs e patch antigo com "confirmou agendamento cetamina para amanhã às 08:00". Investigar se o rebaixe foi correto. |

Os demais 10 ficam em Qualificação até o gatilho de 7d.

**SQL pronto (não executado):**

```sql
-- 1) Valéria Godoy → B2B
UPDATE leads SET stage_id='23a7bfd7-2baf-4d0f-8ed1-2b59b719020d', stage_changed_at=now()
WHERE id='0d23bf1c-d7c3-4d24-87c3-…';   -- completar UUID

-- 2) Monique Pontes → B2B
UPDATE leads SET stage_id='23a7bfd7-2baf-4d0f-8ed1-2b59b719020d', stage_changed_at=now()
WHERE id='7be2e675-…';

-- (Não emitir UPDATE para Rafael nem Juliana sem revisar conversa manualmente)
```

> Não rodei nada. Aguardo o seu OK por lead.

---

## 5) Movimentação por tempo

Coberto na §1 + nota da §1: nenhum lead ultrapassou 7d ainda. O `pipeline-deterministic` está com **todas as flags relevantes ligadas** (`followup_7d_nutricao.enabled=true`, `inactivity_paciente_antigo.enabled=true`) e roda no cron `inactivity-tick`. Vai movimentar sozinho conforme cada lead cruzar o threshold.

Se quiser **adiantar** os 7 leads que estão com 5–6d (Edmara, Márcia, Gabriela, Juliana, Patty, Rafael, Monique), basta antedatar `last_message_at`. Não recomendo — perde rastreabilidade.

---

## 6) Bloqueios e próximos passos sugeridos (ordenados por impacto)

1. **🔴 PR5 — Apply não-destrutivo** do classifier. Fix em `supabase/functions/pipeline-classify/apply.ts` para que campos não citados no patch fiquem intactos (hoje a whitelist nuke campos extras). Sem isso, todo lead vai perdendo histórico de campos a cada classify.
2. **🟡 Confirmar deploy** das mudanças do PR anterior (retry + schema relaxado). Hoje (22/jun) ainda houve 3 falhas `No object generated: response did not match schema` em Giovanna/Gabriela/Jaqueline. Possíveis causas:
   - Edge function ainda não foi redeployada (verificar logs).
   - O retry funcionou, mas o **segundo** retry também falhou (caso raro, mas existe).
   - Outro caminho de código (V1 dispatch?) sendo usado em vez do V2. Conferir `automation.classifier.version="v2"` ✓ está ok.
3. **🟢 Aplicar §4** após sua aprovação — mover Valéria + Monique para B2B/Stakeholders.
4. **🟢 Decisão sobre `last_message_at` vs `last_inbound_at`** na regra de 7d. PR separado pequeno.

---

## Apêndice — Comandos de verificação

```bash
# Re-checar inatividade
psql -c "
WITH s AS (SELECT 'c6eb67f3-cba9-41e5-949c-aa12d34d962d'::uuid AS stage)
SELECT substring(l.id::text,1,8), l.name,
       EXTRACT(day FROM now()-l.last_message_at)::int AS d_msg
FROM leads l, s WHERE l.stage_id=s.stage ORDER BY d_msg DESC;"

# Re-checar erros recentes do classifier para esta coluna
psql -c "
SELECT substring(lead_id::text,1,8), payload->>'skipped', created_at
FROM lead_events
WHERE type='auto:classifier' AND payload->>'skipped' LIKE 'agent_error%'
  AND created_at > now()-interval '2 days'
ORDER BY created_at DESC;"
```
