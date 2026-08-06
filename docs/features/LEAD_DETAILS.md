---
title: "Aba de Detalhes do Lead (Context Rail)"
topic: kanban
kind: reference
audience: both
updated: 2026-08-06
summary: "Catálogo completo, características e dependências de todos os campos exibidos na aba de Detalhes do Lead (ContextRail.tsx), conectando Front-end, IA e Backend."
code_refs:
  - src/components/inbox/ContextRail.tsx
  - src/components/inbox/CustomFieldsPanel.tsx
  - src/components/inbox/LeadOriginField.tsx
  - src/pages/LeadDrawer.tsx
related_docs:
  - docs/pipeline/runtime/FIELDS_LIVE.md
  - docs/pipeline/CUSTOM_FIELDS_E_TAGS.md
---

# Aba de Detalhes do Lead (Context Rail)

Este documento detalha o comportamento, restrições e relacionamentos com a IA de todos os campos renderizados dentro da aba de **Detalhes** no painel de conversa do lead (`LeadDrawer.tsx` → `ContextRail.tsx`).

## 1. Resumo IA (AI Summary)
- **Onde vive:** `lead.ai_summary` na tabela `leads`.
- **Comportamento:** A IA não o atualiza espontaneamente a cada mensagem. Ele é acionado manualmente via botão "Gerar" na interface.
- **Integração:** Ao clicar, a UI chama a Edge Function `ai-assist` passando `mode: "summary"` e o `lead_id`. O Supabase processa a conversa e retorna o resumo.
- **Risco/Lock:** Nulo. Sobrescrito livremente quando o usuário pedir nova geração.

## 2. Origem (`LeadOriginField`)
Componente dedicado: `LeadOriginField.tsx`.
- **Campos envolvidos:** `origin_channel`, `origin_label`, `origin_source_type`, `origin_locked_by_user`, `origin_updated_at`, `origin_detail`.
- **Comportamento Automático:** Preenchido inicialmente por UTMs de captura ou webhooks de entrada.
- **Lock Manual:** Se o atendente alterar este campo no select, o sistema atualiza `origin_locked_by_user = true` e o `origin_source_type = "manual:user"`. Um ícone de cadeado (`<Lock />`) aparece.
- **Dependência:** A IA e os webhooks respeitam o lock. Eles jamais sobrescrevem a origem caso o humano a tenha classificado na mão.

## 3. Painel Principal (Campos Personalizados e Virtuais)
Componente dedicado: `CustomFieldsPanel.tsx`. Lida com o JSONB do banco.

### A) Prevenção de Lost Update (PostgreSQL RPC)
As atualizações **não** enviam o objeto inteiro de `custom_fields` de volta. Como a IA e o humano podem editar os campos no mesmo milissegundo, a UI despacha o payload via RPC local chamada `merge_lead_custom_fields`. Isso garante soma de chaves seguras a nível de banco de dados, permitindo trabalho simultâneo (Humano vs Automação) sem atropelamentos.

### B) Campos Virtuais de Agendamento
- **Chaves comuns:** `consulta_agendada_em`, `procedimento_agendado_em`, etc.
- **Origem:** O painel pesquisa a tabela `clinic_appointment_types` (se `is_active = true`). Para cada tipo, cria dinamicamente na UI um campo tipo data/hora, injetando-os acima dos campos normais.
- **Comportamento:** Salvam timestamps ISO puros (`2026-08-03T17:00...`) dentro do `lead_custom_fields` final.

### C) Campos Personalizados Comuns
Baseiam-se nas regras contidas na documentação de *Campos Reais* (`FIELDS_LIVE.md`).
- **Interesse / Procedimentos / Teleconsulta:** A UI formata adequadamente com switches e multi-selects.
- **Pagamento (Currency):** Usa a função interna de localização para colocar R$ com formatação rigorosa de números (corta formatação antes de enviar via RPC).
- **Link de Consulta (URL):** Adiciona o ícone de external-link quando preenchido para acesso rápido ao meet/zoom.

## 4. Campos Nativos (Hardcoded no Context Rail)
Abaixo dos campos dinâmicos, temos mapeamentos diretos da tabela `leads`:

- **Funil (`pipeline_id`)**: Se trocado, o sistema automaticamente vasculha a primeira etapa (Stage) existente naquele funil e obriga o lead a cair nela, para impedir leads "órfãos".
- **Etapa (`stage_id`)**: Dispara `stage_changed` na timeline de eventos (`lead_events`), e roda o avaliador da IA.
- **Atendente (`attendant_id`)**: Alterar emite um log global `attendant_changed`.
- **Valor (`deal_value`)**: Armazena inteiros.
- **E-mail (`email`)**: Input texto padrão.
- **Origem do formulário (`form_source`)**: Sofre sanitização forte no `onBlur` via RegEx (`slugify` invisível). Remove acentos, caracteres especiais, bota minúsculas e recorta o tamanho. Impede banco "sujo".

## 5. Tags (`lead.tags`)
- **Comportamento UI:** Array simples alimentado por input que escuta o `Enter`. O usuário clica no `X` para remover.
- **Relação com IA:** A IA tem permissão restrita para escrever tags de uma whitelist (como `#precisa_atencao_humana`, `agendamento_sugerido`). A exclusão manual de tags de automação é um sinal forte da equipe que as views gerenciais monitoram (ex: remover a tag de trava resolve o atendimento).

## 6. Notas (`lead.notes`)
- **Comportamento UI:** `Textarea` livre de rica formatação.
- **Dependência:** Usa Auto-save debounced em 800ms. Cada keystroke congela e salva silenciosamente, informando um aviso "salvando..." do lado da label (isso minimiza perdas de rascunhos caso o atendente pule pro próximo lead no painel lateral do Kanban).

## 7. Componentes Extra (Widgets)
- **Tarefas (`LeadTasksPanel`)**: Query à parte vinculada na tabela `tasks`.
- **Agendamentos (`ScheduledMessagesPanel`)**: Query na tabela `scheduled_messages`.
- **Histórico IA**: Ferramenta de auditoria local (para Admins). Abre e carrega sob-demanda (via join com `ai_threads` e `ai_messages`), mostrando o prompt da IA, os raciocínios (tool_calls) e a string retornada pelo modelo que originou ações no lead. Serve como "Raio-X".
