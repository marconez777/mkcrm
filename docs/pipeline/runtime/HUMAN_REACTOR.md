---
title: "Reator Humano e Lock Manual — V6"
topic: kanban
kind: reference
audience: agent
updated: 2026-06-20
summary: "Comportamento do lock manual (manual_lock_until = 7d quando humano move card no Kanban), botão Destravar no LockManualChip, e ruleHumanReactorTick (cron diário que cria tasks para leads estagnados com tag precisa_atencao_humana)."
related_docs:
  - docs/pipeline/runtime/GATES.md
  - docs/pipeline/runtime/DETERMINISTIC_RULES.md
---

# Reator Humano e Lock Manual

O ecossistema V6 é projetado para operar com autonomia, mas reconhece que a intervenção humana é prioritária. O "Reator Humano" não é um agente de IA ativo que responde instantaneamente, mas sim um conjunto de regras que *reagem* à presença humana para proteger o Lead.

## Lock Manual (Gate G1)

Sempre que um usuário (atendente/secretária) move um card manualmente na interface do Kanban, o sistema entende que a IA não deve interferir no julgamento humano recente. A aplicação registra no banco:

```sql
UPDATE leads SET
  stage_id = <novo_estagio>,
  manual_lock_until = now() + interval '7 days'
WHERE id = <leadId>;
```

O Gate **G1** proíbe qualquer movimentação originada por `auto:*` enquanto o tempo do `manual_lock_until` não expirar. Importante notar que esse lock **NÃO** bloqueia o Agente 3 (Preenchedor) de inserir tags ou alterar custom_fields (obedecendo as restrições do G10), nem bloqueia o Agente 1 de gerar resumos. O lock barra estritamente o Agente 4 (Movimentador).

### Exceção: Ciclo Concluído (Lock de 90 dias)
Se a ação humana foi marcar o campo booleano `ciclo_concluido` como `true`, a regra `auto:ciclo-concluido` entra em ação movendo o lead para "Paciente antigo" e dilatando o lock manual para 90 dias, efetivamente inativando o lead para a IA por um trimestre.

## Destravando Manualmente

Na UI, há um componente chamado `LockManualChip` que exibe a informação de que a IA está bloqueada. O usuário pode clicar nesse chip e selecionar "Destravar", disparando uma ação que define `manual_lock_until = NULL`, o que reabilita a IA para movimentar o card no próximo processamento do cron.

## O Cron do Reator Humano

O Reator Humano executa varreduras para cobrar a equipe clínica por ações não resolvidas.

| | |
|---|---|
| Cron | `pipeline-human-reactor-tick` (Diário às 08:00 BRT) |
| Critério | Tag `precisa_atencao_humana` PRESENTE e `updated_at < now() - 7 dias` |
| Idempotência | Evita criar tasks duplicadas se já existir uma aberta com o prefixo "Revisar lead travado" |
| Ação | Cria uma `lead_task` cobrando a revisão humana em D+1. |

## Gestão da Tag `precisa_atencao_humana`

Essa tag é o sinal de alerta do sistema V6. Quando aplicada, o lead entra na fila de revisão humana.

### Quem Aplica a Tag
| Origem | Quando |
|---|---|
| Maestro (Agente 5) | Sempre que sua pontuação de confiança (Confidence) for `< 0.6`. Indica confusão sistêmica. |
| Auditor de Posição (A1) | Discorda da posição atual do Kanban com confiança `≥ 0.75`. |
| Verificador Pós-Move (A2) | Julga que o último Move da IA foi equivocado com confiança `≥ 0.8`. |
| SLA de Inatividade | Sempre que o cron de 7 dias joga um lead no lixo (Nutrição inativa), assinalando que perdemos contato e o humano deve checar o motivo. |
| Regras Determinísticas | Casos complexos de B2B, objeções severas ou detecção de palavras-chave jurídicas (`auto:judicializacao`). |
| Usuários (Humanos) | Manualmente via Painel UI. |

### Quem Remove a Tag
**Absolutamente ninguém no lado da IA.** 
A tag pertence ao conjunto `PROTECTED_TAGS` do `schema.ts`. Os Agentes não têm autorização para sugerir a sua remoção, tampouco a Engine determinística. Essa tag persiste até que um usuário limpe-a na interface indicando que a situação foi mitigada.
