---
title: "Pipeline — Custom fields e tags (V6)"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "Catálogo V6 de custom_fields, enums, whitelist de tags e diretrizes estritas do Preenchedor (Tipificador), com forte ênfase na Autoridade da Secretária e G10 via Banco de Dados."
related_docs:
  - docs/pipeline/DATABASE.md
  - docs/pipeline/runtime/CLASSIFIER.md
---

# Custom fields e tags — Referência completa (V6)

Na arquitetura de 5 Agentes, a responsabilidade de preencher estes dados recai exclusivamente sobre o **Agente 3 (Preenchedor / Tipificador)** e o **Agente 1 (Resumidor, apenas para datas extraídas)**.

## Custom fields principais (`lead_custom_fields`)

Valores residem em `leads.custom_fields jsonb`. 

| Chave | Tipo | Enum / Regra | Responsável Primário |
|---|---|---|---|
| `modalidade` | text | `presencial \| online \| qualquer` | Agente 3 / Humano |
| `interesse_tratamento` | text[] | multi: `cetamina \| emt \| consulta_psiquiatria \| hipnose \| outro \| nenhum` | Agente 3 / Humano |
| `interesse_consulta` | text[] | multi: Nomes de profissionais ou especialidades | Agente 3 / Humano |
| `status_financeiro` | text | `pendente \| parcial \| pago \| reembolsado \| cancelado \| isento \| nao_se_aplica` | **Humano / Autoridade da Secretária** |
| `pagamento_alegado_em` | timestamptz | ISO Timestamp | Agente 3 |
| `status_consulta` | text | `agendada \| realizada \| faltou \| cancelada \| reagendada` | Humano / Autoridade da Secretária |
| `motivo_cancelamento` | text | `paciente_cancelou \| clinica_cancelou \| outro` | Agente 3 / Humano |
| `qualificacao` | text | `em_qualificacao \| qualificado \| desqualificado` | Agente 3 / Humano |
| `motivo_desqualificacao` | text | `servico_nao_oferecido \| especialidade_nao_atendida \| contato_por_engano \| fora_da_regiao \| demanda_incompativel \| outro` | Agente 3 / Humano |
| `tipo_atendimento` | text | `primeira_consulta \| retorno \| procedimento` | Agente 3 / Humano |
| `convenio` | text | livre | Agente 3 / Humano |
| `valor_combinado` | number | livre | Humano |
| `nome_responsavel_financeiro` | text | livre | Agente 3 |
| `possui_liminar_judicial` | boolean | true / false | Agente 3 |
| `consulta_agendada_em` | timestamptz | ISO (Extraído cru) | **Agente 1 (Resumidor)** |
| `procedimento_agendado_em` | timestamptz | ISO (Extraído cru) | **Agente 1 (Resumidor)** |

### A Regra de Ouro: Autoridade da Secretária

O Agente 3 (Preenchedor) e o Agente 4 (Movimentador) operam sob uma diretriz estrita: **O paciente mente ou se confunde, a clínica (secretária) é a fonte da verdade.**

1. **Pagamentos**: Se o paciente disser "já paguei", a IA **NÃO** deve alterar `status_financeiro` para `pago`. Em vez disso, a IA deve aplicar a TAG `pagamento_alegado` e preencher `pagamento_alegado_em`. O status oficial de pagamento só muda quando a secretária confirma o recebimento no chat.
2. **Agendamentos**: Se o paciente disser "vou amanhã às 14h", a IA pode extrair a data, mas não deve confirmar o lead para "Consulta agendada" ou "Tratamento agendado" a menos que a secretária também confirme esse agendamento com um template ou mensagem clara.

## Gate G10: Proteção de Edições Humanas

Sempre que a secretária altera um Custom Field na UI, o trigger de banco de dados grava a alteração no campo `custom_fields_last_human_edit`.
Durante **7 dias**, a IA é expressamente proibida de sobrescrever aquele campo.
*Exceção:* O Resumidor (Agente 1) pode sobrescrever campos de data (`consulta_agendada_em`, `procedimento_agendado_em`) mesmo dentro do período de G10, caso identifique que o paciente e a clínica combinaram uma nova data no chat (exigindo confidence ≥ 0.85).

---

## Tags — Whitelist Canônica (V6)

A automação só pode aplicar tags que estejam nesta whitelist. As tags protegidas não podem ser removidas pela IA.

### Tags Protegidas (IA Nunca Remove)
- `risco_clinico` — (Inserida por triggers)
- `b2b` 
- `vip` 
- `paciente_antigo`
- `precisa_atencao_humana`
- `Lock manual`
- `lock_manual`

### Tags dinâmicas sugeridas pela IA ou Triggers

| Tag | Aplicada por | Condição |
|---|---|---|
| `pagamento_alegado` | Agente 3 / Movimentador | Paciente diz ter pago, mas sem confirmação da clínica. |
| `1ª consulta` | Agente 3 | Lead novo; IA obrigatoriamente remove se achar histórico de tratamento. |
| `welcome_sent` | Triggers do Evolution | Primeira mensagem do sistema enviada. |
| `urgencia_clinica` | Agente 3 | Risco iminente relatado. |
| `reativacao` | Triggers/Hooks | Lead em Sem resposta/Nutrição volta a falar. |
| `no_show` | Hooks | Paciente faltou à consulta oficial. |
| `reagendamento_pendente` | Agente 3 / Hooks | Consulta desmarcada mas ainda sem data nova. |
| `agendamento_sugerido` | Agente 3 | Paciente manifestou intenção clara de agendar. |
| `judicializacao` | Agente 3 | Menção a liminares, advogados ou processos. |
| `precisa_atencao_humana` | Maestro (IA) / Auditor | Quando a IA fica com confiança < 0.6 ou o Auditor diário discorda da posição do lead no funil. |

### Remoção de Tags

A partir da V6, o LLM não envia mais uma lista de "tags a remover".
O arquivo `apply.ts` computa deterministicamente a remoção: `currentTags - tags_suggested - PROTECTED_TAGS`. Assim, se a IA não sugerir uma tag que estava presente (e não for protegida), ela cai.
A tag `precisa_atencao_humana` só pode ser removida por um humano.
