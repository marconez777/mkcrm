---
title: "Roadmap: atualizar a documentação da Clínica ÓR depois do Bloco B"
topic: operations
kind: roadmap
audience: both
status: planejado
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
updated: 2026-08-20
summary: "Sete fases para colocar a documentação da ÓR em dia com os dois funis: fechar o mapa do banco, marcar o que virou histórico, reescrever o fluxo real, atualizar os registries, reconciliar o plano, decidir o destino da camada de motor congelada em junho, e fechar a governança que deixou tudo apodrecer em silêncio."
related_docs:
  - docs/tenants/clinica-or/auditoria-20-08-2026.md
  - docs/roadmap/ROADMAP_ATUALIZACAO_DOCUMENTACAO.md
  - docs/_audit/PLANO_DOCS.md
code_refs:
  - scripts/docs-verify.mjs
  - docs/pipeline/runtime/_registry/
---

# Roadmap — documentação da Clínica ÓR depois do Bloco B

> **Fonte de verdade desta rodada:** [auditoria de 20/08/2026](../tenants/clinica-or/auditoria-20-08-2026.md).
> Nenhuma fase aqui *descobre* fatos — a auditoria já fez isso. Elas transcrevem.

## Por que existe um roadmap novo

O [roadmap de 11/08](ROADMAP_ATUALIZACAO_DOCUMENTACAO.md) executou F1 (inventário),
F2 (mapa de código), F3 (triagem) e parte da F4 — a camada `_registry/` nasceu daí e
o `docs:verify` também. **Nove dias depois, três eventos invalidaram o resultado:**

| Data | Evento | Efeito na doc |
|---|---|---|
| 13/08 | **Bloco B** — funil virou dois, 6 colunas mudaram de casa, 2 colunas renomeadas, 415 leads migrados | Toda doc de fluxo passou a descrever uma topologia que não existe |
| 14/08 | *Reagendamento* virou **"Paciente Ativo"** na tela | O registry mais novo (12/08) já nasceu com o nome velho |
| 13/08→hoje | Funil de Pacientes **fora** de `ai_target_pipeline_ids` | Um funil inteiro parado por 7 dias sem que doc, verificador ou alerta percebessem |

O terceiro é o que define a forma deste roadmap. **O problema não foi só doc velha —
foi doc que não cobre a camada onde a falha mora.** `npm run docs:verify` passa
verde: ele compara código ↔ registry, e o funil parou por uma linha de `jsonb` no
banco. Por isso a F0 e a F7 existem.

### As regras de 11/08 continuam valendo

**R1** não existe fluxo padrão — toda doc de fluxo declara o tenant ·
**R2** banco → código → documentação, nunca o inverso ·
**R3** toda doc tem `status:` (`vigente` / `historico` / `planejado`) ·
**R4** doc de motor não cita nome de coluna nem UUID; doc de fluxo é sempre por tenant.

---

## Fases

```
F0 (fechar o mapa) ──> F1 (marcar) ──> F2 (fluxo real) ──> F3 (registries) ──┐
                            │                                                │
                            └──────> F4 (plano/alvo) ─────────────────────────┤
                                                                             ├──> F7 (governança)
                                     F5 (camada de motor) ───────────────────┘
                                     F6 (estudo/legado) ─ paralelo, opcional
```

F1 pode começar **antes** de qualquer outra: marcar doc errada como histórica não
depende de saber a verdade completa, e é o que mais reduz risco por hora gasta.

---

### F0 — Fechar o mapa do banco

**Objetivo:** eliminar os ❓ da auditoria. Hoje faltam crons, valores de toggle,
`is_default`, travessias declaradas, contagem por coluna, tipos de compromisso e a
whitelist de tags.

**Como:** rodar a query única da [§8 da auditoria](../tenants/clinica-or/auditoria-20-08-2026.md)
no SQL Editor e colar o resultado de volta na própria §8, com data.

**Entregável:** §8 preenchida; §3 e §5 sem nenhum ❓.

**Critério de pronto:** toda linha das tabelas de regras tem estado medido, não
inferido. Em especial: **quais crons realmente existem** — nunca foram verificados,
desde 11/08.

**Custo:** 1 query. **Depende de:** nada.

---

### F1 — Marcar o que já não é verdade

**Objetivo:** impedir que alguém decida com base numa doc de julho. Custo quase zero,
maior redução de risco do roadmap.

**Como:** adicionar `status:` no frontmatter + um bloco de aviso no topo, apontando
para a auditoria de 20/08. Sem reescrever conteúdo.

