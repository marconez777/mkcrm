---
title: "Tags e Campos Personalizados — Clínica ÓR (Detalhes do Lead)"
topic: kanban
kind: reference
audience: agent
updated: 2026-08-06
summary: "Mapeamento completo dos 23 campos customizados e tags da Clínica ÓR, detalhando a mecânica da UI (ContextRail) e governança da IA (Lovable Classifier)."
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
code_refs:
  - supabase/functions/pipeline-classify/
  - src/components/inbox/CustomFieldsPanel.tsx
  - supabase/functions/pipeline-deterministic/
related_docs:
  - docs/tenants/clinica-or/README.md
  - docs/pipeline/runtime/FIELDS_LIVE.md
  - docs/features/LEAD_DETAILS.md
---

# Tags e Campos Personalizados — Clínica ÓR (Detalhes do Lead)

Este documento atua como o manual definitivo de como a Aba de Detalhes (`ContextRail`) se comporta especificamente para a **Clínica ÓR** (Tenant `cf038458-457d-4c1a-9ac4-c88c3c8353a1`). Ele amalgama a infraestrutura técnica detalhada no [LEAD_DETAILS.md](../../features/LEAD_DETAILS.md) com os 23 campos reais de produção da Clínica ÓR listados no [FIELDS_LIVE.md](../../pipeline/runtime/FIELDS_LIVE.md).

---

## 1. Mapeamento de Campos Personalizados (UI vs Backend)

Todos os campos abaixo são gerenciados atomicamente (anti Lost-Update) através da RPC `merge_lead_custom_fields`, evitando que IA e Humanos sobrescrevam dados um do outro. O Gate G10 (bloqueio de 7 dias) protege edições humanas.

### A) Campos Virtuais de Agendamento (UI Injetada)
A Clínica ÓR possui tipos ativos em `clinic_appointment_types` que geram estes campos "virtuais" no topo do painel:
- **`consulta_agendada_em`** (Data da consulta):
  - **Mecânica:** Renderizado como um DatePicker (`CalendarIcon`).
  - **IA:** O classificador tem a intenção de preencher datas, mas o **Gate G11** proíbe o agendamento autônomo. Hoje, a IA cria apenas uma _tarefa_ com a tag de sugestão, aguardando aprovação humana.
- **`procedimento_agendado_em`** (Data do procedimento): Mesmo comportamento da consulta.

### B) Campos de Informação e Atendimento (Formulário/Humano)
Preenchidos inicialmente via Lead Source (Formulários do Site) ou pela Secretária.
- **`interesse`** (Select): Exibe dropdown com opções (Cetamina, EMT, Depressão, etc). 
- **`procedimentos`** (Multiselect): Comporta seleção múltipla via Checkboxes na UI.
- **`teleconsulta`** (Boolean): Aparece como um Switch liga/desliga (escala de 75% na UI).
- **`link_consulta`** (URL): Se preenchido, a UI injeta um ícone `ExternalLink` clicável ao lado.
- **`pagamento`** (Currency): O front-end injeta "R$" dependendo da região e impede digitação de letras.
- **`mensagem`** (Textarea): Utiliza o `ResizableTextareaField`. Se a secretária aumentar o tamanho da caixa de texto, a UI memoriza a altura via `localStorage` e a mantém assim em futuros leads.
- **`origem`** (Select): Select auxiliar para a campanha/utm.
- **`modalidade_preferida`** (Select): Presencial, online, indiferente. Alterar para online pode disparar um alerta/tag de validação (modality-guard).

### C) Campos Atualizados via Backend / Webhooks
Estes campos constam no JSONB, mas a secretária não deve editá-los manualmente em fluxo normal, pois a automação os gerencia:
- **`status_financeiro`** (Select: pendente, parcial, pago): Atualizado ativamente pelo `pipeline-payment-webhook` (ex: após baixa na Pagar.me/Stripe).
- **`status_consulta`** (Select): O webhook `auto:appointment-sync` espelha o status do calendário aqui.
- **`sessoes_realizadas`** (Number): Incrementado em +1 pela automação sempre que a consulta passa para "Realizada".

### D) Campos Operados Estritamente pela IA (Lovable Classifier)
Estes são os "olhos da IA" dentro do `lead_custom_fields`:
- **`interesse_consulta`** e **`interesse_tratamento`** (Booleans): A IA usa a leitura de intenção (intent) para marcar `true` aqui e moldar a jornada.
- **`nome_responsavel_financeiro`** (Text): A IA detecta se a pessoa no WhatsApp é a mãe/filho do paciente e anota aqui para não sujar o campo `leads.name` (que deve ser o nome da pessoa na linha telefônica).
- **`pagamento_alegado_em`** (Datetime): A IA preenche se o lead disser "já paguei" no WhatsApp antes do Webhook confirmar.

### E) Governança
- **`ciclo_concluido`** (Boolean): Gatilho manual hiper-agressivo. Ao virar `true`, o Rule Engine move o lead para o funil/etapa de "Paciente Antigo".
- Outros: `saldo_sessoes_pacote`, `motivo_cancelamento`, `possui_liminar_judicial`, `data_solicitacao_nf`.

---

## 2. Tags e Chips de Automação (A Mente da Clínica ÓR)

Ao lado dos campos, a IA e o sistema gerenciam a array `lead.tags` através de um processo restrito de *Whitelist* configurado em `app_settings.automation.v42.allowed_tags`.

### A) Tags Automáticas de Estágio (Rule Engine)
Movimentações de colunas no Kanban injetam magicamente estas tags sem intervenção humana, graças à configuração `auto_tag_on_enter`:
- **Sem Resposta:** `sem_resposta`
- **Nutrição Inativa:** `nutricao_inativa`, `segmento_nutricao_leads`
- **Paciente Antigo:** `paciente_antigo`, `segmento_paciente_antigo`
- **Consulta/Tratamento Finalizado:** Injeta as tags `_mes` e `segmento_relatorio_dia1` para relatórios mensais.

### B) Tags Sugeridas pela IA (Classificador)
O robô só pode colocar tags se elas constarem na whitelist. Alucinações são descartadas em runtime.
- **`urgencia_clinica`**: Detectou risco iminente no texto do WhatsApp.
- **`precisa_atencao_humana`**: Emitida em 3 casos vitais: 
   1. LLM com Confiança < 0.6.
   2. Auditores A1/A2 discordam veementemente do próximo passo.
   3. Fluxo (Gate) bloqueado por regra conflitante.
   *A remoção desta tag pela secretária (clicando no X) instrui o sistema de que o lead foi destravado humanamente.*
- **`b2b`**: IA detectou contato de parceiro/empresa, gerando movimento de limpeza para fora do funil padrão.
- **`agendamento_sugerido`**: Injetado pela IA ao lado da criação da Tarefa na tela (`LeadTasksPanel`) para aprovação do agendamento.
