---
title: "Diagnóstico e Estrutura Atual: Agente de Pipeline (Febracis)"
topic: kanban
kind: reference
audience: agent
updated: 2026-07-10
summary: "Estado atual da implementação do pipeline Febracis: separação de agentes, bugs conhecidos e plano de efetivação."
tenant: febracis
clinic_id: ab2f4484-886c-48f2-bfc6-0651d062c575
code_refs:
  - supabase/functions/pipeline-classify/febracis/
related_docs:
  - docs/tenants/febracis/README.md
  - docs/pipeline/HOWTO_NOVO_AGENTE_TENANT.md
---

# Diagnóstico e Estrutura Atual: Agente de Pipeline (Febracis)

**Objetivo:** Este documento mapeia como está estruturado o Agente de Pipeline para a conta Febracis hoje no MKCRM, servindo como guia de transição para quando formos efetivar a arquitetura de micro-agentes que desenhamos.

---

## 1. O que existe hoje (Estado Atual)

### 1.1 A Separação dos Agentes
Na conta `febracis-pri` (`ab2f4484-886c-48f2-bfc6-0651d062c575`), já existe um Agente de **Atendimento** configurado (Agent ID `907eb5e2...`). Esse agente possui um *System Prompt* de mais de 7 mil caracteres contendo o playbook de vendas do Paulo Vieira e a responsabilidade dele é gerar respostas e links da Stripe para o WhatsApp.
- **O Agente de Pipeline (nosso foco):** É totalmente separado. Ele é um processo backend silencioso que não envia mensagens, apenas observa as conversas (inclusive as do agente de atendimento) para mover os cards nas colunas corretas.

### 1.2 Onde ele reside hoje?
- **O Código:** O Agente de Pipeline não fica salvo na tabela `ai_agents` como o de atendimento. A lógica dele hoje vive "hardcoded" na edge function `supabase/functions/pipeline-classify/` (Orquestrador) e `apply.ts` (Rule Engine).
- **As Chaves e Toggles:** A UI do CRM possui a seção **Configurações > IA do Pipeline**. É ali que a chave de API (Gemini/OpenAI) é configurada, e de onde o banco puxa os toggles em `app_settings` para ligar ou desligar a classificação automática do funil.
- **Chips (Tags):** Hoje a lista de tags da Clínica ÓR (ex: "urgência_clínica") está em uma Whitelist no JSON de `app_settings.automation.v42.allowed_tags`. Para a Febracis, essa whitelist precisa ser recriada (chips de escola/vendas) no momento da efetivação.

---

## 2. O Que Falta (Plano de Efetivação)

Para ativarmos o fluxo desenhado anteriormente (as colunas Comprando, Administrativo, Não Qualificado) com a arquitetura ultra-barata, o seguinte guia técnico deverá ser executado pelos desenvolvedores:

### Passo A: Criar uma Edge Function Isolada (`pipeline-classify-febracis`)
**Decisão Arquitetural:** Em vez de entupir o `pipeline-classify` atual com dezenas de `if/else` por cliente, nós criaremos uma **Edge Function totalmente nova e dedicada** para a Febracis (ex: `supabase/functions/pipeline-classify-febracis/`).
- **Por que isso é melhor?** 
  1. **Isolamento de Risco:** Se o código da Clínica ÓR quebrar por alguma atualização, o pipeline da Febracis continua rodando perfeitamente.
  2. **Telemetria Nativa:** Os logs do Supabase e o consumo de memória ficam naturalmente separados no painel, facilitando a mensuração de custos.
  3. **Escalabilidade:** Cada novo cliente que exigir regras únicas de funil ganhará sua própria "caixa", mantendo o código limpo. Compartilharemos apenas os utilitários básicos (banco de dados, envio de mensagens) puxando da pasta `_shared/`.

### Passo B: Implementar os Micro-Agentes no Backend
- Criar a função `febracis-resumidor` (recebendo a marca d'água `last_processed_message_id` e o histórico antigo).
- Criar a função `febracis-tipificador` com o *System Prompt* enxuto focado nas 4 intenções que desenhamos.
- Alterar o `apply.ts` (Rule engine) para que, caso a requisição venha da Febracis, ele obedeça o mapeamento de mover o card baseado na intenção (`quer_comprar`, `suporte_admin`, etc.).

### Passo C: Atualização do Banco de Dados (Chips e Estágios)
- Limpar a whitelist de tags (`allowed_tags`) em `app_settings` do tenant Febracis e inserir as novas tags pertinentes (ex: `aluno_antigo`, `reclamacao`).
- Garantir que os UUIDs das colunas (Novo, Qualificação, Comprando, Comprou, Administrativo, Não Qualificado, Parou de Responder) da tabela `pipeline_stages` estejam mapeados nas constantes do código para esse tenant.

### Passo D: Telemetria Personalizada
- Garantir que a execução da Febracis pule a gravação das 5 rotinas pesadas em `ai_usage` e passe a registrar somente `classifier:febracis_resumidor` e `classifier:febracis_tipificador`. Isso validará a efetividade de custo na aba de "Custos de IA".

---

**Resumo da Ópera:** O serviço de pipeline já está engatilhado na base do CRM (o painel roda, os hooks das conversas funcionam). O próximo passo técnico para a Febracis é apenas a construção do "trilho" no código (em `pipeline-classify`) e a injeção do Prompt Barato, separando sua execução da complexidade clínica atual.
