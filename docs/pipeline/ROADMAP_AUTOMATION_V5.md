# ROADMAP E MITIGAÇÃO: Pipeline 100% Automatizado (V5)

> **AVISO PARA O AGENTE DE DESENVOLVIMENTO (Lovable/IA):** Este é um documento técnico de arquitetura. Leia-o atentamente antes de fazer qualquer modificação no código. Ele descreve o escopo exato para reescrever o motor de automação (v4.2 para v5) garantindo que os fluxos de clínica psiquiátrica sejam 100% autônomos.

## 1. Como funciona HOJE (v4.2) vs Como DEVE funcionar (v5)

| Recurso | Hoje (v4.2) | Novo Modelo 100% Autônomo (v5) |
| :--- | :--- | :--- |
| **Movimentação para "Consulta agendada"** | Bloqueada por `strict_no_move`. Só se move via gatilho de calendário formal (`tg_auto_appointment_sync`). | **IA move sozinha** (General Move) ao extrair a data do chat com alta confiança, sem depender do evento no calendário. |
| **Proteção de Edição (G10)** | Se um humano preenche um campo, a IA fica proibida de alterá-lo por 7 dias. | **Override para Datas:** Se a IA extrai uma nova data confirmada pelo paciente, ela sobrepõe a data da secretária ignorando a G10. |
| **Tags de IA (Chips Semânticos)** | A IA tenta colocar tags semânticas (ex: `interesse_conjuge`), mas a `whitelist` bloqueia a maioria, restando apenas tags operacionais. | Os "Chips" visuais no frontend são alimentados por **Campos Personalizados**. A IA atualiza livremente os campos personalizados correspondentes. A `whitelist` de tags recebe expansão leve, mas o motor principal são os *Custom Fields*. |
| **Paciente Antigo** | IA tenta reciclar pacientes antigos e muitas vezes gera conflito com retornos. | **Proteção Absoluta:** Um paciente em "Paciente Antigo" **NUNCA** sai dessa coluna via IA. A IA apenas atualiza seus *Chips* (ex: "Consulta dia X"). Apenas um cron de inatividade de 60 dias pode movê-lo para Nutrição Inativa. |
| **SLA / Inatividade** | Inatividade básica baseada em `pipeline-inactivity-tick`. | **Cascata de SLA:** 24h sem resposta -> Move para `Sem resposta`. +48h -> Move para `Nutrição inativa`. Respondeu -> Volta para `Qualificação`. |
| **Limpeza de Chips** | Chips (campos personalizados) acumulam-se no card indefinidamente. | **Wipe por Stage:** Ao entrar em "Consulta Finalizada", chips de "Interesse" e de agendamento são limpos, substituídos por "Aguardando". Ao sair de "Qualificação", o chip "Interessado" some. |

---

## 2. Mapa de Arquivos e Linhas de Conflito (Onde Alterar)

Abaixo estão os locais exatos que **devem** ser modificados para evitar que as regras antigas conflitem com as novas:

### 2.1. `supabase/functions/pipeline-classify/schema.ts`
- **O que fazer:** Adicionar o novo stage `Desqualificado` à tipagem.
  - **Onde:** Na constante `Canon` e no array `CANON_NAMES` (aprox. linha 8-30).
  - **Por que mitiga erro:** Se a IA sugerir "Desqualificado" (para leads fora de perfil / SPAM), o sistema atual (v4) forçaria fallback para "Qualificação" silenciosamente.

  ### 2.2. `supabase/functions/pipeline-classify/agent-core.ts`
  - **O que fazer:** Ajustar o *System Prompt* de `buildSummarizerSystem`.
  - **Onde:** (aprox. linha 80-100).
  - **Por que mitiga erro:** O modelo (`gpt-4o`) menciona a data no resumo em prosa mas esquece de popular a variável estruturada `mentioned_dates`. É obrigatório injetar *Few-Shot Prompts* (exemplos práticos) forçando a saída de `{raw, anchor_iso, kind}`.

  ### 2.3. `supabase/functions/pipeline-classify/apply.ts`
  *Este é o arquivo mais perigoso e o coração do pipeline.*
  - **O que fazer (G10 Override):** Na função `tryApplyField`, criar uma flag `isDateFromParser`. Se o campo for de data (`consulta_agendada_em`, `procedimento_agendado_em`), ignorar a trava de `G10_WINDOW_MS` (7 dias). 
  - **O que fazer (Limpeza de Chips):** Antes de aplicar o `custom_fields_patch`, verificar `ctx.stageName`. Se o lead estiver saindo de Qualificação, forçar a exclusão do custom field de `Interessado`. Se estiver em "Consulta finalizada", forçar exclusão dos chips anteriores e injetar "Aguardando".
  - **O que fazer (Paciente Antigo):** No bloco de General Move (aprox. linha 360+), incluir `if (ctx.stageName === "Paciente antigo") { would_move = false; reason = "locked_in_paciente_antigo" }`. Permitir apenas que o Tipificador aplique os campos personalizados de agendamento para gerar os chips.
  - **O que fazer (Auto-move incondicional):** Garantir que a chamada de `pipelineMove` para `auto:classifier-general` **não** dependa exclusivamente de uma variável de ambiente que possa estar falsa (`ruleKey: "automation.general_move.enabled"` deve ser contornado se quisermos forçar 100% de automação).

  ---

## 3. Matriz de Mitigação de Riscos (O que pode dar errado)

| Risco Potencial | Efeito Catastrófico | Como o Lovable DEVE Mitigar no Código |
| :--- | :--- | :--- |
| **Looping de Movimentação** | A IA move para "Consulta", o Cron move para "Inativa", e o paciente fala de novo, fazendo a IA se confundir. | Usar rigorosamente as travas de 24h anti-conflito em `apply.ts` baseadas no `moved_at` da tabela `lead_stage_history`. |
| **Chips Fantasmas** | Paciente vai para Consulta Finalizada, mas fica com chip pendurado de "Consulta dia 19", confundindo a secretária. | Implementar uma rotina de `wipe` (exclusão) no `apply.ts` atrelada à detecção do novo `stage_suggestion = "Consulta finalizada"`. |
| **Paciente Antigo Ressuscitando** | A IA lê "quero agendar cetamina" num Paciente Antigo e arrasta o card dele para "Tratamento Agendado", estragando o histórico visual do médico. | Aplicar um Guard explícito na base do `apply.ts` (ou no `pipeline-move.ts` Guard D3) impedindo a origem `auto:classifier` de alterar a coluna de leads cujo `stage_id` atual seja o de "Paciente Antigo". |
  | **Perda da Data por Bloqueio G10** | A secretária agenda a data A. 1h depois o paciente remarca para a data B pelo WhatsApp. A IA entende B, tenta salvar, mas a trava de 7 dias bloqueia. O lead ganha chip errado. | O Lovable DEVE inserir a flag de bypass na função `tryApplyField` de `apply.ts`, permitindo que o `isDateFromParser` sempre sobrescreva o `custom_fields_last_human_edit`. |

  *(Nota ao dev: As regras de SLA baseadas no tempo "horas_sem_resposta >= 24h" NÃO precisam ser codificadas nos Crons; elas serão configuradas pelo usuário na Interface via tabela `automations` (`automations-tick`). Apenas as lógicas semânticas de `apply.ts` devem ser manipuladas)*
