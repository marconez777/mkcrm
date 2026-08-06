---
title: "Documentação de Linha do Tempo Humana"
topic: operations
kind: map
audience: both
updated: 2026-08-05
summary: "Detalhes do funcionamento, regras de exibição e roadmap da timeline comercial focada em usabilidade (versus logs da IA)."
code_refs:
  - src/components/lead/LeadTimelineTab.tsx
  - src/components/lead/timeline/
  - src/components/lead/LeadDebugTab.tsx
---

# Linha do Tempo Humana (Lead Timeline)

A "Linha do Tempo Humana" é o coração do CRM para secretárias e equipe de vendas. Diferente de um sistema de logs tradicionais onde cada requisição, fallback ou metadado da IA é registrado cruamente, esta timeline atua como um **tradutor de negócios**. Ela protege a equipe comercial do ruído de telemetria da IA e exibe estritamente os fatos que influenciam na conversão do paciente.

## 1. O Problema (Por que separamos)
Historicamente, o robô (Agente IA) realiza dezenas de tarefas invisíveis: avalia sentimentos, gera relatórios de conversas, recua de pipelines que não deram certo (`pipeline_fallback_used`), altera campos de metadados ocultos (`demonstrou_interesse`, `is_b2b`), e armazena payloads pesados no formato JSON (`["Consulta"]`, `2026-08-03T03:00:00.000Z`).

Exibir isso na mesma tela em que a secretária acompanha os retornos do paciente criava um "Spam Técnico" massivo. 

## 2. A Solução Arquitetural
A solução aplicada dividiu a visualização do histórico em duas frentes isoladas no `LeadDrawer.tsx`:

### A) Linha do Tempo Comercial (`LeadTimelineTab.tsx`)
A aba padrão de trabalho. Foca puramente na relação Humano ↔ Lead.
- **Bloqueio de Telemetria:** Eventos puramente técnicos (`auto:classifier`, `pipeline_fallback_used`, `ai_review_queued`) são derrubados antes de renderizar (não importando os filtros ativos).
- **Tradução Inteligente:** Eventos que são úteis, mas vêm em "idioma de máquina", são traduzidos:
  - *Datas ISO (`2026-08-03T...Z`)* → Formato Brasileiro (`03/08/2026 00:00`).
  - *Arrays JSON (`["Tratamento 1"]`)* → Textos separados por vírgula (`Tratamento 1`).
  - *Metadados Ocultos (ex: `is_b2b`)* → Traduzidos de "Campos personalizados alterados" para "Robô atualizou classificação do lead".
- **Filtro Padrão Pró-Automação:** O filtro `Sistema / Robô` ("crm") vem **ativado** por padrão. Como o lixo técnico já foi bloqueado na raiz, o que sobra nessa categoria são automações úteis (Alertas de `auto:human-reactor`, movimentações de `auto:followup-7d`), dando visibilidade do que a IA está ajudando a fechar.
- **Detalhamento Sob Demanda:** Alterações importantes (como mudanças de etapa de pipeline) ganham um botão de expansão (`meta`) para exibir a data e hora em que a ação ocorreu nos milissegundos.

### B) Logs Técnicos (`LeadDebugTab.tsx`)
Aba invisível para usuários normais (Secretárias). Apenas `owners`, `admins` e `developers` possuem acesso. 
- Exibe os `lead_events` crus, mostrando exatamente como a IA pensou, quais fallbacks tomou, o JSON exato e o consumo de tokens. É o *debugger* do CRM.

---

## 3. Roadmap em Fases

Para garantir que a linha do tempo alcance o ápice de usabilidade, projetamos um roadmap contínuo:

### Fase 1: Fundação & Split de Telemetria (✅ Concluído)
- Separação da aba comercial e da aba de Debug (para devs).
- Bloqueio sumário de eventos de sistema (`auto:classifier`, `ai_review_queued`) da visão principal.
- Configuração de localStorage (`timeline_filters_v3`) para resetar configurações legadas dos usuários e aplicar o novo padrão.

### Fase 2: Formatação de Dados & Micro-UX (✅ Concluído)
- Tradução de arrays JSON em strings puras durante a exibição das alterações de campos personalizados.
- Conversão de Timestamps PostgreSQL/ISO-8601 em datas locais legíveis `dd/MM/yyyy HH:mm`.
- Inclusão do expander (detalhes adicionais) nas mudanças de etapas (`lead_stage_history`) para prover a data exata sem poluir o cabeçalho.

### Fase 3: Smart Summaries & Agrupamento (Próximos Passos)
- **Batching de Eventos:** Se o Robô altera 5 campos personalizados de uma vez por conta de uma classificação, agrupar isso em um único "card" na timeline para reduzir o scroll vertical.
- **Agrupamento de Mensagens Curtas:** Se o lead manda 5 mensagens no WhatsApp em menos de 1 minuto ("Oi", "Tudo bem", "Queria", "Saber", "O Preço"), agrupar o bloco na timeline ao invés de listar 5 eventos de primeiro contato isolados.

### Fase 4: Governança & Customização Clínica
- **Configurações por Clínica:** Permitir que o gestor decida quais automações considera "Spam". Ex: uma clínica pode não querer ver `auto:human-reactor` na timeline, enquanto outra exige. 
- Mover as regras hardcoded de `LeadTimelineTab.tsx` (linhas de bloqueio `if (e.type === '...')`) para uma configuração puxada da tabela `clinic_settings`.

### Fase 5: Global Audit Trail
- Levar a `LeadDebugTab.tsx` para o próximo nível, removendo-a de dentro da gaveta do Lead e transformando em uma tela administrativa global ("Log de Auditoria da IA"). 
- Permitirá cruzar eventos de fallbacks em massa para entender gargalos no prompt do Agente Lovable, sem que a secretária sequer saiba que essa camada existe.
