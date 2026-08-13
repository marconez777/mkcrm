---
title: "Roadmap: reconstrução da documentação do pipeline"
topic: operations
kind: roadmap
audience: both
updated: 2026-08-11
summary: "Plano em 5 fases para colocar a documentação em ordem: inventariar docs, mapear código linha a linha, triar o que atualizar/arquivar/deletar, executar, e fechar com glossário + mapa descritivo. Inclui o estado medido em 11/08/2026: 130 docs, 54 desatualizados há 2+ meses, 17 sem frontmatter, diretório de tenant duplicado."
related_docs:
  - docs/roadmap/RASCUNHO_SEPARACAO_FLUXO_TENANT.md
  - docs/tenants/clinica-or/auditoria-11-08-2026.md
code_refs:
  - supabase/functions/
  - src/pages/Kanban.tsx
---

# Roadmap: reconstrução da documentação do pipeline

> **Por que agora.** A auditoria de 11/08 refutou **3 conclusões** que tinham sido
> derivadas da documentação. Enquanto código, banco e docs se contradizem, todo
> diagnóstico é chute e toda alteração é risco. Esta é a Fase 0 do
> [plano de separação](RASCUNHO_SEPARACAO_FLUXO_TENANT.md).

---

## Regras que governam este trabalho

### R1 — Premissa inegociável, a propagar em toda doc de tenant

> # **NÃO EXISTE FLUXO PADRÃO. NUNCA VAI EXISTIR.**
> Cada cliente terá um fluxo **completamente** diferente. Nada igual.
> Toda doc que descreva fluxo deve deixar explícito **de qual tenant** está falando.
> Documento de fluxo sem tenant declarado é bug de documentação.

### R2 — Ordem de confiança

**banco → código → documentação.** Nunca o inverso. Documentação que afirma algo
sobre produção precisa registrar **quando foi verificada e contra o quê**.

### R3 — Toda doc tem status explícito

| Status | Significado |
|---|---|
| `vigente` | Descreve o sistema hoje; foi verificada |
| `historico` | Registro de algo que já foi verdade; **não** usar para decidir |
| `planejado` | Descreve intenção, não realidade |

Documento sem status é tratado como não confiável.

### R4 — Motor ≠ fluxo

Doc de **motor** (mecânica: mover card, gravar histórico, avaliar regra) nunca cita
nome de coluna, palavra clínica ou UUID. Doc de **fluxo** é sempre por tenant.

---

## Estado medido em 11/08/2026

| Métrica | Valor |
|---|---|
| Total de `.md` em `docs/` | **130** |
| Citam a Clínica ÓR ou seu `clinic_id` | **53** |
| `updated:` anterior a julho (2+ meses) | **54** |
| Sem frontmatter | **17** |
| Citam nomes de coluna que já mudaram | **17** |
| `code_refs` apontando para caminho inexistente | 4 caminhos distintos |
| Maior concentração | `docs/pipeline/runtime/` (24) · `docs/maps/` (21) · `docs/estudo/` (17) |

### Problemas estruturais já identificados

- **Diretório de tenant duplicado:** `docs/tenants/clinica-or/` (9 arquivos, hífen)
  e `docs/tenants/clinica_or/` (3 arquivos, underscore). Ninguém sabe qual vale.
- **`supabase/functions/pipeline-inactivity-tick/` não existe** e é citado em
  **14 documentos**, incluindo `code_refs` de 4 docs da ÓR. A função virou
  `pipeline-deterministic {action:'inactivity-tick'}`.
- **`scripts/docs-sync.mjs` não existe** desde 18/06 e continua referenciado em
  `package.json`, na skill `docs-maintainer` e em 6 docs. **Não há validação
  automática de `code_refs` desde então** — é o que permitiu o item acima.
- **`PIPELINE_TENANT_ROADMAP.md` marca ✅** itens que não estão em vigor (G1, G2, G3).

---

# Fases

## F1 — Inventário da documentação

**Objetivo:** saber exatamente o que existe, o que cada doc alega e quão velho é.
Nada de leitura profunda ainda — é censo.

**Entregável:** `docs/_audit/INVENTARIO_DOCS.md` — uma linha por arquivo:

| Arquivo | `updated:` | Tem frontmatter | Tenant declarado | Alega descrever produção | `code_refs` válidos |
|---|---|---|---|---|---|

