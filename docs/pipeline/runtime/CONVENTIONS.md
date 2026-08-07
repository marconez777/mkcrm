---
title: "Convenção de escrita da documentação de runtime"
topic: general
kind: reference
audience: agent
updated: 2026-08-07
verified_at: 2026-08-07
verified_against: b245a2a8
summary: "Como escrever nesta pasta para que a documentação seja consumível por IA e detectável quando dessincroniza."
---

<!-- docs-verify:allow-stale-paths — cita os caminhos errados de propósito, como exemplo -->

# Convenção de escrita

Estas regras existem por um motivo concreto: entre junho e agosto de 2026, três garantias de
segurança **falsas** conviveram com o código sem ninguém notar. Um agente autônomo lendo a doc
concluía que a IA não movia cards sozinha (movia), que tags eram sempre mescladas (eram
substituídas) e que um move humano recente bloqueava a IA (não bloqueava).

Nenhuma dessas afirmações estava marcada como não-verificada. Todas soavam iguais às
verdadeiras. É esse o problema que a convenção resolve.

## 1. Fato mora no registry; prosa linka

Um fato — um stage, um gatilho, um campo, uma tag, um toggle, um tipo de evento — mora em
[`_registry/`](./_registry/) e em nenhum outro lugar. Prosa explica o **porquê** e aponta.

❌ `GATES.md` lista os toggles numa tabela própria
✅ `GATES.md` diz "ver [`_registry/toggles.md`](./_registry/toggles.md)"

Se você está copiando uma tabela de um doc para outro, pare.

## 2. Marque o estado de toda afirmação não-trivial

| Marca | Significa |
|---|---|
| ✅ | verificado contra o código na data do `verified_at` |
| ⚠️ | verificado, com ressalva — o comportamento surpreende; a ressalva vem junto |
| ❌ | divergente conhecido — o código faz outra coisa; há item aberto no `KNOWN_ISSUES.md` |

Afirmação sem marca é lida como "provavelmente verdade, não conferida". Isso é honesto e útil —
o que não pode acontecer é uma ❌ passar por ✅.

## 3. `verified_at` ≠ `updated`

```yaml
updated: 2026-08-07            # quando o texto mudou
verified_at: 2026-08-07        # quando alguém conferiu contra o código
verified_against: b245a2a8     # SHA — é isto que torna a conferência auditável
```

Editar a redação **não** atualiza `verified_at`. Foi exatamente aí que o V6 escorregou: os docs
foram reescritos com data nova carregando afirmações do V4.

## 4. Nunca referencie por número de linha

❌ `pipeline-move.ts:173-181`
✅ `pipeline-move.ts`, guard D3 (comparação contra `PACIENTE_ANTIGO_NAME`)

Números apodrecem em um commit. Vários docs desta pasta apontavam para linhas do monólito V1 já
deletado. Use nome de função, constante ou reason string — todos são `grep`-áveis.

## 5. Documente o que **não** existe

Quando uma proteção anunciada não existe, ou uma regra nasce morta, isso é informação de
primeira classe — não uma omissão. Escreva em bloco de citação, com o motivo e o link para o
item aberto:

```markdown
> ❌ **Conflito Humano 24h — NÃO IMPLEMENTADO.** Versões anteriores deste doc afirmavam
> que um move manual bloqueia a IA. **Isso não acontece.** `KNOWN_ISSUES.md` #-12.
```

Vale também para entradas obsoletas do `KNOWN_ISSUES`: em vez de apagar, marque como
OBSOLETO e aponte para o item que substitui. O texto errado circula fora do repo; deixar o
desmentido rastreável é mais útil do que fazer sumir.

## 6. Toda query SQL precisa ter sido executada

Query de doc é copiada e colada. Uma com caminho de payload errado retorna zero linhas e
passa a impressão de que o sistema está parado — aconteceu com `type='auto:maestro'` e com
`applied.custom_fields_rejected`. Os caminhos corretos estão em
[`_registry/events.md`](./_registry/events.md), e o `docs-verify` falha se os antigos
reaparecerem.

## 7. Mudou pipeline? Rode o verificador

```bash
npm run docs:verify
```

Falha se um canônico, `ruleKey`, campo especial, tag protegida ou `lead_events.type` existir no
código sem linha no registry; se um toggle usado não estiver seedado em migration; ou se um
`code_refs` apontar para arquivo inexistente.

Os [playbooks](./playbooks/) já embutem "atualize o registry X" como passo. Mexeu em pipeline
sem tocar em registry nenhum? Provavelmente esqueceu algo.

## 8. Frontmatter mínimo

```yaml
---
title: "..."
topic: kanban | ai | general
kind: reference | howto | map | troubleshooting | doc
audience: agent
updated: YYYY-MM-DD
verified_at: YYYY-MM-DD
verified_against: <sha>
summary: "Uma frase dizendo a que pergunta este arquivo responde."
code_refs: [...]      # verificados pelo docs-verify
related_docs: [...]
---
```

`summary` é o que um agente lê para decidir se abre o arquivo. Escreva a pergunta que ele
responde, não uma descrição do conteúdo.
