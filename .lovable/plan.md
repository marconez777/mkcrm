
# Diagnóstico — 1ª coluna do pipeline ÓR ("Leads de entrada") — revisado

Pipeline: `Clínica ÓR` (`17c27f4d…`) · Stage: `Leads de entrada` (`b1aa2fc9…`) · 8 leads.

## 1) Campos personalizados — o que falta e por quê

Schema da clínica define 23 chaves canônicas (`interesse`, `procedimentos`, `tipo_contato`, `status_consulta`, `pagamento`, `status_financeiro`, etc.).

| Lead | custom_fields hoje | Diagnóstico |
|---|---|---|
| 08453c76 (5511994709447, sem nome) | `{}` | Bot de farmacovigilância (PT/ES). Classifier rodou (`last_classified_at` preenchido) mas não extraiu nada — esperado p/ spam. |
| 36a85fd2 Neto (+1 407…) | `demonstrou_interesse`, `procedimento_interesse=seguimento` | **`last_classified_at = NULL` → classifier nunca rodou**. Telefone +1 pode estar caindo em filtro. |
| 26109147 Ariane | `demonstrou_interesse`, `procedimento_interesse=cetamina` | Classifier escreveu em **chaves legadas** que não existem no schema da ÓR. Os campos canônicos (`interesse`, `procedimentos`) ficaram vazios. |
| efeb8aaa Aline | mistura legada + `form_submission` (CTA Cetamina) | `procedimentos=["Infusão de cetamina"]` OK, mas `interesse` (select canônico) vazio. |
| 7a2df6c0 Rafael | `tipo_contato=paciente`, `contato_eh_terceiro=false` | **Spam** (imagem com convite p/ evento). Classifier não tem texto → nada a extrair. Comportamento correto. |
| a1b8832b Ricardo | só `pagamento_alegado_em` | 17 mensagens, pagamento + NF concluídos. `pagamento`, `status_financeiro`, `interesse`, `procedimentos` ficaram vazios apesar dos dados estarem na conversa. |
| e23295cd Andrea | `mensagem`, `observacoes`, `demonstrou_interesse` | Conversa B2B; `tipo_contato`/`interesse` não preenchidos. |
| 4d140ec4 (sem nome) | `tipo_contato`, `contato_eh_terceiro` | 1 mensagem inbound vazia — nada a extrair. |

**Causas raízes**
- (A) Classifier grava em **chaves legadas** (`demonstrou_interesse`, `procedimento_interesse`) em vez das chaves do schema da clínica (`interesse`, `procedimentos`).
- (B) Neto (+1) nunca foi classificado — investigar filtro de DDI.
- (C) Em leads ricos (Aline, Ricardo), classifier ignora campos clínicos óbvios (`pagamento`, `status_financeiro`, `procedimentos`).

## 2) Chip (WhatsApp instance)

Chips da ÓR: `Recepção` (default), `Disparo pacientes`, `prospecção medico`. Nenhum chip antigo pendurado nos 8 leads.

Nota sobre Rafael: o registro guarda `whatsapp_instance_id = 40afc571` (`prospecção medico`), mas é spam e na UI o chip não aparece — irrelevante para o caso. **Não há ação de roteamento por chip necessária**; fica como observação para futura limpeza.

## 3) Movimentação de estágio — quem deveria ter saído

Histórico mostra 5 leads movidos em lote em 2026-06-17 22:44:01 vindos de stages inexistentes (`79746e04…`, `d6de683c…`) — resíduo do bug cross-clinic já corrigido. Depois disso ninguém promoveu.

| Lead | Estágio sugerido | Por quê |
|---|---|---|
| 08453c76 | Desqualificado / Fora de escopo | bot farmacovigilância |
| 7a2df6c0 Rafael | **Desqualificado / Fora de escopo** | spam (convite evento sexualidade) |
| 36a85fd2 Neto | Qualificação (após reclassificar) | demonstrou interesse em seguimento |
| 26109147 Ariane | Qualificação | 24 msgs qualificando cetamina |
| efeb8aaa Aline | Qualificação | conversa clínica ativa |
| a1b8832b Ricardo | Tratamento agendado / Em tratamento | pagamento + NF concluídos |
| e23295cd Andrea | B2B / Stakeholders | propostas comerciais |
| 4d140ec4 | Sem resposta | inbound sem follow-up há 6+ dias |

**Causa raiz da estagnação**: não há automação que promova `Leads de entrada → Qualificação` por classificação, nem regra "sem resposta após N horas" ativa neste pipeline.

---

# Plano de correção

## Parte A — Higiene imediata (data fix dos 8 leads)

1. Rafael (`7a2df6c0`) → `Desqualificado / Fora de escopo` (`35670cad…`).
2. 08453c76 → `Desqualificado / Fora de escopo`.
3. Andrea (`e23295cd`) → `B2B / Stakeholders` (`23a7bfd7…`).
4. Ricardo (`a1b8832b`) → `Tratamento agendado` (`98320189…`); preencher `status_financeiro=pago` e `pagamento` (valor se conhecido).
5. Ariane (`26109147`) e Aline (`efeb8aaa`) → `Qualificação` (`c6eb67f3…`).
6. 4d140ec4 → `Sem resposta` (`9f408ae6…`).
7. Manter Neto (`36a85fd2`) em `Leads de entrada` até reclassificar (Parte B.2).

Cada move grava `lead_stage_history` com `clinic_id=cf038458…`, `source='manual'`, `reason='data fix 2026-06-21'`.

## Parte B — Causas raízes (código)

**B.1 — Classifier escreve nas chaves canônicas**
- Atualizar `lead-classifier` (edge function) para mapear saída nas chaves do schema (`interesse`, `procedimentos`, `tipo_contato`, `status_consulta`, `pagamento`, `status_financeiro`) e **parar de gravar** chaves legadas.
- Migration única reescrevendo `procedimento_interesse → interesse` e removendo `demonstrou_interesse` nos leads da ÓR.

**B.2 — Filtro de DDI**
- Investigar por que `36a85fd2` (+1) nunca foi classificado. Remover/ajustar filtro que ignora não-BR.

**B.3 — Promoção automática `Leads de entrada → Qualificação`**
- No classifier (ou em automação dedicada), promover stage quando intenção qualificada for detectada com confiança ≥ threshold. Gravar `lead_stage_history` com `source='ai'`.

**B.4 — Regra "Sem resposta"**
- Automação no pipeline ÓR: lead em `Leads de entrada` há > 48h sem inbound novo → `Sem resposta`.

## Detalhes técnicos

- Toda movimentação respeita o trigger `trg_leads_enforce_coherence`.
- Schema de campos canônicos vive em `lead_custom_fields` filtrado por `clinic_id`.
- Localizar edge function do classifier em `supabase/functions/` antes de editar.

## Fora de escopo

- Roteamento por chip (`watcher_pipeline_id`) — removido após esclarecimento sobre Rafael.
- Alterar schema de `lead_custom_fields` da ÓR.
- Mexer em outras clínicas/pipelines.