| Arquivo | `updated` | Ação | Motivo |
|---|---|---|---|
| `tenants/clinica-or/README.md` | 10/07 | `historico` | "V7 = 2 agentes", *Paciente Antigo*, guard D3 vivo, funil único |
| `tenants/clinica-or/agentes-e-modelos.md` | 27/07 | `historico` | anuncia 2 agentes; rodam 5 |
| `tenants/clinica-or/gatilhos-e-automacoes.md` | 27/07 | `historico` | SLA de 48h inexistente, sweep mensal removido, destinos antigos de `faltou`/`cancelado` |
| `tenants/clinica-or/fluxo.md` | 17/07 | `historico` | diagrama de funil único com 11 colunas |
| `tenants/clinica-or/glossario-e-bugs.md` | 17/07 | `historico` | cita `pipeline-inactivity-tick`, que não existe |
| `tenants/clinica-or/tags-chips-e-campos.md` | 06/08 | `corrigir` | bom no geral; `ciclo_concluido` deixou de mover card na Etapa 5 |
| `tenants/clinica-or/FLUXO_REAL.md` | 11/08 | `historico` **até a F2 entregar** | hoje é a doc mais perigosa: diz `vigente` e descreve a topologia velha |
| `docs/Fluxo-atual.md` | — | `historico` | fluxo de funil único, sem tenant declarado (fere R1) |

**Critério de pronto:** nenhum arquivo da pasta do tenant sem `status:`; nenhum
`vigente` que contradiga a auditoria de 20/08.

**Custo:** baixo. **Depende de:** nada.

---

### F2 — Reescrever o fluxo real (a doc que mais importa)

**Objetivo:** ter **uma** doc que descreva a ÓR como ela é: dois funis, 13 colunas,
quem move para onde, o que está ligado e o que está barrado.

**Como:** reescrever `FLUXO_REAL.md` a partir das §2 a §6 da auditoria. Estrutura
que já funcionava (coluna a coluna, marcas ✅/⚠️/🔴/❓) — muda o conteúdo.

**Pontos obrigatórios:**

1. Dois funis lado a lado, com a linha de travessia (G9) explícita
2. **Nome de tela × nome canônico** em cada coluna — foi a origem de 4 defeitos
3. A tabela dos **quatro caminhos de movimentação** (§5 da auditoria), incluindo
   `pipeline-auto-finalize-or`, que hoje não aparece em nenhuma doc de fluxo
4. Reindexar os defeitos: dos 14 de 11/08, **D2, D6, D10, D11, D12, D13 morreram**
   com o strict no-move e **D4 morreu** com o rename. Não apagar — marcar
   `resolvido em`, com o quê. Renumerar os vivos junto com A1–A9 da auditoria nova
5. Uma seção de **estado operacional**: o que está barrado (A1) e o que está
   desligado (A2). Fluxo desenhado ≠ fluxo rodando

**Critério de pronto:** alguém que nunca viu a clínica consegue prever para onde vai
um card em cada uma das 13 colunas, e sabe dizer se a regra está ativa hoje.

**Custo:** alto. **Depende de:** F0 (para não escrever ❓ como se fosse fato).

---

### F3 — Atualizar os registries e ampliar o verificador

**Objetivo:** os registries são a única camada com verificação automática. Estão a
um rename de distância da verdade — e cegos para a camada que quebrou.

| Arquivo | O que fazer |
|---|---|
| `_registry/stages.md` | Renomear *Reagendamento* → **Paciente Ativo** (canônico segue `Reagendamento`); acrescentar `lead_count` e o funil de cada coluna |
| `_registry/toggles.md` | **Acrescentar as duas chaves que faltam:** `clinics.settings.ai_target_pipeline_ids` e `pipeline_automation_allowlist` — hoje nenhuma das duas está listada, e são as que podem parar tudo |
| `_registry/triggers.md` | Corrigir os destinos: `faltou`/`cancelado` → *Paciente Ativo*; `reactivation-inbound` com os dois destinos por funil |
| `_registry/events.md` | Documentar que `pipeline_move_attempted` **só grava em sucesso**, e que a recusa vive em `lead_events.payload.res.reason` (A5) |
| `scripts/docs-verify.mjs` | Nova checagem: toda constante de nome de coluna no código (`PACIENTE_ANTIGO_NAME` e similares) tem de existir em `pipeline_stages`. Teria pego o D3 morto |

**Critério de pronto:** `npm run docs:verify` verde **e** as duas chaves de bloqueio
documentadas com "o que acontece quando está ausente/errada".

**Custo:** médio. **Depende de:** F2 (para não divergir da prosa nova).

---

### F4 — Reconciliar FLUXO_ALVO e PLANO_IMPLEMENTACAO

**Objetivo:** os dois são `planejado`, e o plano está **quase todo executado**. Um
plano que não registra o que já foi feito vira armadilha: alguém re-executa a Etapa 4.

**Como:**

1. Marcar no `PLANO_IMPLEMENTACAO.md` o estado real de cada um dos 29 itens das
   Etapas 1–7 — hoje só alguns têm ✅ e a Etapa 4 inteira aconteceu no Bloco B
2. Acrescentar as **pendências que a auditoria descobriu** e que o plano não previa:
   marcar o funil novo em `ai_target_pipeline_ids` (A1) e ligar as duas regras
   temporais (A2). Nenhuma das duas está em nenhuma etapa
3. Corrigir o `FLUXO_ALVO.md` §2.2: a saída para *Finalizada* **não é manual** —
   `pipeline-auto-finalize-or` fecha sozinho a cada 15 min (A3). Ou o alvo muda, ou
   o cron sai; é decisão do cliente, e a doc precisa dizer qual foi
