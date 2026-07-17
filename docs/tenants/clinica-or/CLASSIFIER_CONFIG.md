---
title: "Configuração do Agente Classifier: Clínica ÓR"
topic: kanban
kind: reference
audience: agent
updated: 2026-07-17
summary: "Referência completa da injeção dinâmica de prompts, regras e automações de WhatsApp da Clínica ÓR no pipeline_tenant_classifiers."
code_refs:
  - supabase/functions/pipeline-classify/
  - src/pages/Automations.tsx
---

# Clínica ÓR: Configuração do Classifier e Automações

A Clínica ÓR opera sob a configuração base de fallback (V6). Estes são os parâmetros exatos que estão rodando no banco de dados (`pipeline_tenant_classifiers`) para a Clínica ÓR.

## 1. Regras Globais do Tenant

- **Intenções Permitidas (`allowed_intents`)**: 
  `["nenhum", "novo_agendamento", "reagendamento", "cancelamento", "duvida_agenda", "duvida_clinica", "duvida_financeira", "solicitacao_documento", "reclamacao", "objecao", "desistencia", "b2b_parceria", "spam", "nf_reembolso", "pagamento_alegado", "judicializacao", "renovacao_receita"]`
- **Estágios Travados (Lock Humano)**: 
  `["Consulta agendada", "Tratamento agendado", "Consulta finalizada", "1ª Sessão Finalizada"]`
- **Agentes Ativos**: `["summarizer", "agendador", "typifier", "movimentador", "maestro"]`

---

## 2. Prompts Injetados (Override)

### 2.1 Resumidor
**Foco:** Extrator clínico rigoroso. O Resumidor separa claramente "PASSADO" (histórico) de "PRESENTE". 
- **Trava Secreta:** "A palavra da secretária vale mais que a do paciente."
- **Detecção de Template:** Se for primeira mensagem (via botão), não inventa intenção, apenas extrai origem.
- O Resumidor extrai todas as datas cruas via `mentioned_dates` para que a Edge faça o parsing determinístico em UTC.

### 2.2 Agendador
**Foco:** Descobrir se a intenção da conversa é `is_scheduling_action` (novo, reagendamento, cancelamento). Ele não tenta extrair a data exata (pois isso já vem do parser determinístico do `mentioned_dates`), foca estritamente no desejo do paciente.

### 2.3 Tipificador (Preenchedor)
**Foco:** Gerar `tags_suggested` e `custom_fields_patch`.
- Recebe a lista dinâmica de Tags da clínica via `{{TAG_LIST}}`.
- Recebe o schema de campos customizados via `{{KEYS_BLOCK}}`.
- Jamais sobrescreve o campo `origem` se o humano já tiver editado.

### 2.4 Movimentador
**Foco:** Gerar o `stage_suggestion` baseando-se no KanBan da clínica `{{CANON_NAMES}}`.
- Regra de Paciente Antigo: Se pede "renovação de receita", sugere *Paciente Antigo*, não *Qualificação*.
- B2B Estrito: Somente representantes/farmácias. Se agendar para terceiros, o lead é paciente normal.

### 2.5 Maestro (Validador)
**Foco:** Cruzamento e Resolução de Conflitos.
- Conflito: Agendamento vs Desqualificação → A Desqualificação vence sempre.
- Garante a aplicação do Lock Humano para "Consulta agendada".
- Confiança Média < 0.6: Se os 3 agentes discordarem frontalmente, ele retorna baixa confiança e a movimentação é bloqueada (gerando a flag de `precisa_atencao_humana`).

---

## 3. Automações de WhatsApp (UI de IA)

A Clínica ÓR utiliza a tela de "Configurações de Automações" (`src/pages/Automations.tsx`) que não atua no Kanban diretamente, mas injeta ações (como enviar mensagem no WhatsApp ou mudar de estágio passivamente) através da Edge Function paralela `automations-tick`.

### Gatilhos Comuns na Clínica ÓR
1. **Lembrete de Consulta (D-1):** 
   - **Gatilho:** `before_appointment`
   - **Como funciona:** O script lê um `custom_field` de data criado para a clínica (ex: Data da Consulta) e envia um **Template Oficial de WhatsApp** (`send_template`) 24h ou algumas horas antes da marcação.
2. **Lead Sem Resposta (Recuperação):** 
   - **Gatilho:** `no_reply_after`
   - **Como funciona:** Se o lead estiver na fase "Novo" e não tiver recebido ou enviado mensagem há 24h, o sistema dispara uma Ação: `ai_followup`. O agente LLM gera uma mensagem amigável contextualizada retomando a conversa.
3. **Estágio Parado (Nurture Automático):**
   - **Gatilho:** `stage_idle`
   - **Como funciona:** Se o card ficar estagnado por X dias em "Qualificação", a ação `move_stage` o envia automaticamente para "Nutrição inativa".

## Mapeamento de IDs (Pipeline ÓR)

Como o sistema é Multi-Tenant, sempre utilize os IDs canônicos abaixo ao realizar alterações diretas no banco de dados para a Clínica ÓR (`cf038458-457d-4c1a-9ac4-c88c3c8353a1`).

| Nome da Coluna | ID (`stage_id`) |
| :--- | :--- |
| Leads de entrada | `b1aa2fc9-d221-4d4f-b53a-7303ec4b75b0` |
| Qualificação | `c6eb67f3-cba9-41e5-949c-aa12d34d962d` |
| Sem resposta | `9f408ae6-649e-44b2-bc56-f93d138c87ed` |
| Consulta agendada | `e12f004a-6445-4815-8d6b-22f928507a9a` |
| Consulta finalizada | `7584241f-6e4b-4824-aaea-e271e865227d` |
| Tratamento agendado | `98320189-6002-4f75-b99d-0b407189efe8` |
| 1ª Sessão Finalizada | `2a352661-01e2-41f8-be10-032f803e2387` |
| Paciente antigo | `7fea97d7-c2af-4e6f-8f39-af8375bb4468` |
| Nutrição Antigos | `9de8e54e-7edb-47dd-b613-de22276d8ea1` |
| Nutrição Inativa | `64356dbe-3889-4b49-9429-260501cdb3d8` |
| B2B / Stakeholders | `23a7bfd7-2baf-4d0f-8ed1-2b59b719020d` |
| Desqualificado / Fora de escopo | `35670cad-3f95-4e11-8f73-e8b27b865f89` |
