# ROADMAP E MITIGAÇÃO: Pipeline 100% Automatizado (V5)

> **AVISO PARA O AGENTE DE DESENVOLVIMENTO (Lovable/IA):** Este é um documento técnico de arquitetura. Leia-o atentamente antes de fazer qualquer modificação no código. Ele descreve o escopo exato para reescrever o motor de automação (v4.2 para v5) garantindo que os fluxos da clínica sejam 100% autônomos.

## 1. Como funciona HOJE (v4.2) vs Como DEVE funcionar (v5)

| Recurso | Hoje (v4.2) | Novo Modelo 100% Autônomo (v5) |
| :--- | :--- | :--- |
| **Movimentação para "Consulta agendada"** | Bloqueada por `strict_no_move`. Só se move via gatilho de calendário formal. | **IA move sozinha** (General Move) ao extrair a data do chat com alta confiança, sem depender do evento no calendário. |
| **Proteção de Edição (G10)** | Se um humano preenche um campo, a IA fica proibida de alterá-lo por 7 dias. | **Override para Datas:** Se a IA extrai uma nova data confirmada pelo paciente, ela sobrepõe a data da secretária ignorando a G10. |
| **Tags de IA (Chips Semânticos)** | A IA tenta colocar tags semânticas, mas a `whitelist` bloqueia a maioria. | Os "Chips" visuais no frontend são alimentados por **Campos Personalizados**. A IA atualiza livremente os campos personalizados correspondentes. |
| **Paciente Antigo** | IA tenta reciclar pacientes antigos e muitas vezes gera conflito com retornos. MCP Tools conseguem burlar a trava. | **Proteção Absoluta:** Um paciente em "Paciente Antigo" **NUNCA** sai dessa coluna (apenas para Nutrição inativa via cron após 60 dias). O Lovable deve corrigir as ferramentas MCP (`move_lead_stage`) e `automations-tick` para não darem *bypass* no `pipelineMove`. |
| **SLA / Inatividade** | Inatividade básica baseada em `pipeline-deterministic` (7 dias). | **Cascata Dupla:** As automações de Interface (Aba Automations) cuidam do follow-up de 24h e 48h. Mas o cron de back-end (`pipeline-deterministic`) DEVE ser ajustado para varrer "Paciente antigo" (60 dias -> Nutrição inativa). |
| **Limpeza de Chips** | Chips (campos personalizados) acumulam-se no card indefinidamente. | **Wipe Centralizado:** Em `_shared/pipeline-move.ts`. Se for para "Consulta finalizada", limpa-se os custom_fields antigos e injeta-se "Aguardando". |

---

## 2. Mapa de Arquivos e Linhas de Conflito (Onde Alterar)

Abaixo estão os locais exatos que **devem** ser modificados, baseados na auditoria profunda do código:

### 2.1. O Bypass de Segurança Crítico (MCP Tools e Automações)
- **Problema:** Atualmente, o arquivo `supabase/functions/ai-chat/index.ts` (ferramenta `move_lead_stage`) e o arquivo `supabase/functions/automations-tick/index.ts` fazem `await supabase.from("leads").update({ stage_id })`. 
- **Conflito Catastrófico:** Fazer o update bruto de tabela ignora COMPLETAMENTE o `Guard D3` (Trava de Paciente Antigo), o Log de Histórico, a Idempotência e a futura limpeza de Chips.
- **O que fazer:** Refatorar **ambos** os arquivos para importarem e usarem a função `pipelineMove` de `_shared/pipeline-move.ts` ao invés de darem update direto no banco.

### 2.2. `supabase/functions/_shared/pipeline-move.ts` (Limpeza de Chips & Exceção de Cron)
- **O que fazer (Wipe de Chips):** Dentro desta função, logo antes do `UPDATE` de stage, injetar a lógica de wipe: Se `fromStage` for Qualificação, deletar custom_field "Interessado". Se `toStage` for Consulta Finalizada, limpar campos de agendamento e setar o chip "Aguardando".
- **O que fazer (Paciente Antigo):** O `Guard D3` (linha 176) diz: `if (isAutoSource && fromStage?.name === PACIENTE_ANTIGO_NAME) return false`. Alterar para permitir a movimentação SOMENTE SE o destino for "Nutrição inativa" (`toStage.name === "Nutrição inativa"`). 

### 2.3. `supabase/functions/pipeline-deterministic/index.ts` (O Cron de SLA)
- **O que fazer:** Na função `ruleInactivityTick` (aprox. linha 414), o array `ACTIVE` monitora apenas "Novo", "Qualificação", etc.
- **Conflito:** O cron NUNCA limpa Pacientes Antigos.
- **Solução:** Adicionar `Paciente antigo` à query. Se o lead estiver em "Paciente antigo" e a inatividade (last_message_at) for maior que 60 dias, movê-lo para `Nutrição inativa`.

### 2.4. `supabase/functions/pipeline-classify/apply.ts` (G10 & General Move)
- **O que fazer (G10 Override):** Na função `tryApplyField`, criar uma flag `isDateFromParser`. Se o campo for de data (`consulta_agendada_em`, `procedimento_agendado_em`), ignorar a trava de `G10_WINDOW_MS` (7 dias). 
- **O que fazer (Paciente Antigo Lock):** No bloco de General Move (aprox. linha 360+), incluir `if (ctx.stageName === "Paciente antigo") { would_move = false; reason = "locked_in_paciente_antigo" }`. Isso impede que a IA até mesmo *tente* classificar a mudança de estágio para esses casos, limitando-a a editar os chips via Tipificador.
- **O que fazer (Auto-move incondicional):** Garantir que a chamada de `pipelineMove` para `auto:classifier-general` **não** dependa da variável de ambiente (`ruleKey: "automation.general_move.enabled"` deve ser contornado para forçar 100% de automação nas respostas de data).

### 2.5. `supabase/functions/pipeline-classify/schema.ts`
- **O que fazer:** Adicionar o novo stage `Desqualificado` à tipagem `Canon` e `CANON_NAMES`.

---

## 3. Matriz de Mitigação de Riscos (O que pode dar errado)

| Risco Potencial | Efeito Catastrófico | Como o Lovable DEVE Mitigar no Código |
| :--- | :--- | :--- |
| **Bypass de Segurança do MCP** | O Médico atende o paciente antigo, ele sai. A secretária pede no Chat da IA para mover o paciente, e a ferramenta MCP burla o Guard D3, arrastando o lead para fora da coluna. | Substituir todos os `update({stage_id})` isolados em `ai-chat` e `automations-tick` pelo uso obrigatório da função central `pipelineMove`. |
| **Chips Fantasmas** | Paciente vai para Consulta Finalizada, mas fica com chip pendurado de "Consulta dia 19". | Focar a limpeza centralizada dentro do `_shared/pipeline-move.ts`. Se o wipe ficar no `apply.ts`, as automações de UI e o calendário não vão limpar os chips ao moverem os cards. |
| **Perda da Data por Bloqueio G10** | A secretária agenda a data A. 1h depois o paciente remarca para a data B pelo WhatsApp. A IA entende B, tenta salvar, mas a trava de 7 dias bloqueia. | O Lovable DEVE inserir a flag de bypass na função `tryApplyField` de `apply.ts`. |