4. Quando as pendências fecharem, `FLUXO_ALVO` deixa de ser `planejado` e vira
   insumo da F2 — não uma doc paralela

**Critério de pronto:** zero itens ambíguos entre "planejado" e "feito"; toda
divergência entre alvo e realidade é decisão registrada, não esquecimento.

**Custo:** médio. **Depende de:** F0.

---

### F5 — Decidir o destino da camada de motor

**Objetivo:** 18 arquivos em `docs/pipeline/runtime/` estão congelados em 18–23/06.
A triagem de 11/08 mandou reescrever; nove dias depois nasceu o `_registry/`, que
já cobre parte do que eles diziam.

**Decisão a tomar antes de gastar hora:**

| Opção | Custo | Risco |
|---|---|---|
| Reescrever os 18 | alto | reescrever o que o registry já responde |
| Marcar o conjunto como `historico` e manter só o `_registry/` + playbooks | baixo | perder prosa explicativa que o formato tabular não carrega |
| Híbrido: manter 4–5 (`GATES`, `CLASSIFIER`, `KNOWN_ISSUES`, `ARCHITECTURE`) e arquivar o resto | médio | — |

**Recomendação:** híbrido. `GATES.md` e `KNOWN_ISSUES.md` explicam *por quê*, e isso
o registry não faz. O resto duplica fato.

**Critério de pronto:** nenhum arquivo em `runtime/` sem `status:`; nenhum `vigente`
com data de junho.

**Custo:** médio. **Depende de:** F3 (saber o que o registry já cobre).

---

### F6 — Legado de estudo (paralelo, opcional)

`docs/estudo/` tem 17 arquivos (alguns com 1.400 linhas) escritos sobre colunas que
mudaram de nome ou deixaram de existir. **São estudo de conversa real, não descrição
de sistema** — o valor deles não depende do nome da coluna.

**Ação:** um cabeçalho `status: historico` + uma linha dizendo de quando é o
recorte. Nada mais. Não reescrever.

**Custo:** mínimo. **Depende de:** nada.

---

### F7 — Governança: por que ninguém percebeu

**Objetivo:** o funil ficou parado 7 dias e a única razão de termos descoberto foi
uma pergunta do cliente sobre cards que não moviam. Isso é o achado de processo.

**Ações:**

1. **Playbook `criar-pipeline.md`** — não existe. Deve incluir, como passo
   obrigatório: cadastrar aliases canônicos, declarar travessias e **marcar o funil
   em `ai_target_pipeline_ids`**. É exatamente o passo que faltou no Bloco B
2. **Verificação banco ↔ registry.** O `docs:verify` não vê o banco. Mínimo viável:
   uma query salva que compare colunas/aliases/toggles reais com o registry e possa
   rodar sob demanda — o mesmo espírito da §8 da auditoria
3. **Alerta de regra barrada.** Hoje uma recusa não deixa rastro (A5). Ou
   `pipelineMove` grava a recusa, ou existe um painel que conte `reason` por dia.
   294 recusas em 30 dias deveriam ter gritado
4. **Regra de repositório:** mudança de topologia (coluna, funil, alias, travessia)
   atualiza o registry no mesmo commit. Os playbooks já dizem isso; o Bloco B
   atualizou `stages.md` e ainda assim ninguém tocou em `toggles.md`

**Critério de pronto:** existe uma forma de responder "alguma regra está sendo
barrada agora?" sem escrever SQL do zero.

**Custo:** médio-alto. **Depende de:** F3.

---

## Ordem recomendada e esforço

| Ordem | Fase | Custo | Por que aqui |
|---|---|---|---|
| 1 | **F1** marcar | mínimo | tira o perigo de decidir errado hoje mesmo |
| 2 | **F0** fechar o mapa | 1 query | destrava F2 e F4 |
| 3 | **F4** reconciliar plano | médio | é o que o cliente lê para saber o que falta |
| 4 | **F2** reescrever fluxo real | alto | a doc central |
| 5 | **F3** registries + verificador | médio | trava o resultado da F2 contra regressão |
| 6 | **F7** governança | médio | impede a próxima parada silenciosa |
| 7 | **F5** camada de motor | médio | decisão antes de execução |
| — | **F6** estudo | mínimo | quando sobrar tempo |

---

## Riscos

**A doc vai vencer de novo antes de terminar.** A1 e A2 ainda vão ser corrigidos, e
isso muda o fluxo — de novo. **Mitigação:** F1 e F0 primeiro; a F2 só depois que as
pendências operacionais estiverem decididas, mesmo que ainda não executadas.

**Reescrever fluxo que ainda vai mudar.** Mesmo remédio de 11/08: marcação e
correção pontual em massa; reescrita pesada só para `FLUXO_REAL`.

**O verificador dá falsa segurança.** Verde hoje, com um funil parado. Enquanto a
F7.2 não existir, `docs:verify` verde **não** significa que a produção está de pé —
e isso precisa estar escrito no `_registry/README.md`.