**Como fazer:** varredura automatizada do frontmatter + verificação de existência
de cada `code_refs`. Script descartável; o entregável é a tabela.

**Critério de pronto:** os 130 arquivos classificados, sem exceção. Nenhuma célula
"não sei".

**Já sabemos:** os números da tabela acima; o diretório duplicado; os 4 `code_refs`
quebrados.

---

## F2 — Mapa do código (a verdade)

**Objetivo:** produzir a referência **verificada** contra a qual a documentação
será corrigida. Esta fase gera a fonte de verdade; a F4 apenas a transcreve.

**Entregável:** `docs/_audit/MAPA_CODIGO_PIPELINE.md`, organizado por
comportamento — não por arquivo:

1. **Gatilhos** — cada trigger PG: tabela, evento, o que faz, arquivo:linha,
   confirmado em `pg_trigger` (sim/não)
2. **Crons** — job, schedule, endpoint, confirmado em `cron.job`
3. **Regras de movimentação** — cada `source` que aparece em `lead_stage_history`,
   quem o emite, qual gate o controla
4. **Campos** — cada chave de `custom_fields`: quem escreve, o que dispara,
   tem definição em `lead_custom_fields`?
5. **Chips** — cada padrão de regex → chip → campo
6. **Constantes de negócio no código** — o inventário da contaminação (R4):
   toda ocorrência de nome de coluna, palavra clínica ou UUID dentro de
   `supabase/functions/`
7. **Configuração** — cada chave lida vs. cada chave existente no banco
   (as **não lidas** são tão importantes quanto as lidas)

**Como fazer:** código + queries. Toda afirmação sobre produção carrega a query
que a comprova.

**Critério de pronto:**
- Toda afirmação tem `arquivo:linha` **ou** query de origem
- O item 6 é uma lista fechada — vira o backlog da separação
- O item 7 explicita o que está no banco e ninguém lê

**Já sabemos:** boa parte está na
[auditoria de 11/08](../tenants/clinica-or/auditoria-11-08-2026.md) — F2 estende e
organiza, não recomeça.

---

## F3 — Triagem e planejamento

**Objetivo:** decidir, arquivo por arquivo, o destino. **Com 130 docs e 54
desatualizados, reescrever tudo não é opção** — a maior parte do valor está em
marcar corretamente o que não é confiável.

**Entregável:** `docs/_audit/PLANO_DOCS.md` — decisão por arquivo:

| Destino | Quando | Custo |
|---|---|---|
| **Reescrever** | Doc vigente que alguém usa para decidir e está errada | alto |
| **Corrigir pontualmente** | Certa no geral, errada em pontos localizados | baixo |
| **Marcar `historico`** | Foi verdade, hoje não é, mas o registro tem valor | mínimo |
| **Arquivar** (`docs/archive/`) | Não é verdade nem tem valor histórico | mínimo |
| **Deletar** | Errada, sem valor, e ativamente perigosa | mínimo |
| **Criar** | Comportamento real sem doc alguma | alto |

**Decisões estruturais a tomar nesta fase:**

- Resolver `clinica-or` vs `clinica_or` — escolher um, mover, deletar o outro
- Definir o destino de `docs/pipeline/runtime/` (24 arquivos, congelados em 22/06):
  reescrever, ou marcar o conjunto como `historico` e criar um substituto enxuto?
- Reescrever ou remover `scripts/docs-sync.mjs` — **decidir antes da F4**, porque
  sem validação a F4 reintroduz `code_refs` quebrados
- `PIPELINE_TENANT_ROADMAP.md`: reverificar cada ✅ ou marcar o documento inteiro

**Docs novos já identificados como necessários:**

| Doc | Por quê |
|---|---|
| Fluxo real da ÓR, coluna a coluna | Não existe versão correta hoje |
| `trg_lead_needs_extraction` | O motor de chips **não está documentado em lugar nenhum** |
| Campos virtuais de agendamento | `KNOWN_ISSUES §7` tem o diagnóstico **invertido** |
| Motor vs fluxo (fronteira) | Base do critério de aceite R4 |
| Configuração: o que é lido e o que não é | 4 configs preenchidas e ignoradas |

**Critério de pronto:** todo arquivo do inventário F1 tem destino. Ordem de
execução definida.

---

## F4 — Executar

**Objetivo:** aplicar o plano da F3.

**Ordem sugerida** — barato-e-alto-impacto primeiro:

1. **Marcações** (`historico` / `arquivar` / `deletar`) — remove a maior parte do
   risco de alguém decidir com base errada, a custo quase zero
2. **Correções pontuais** — nomes de coluna, `code_refs`, números
3. **Docs novos** — o que não existe é mais valioso que o que está errado
4. **Reescritas** — o mais caro, por último

**Regras de execução:**

- Toda doc tocada recebe `updated:` de hoje e `status:` (R3)
- Toda doc de fluxo declara o tenant (R1)
- Toda afirmação sobre produção cita a fonte e a data de verificação (R2)
- **Nenhuma doc nova sem `code_refs` validado**

**Critério de pronto:**
- Zero `code_refs` quebrados
- Zero docs sem frontmatter
- Zero docs de fluxo sem tenant declarado
- Nenhum doc `vigente` contradiz o mapa da F2

---

## F5 — Glossário e mapa descritivo

**Objetivo:** o ponto de entrada. Hoje não existe — quem chega ao repositório não
tem por onde começar, e é parte de por que a doc apodreceu.

**Entregável 1 — `docs/GLOSSARIO.md`**

Cada termo com: definição em linguagem simples, onde vive no código, onde vive no
banco, e **de qual tenant é** (se for de fluxo).

Termos que já sabemos que precisam entrar, porque foram fonte de confusão real:

| Termo | Confusão que causou |
|---|---|
| **chip** vs **tag** vs **reason** | Três coisas diferentes, tratadas como sinônimo |
| **canônico** vs **nome real** de coluna | Rename quebrou comparação por nome — 2 defeitos |
| **campo virtual** | `consulta_agendada_em` não existe na tabela de campos |
| **motor** vs **fluxo** | A distinção que sustenta a separação |
| **gate** (G2…G10) vs **guard** (D3) | Numeração herdada, sem lista única |
| **source** de movimentação | 13 valores em produção, nenhum catálogo |
| **tenant** vs **clinic** vs **pipeline** | Usados de forma intercambiável |

**Entregável 2 — `docs/MAPA.md`**

Índice descritivo: para cada pergunta que alguém realmente faz, qual doc responde.
Organizado por **pergunta**, não por diretório:

- "Por que esse card não moveu?"
- "Quem coloca esse chip?"
- "O que acontece quando a secretária preenche a data?"
- "Como ligo/desligo a IA de um cliente?"
- "Como onboardo um cliente novo?"

**Critério de pronto:** alguém que nunca viu o repositório consegue responder as
cinco perguntas acima sem ajuda, partindo do `MAPA.md`.

---

## Sequenciamento e dependências

```
F1 (inventário) ──┐
                  ├──> F3 (triagem) ──> F4 (executar) ──> F5 (glossário + mapa)
F2 (mapa código) ─┘
```

F1 e F2 são independentes e podem correr em paralelo. **F3 não começa sem as
duas** — triar sem saber a verdade é chutar de novo.

F5 vem por último de propósito: glossário escrito antes da F4 documenta a confusão
em vez de resolvê-la.

---

## Riscos

**Reescrever doc sobre sistema que ainda vai mudar.** A separação de tenant e as
alterações de fluxo (pagamento, coluna nova) vão invalidar parte do que for
escrito. **Mitigação:** F4 prioriza marcação e correção pontual; reescrita pesada
só para o que é estável. Doc de fluxo da ÓR é a exceção — precisa estar certa
*antes* das alterações, porque é a base para decidir o que mudar.

**Sem validação automática, a F4 reintroduz o problema.** Foi exatamente o que
aconteceu quando o `docs-sync.mjs` sumiu em 18/06. **Mitigação:** decidir na F3,
implementar antes da F4.

**Volume.** 130 arquivos é muito para revisão manual cuidadosa. **Mitigação:** a
F3 existe justamente para que a maioria receba tratamento barato.

**A doc voltar a apodrecer.** Nada aqui impede a próxima divergência.
**Mitigação a decidir na F3:** validação de `code_refs` no CI, e a regra de que
toda alteração de fluxo atualiza a doc do tenant na mesma mudança.
