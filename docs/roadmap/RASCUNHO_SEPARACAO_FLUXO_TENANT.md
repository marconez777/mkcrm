---
title: "RASCUNHO — Separação total de fluxo por tenant"
topic: kanban
kind: roadmap
audience: both
updated: 2026-08-11
summary: "Documento de trabalho para a separação COMPLETA de fluxo por cliente. Premissa inegociável: não existe fluxo padrão e nunca vai existir. Define o que é motor (compartilhado) e o que é fluxo (100% isolado por tenant), diagnostica por que a separação já construída nunca entrou em vigor, e fixa a ordem de trabalho: ordenar a casa → mapear o fluxo real da ÓR → corrigir → só então alterar."
related_docs:
  - docs/roadmap/PIPELINE_TENANT_ROADMAP.md
  - docs/tenants/clinica-or/auditoria-11-08-2026.md
code_refs:
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/app-settings.ts
---

# RASCUNHO — Separação total de fluxo por tenant

> 🚧 Documento de trabalho e planejamento. Não é ordem de execução.

---

# ⚠️ PREMISSA INEGOCIÁVEL

> # **NÃO EXISTE FLUXO PADRÃO.**
> # **NUNCA VAI EXISTIR.**
>
> **Cada cliente terá um fluxo COMPLETAMENTE diferente. Nada igual. Zero.**
>
> Colunas diferentes, gatilhos diferentes, campos diferentes, chips diferentes,
> vocabulário diferente, ciclo de vida diferente.
>
> **Toda proposta que assuma "núcleo comum de negócio", "fluxo base",
> "padrão com exceções" ou "a ÓR como referência" está ERRADA POR CONSTRUÇÃO
> e deve ser rejeitada sem discussão.**
>
> Cada cliente é uma **exceção**. A exceção é a regra.
>
> Esta decisão foi repetida diversas vezes desde o início do projeto e continua
> sendo violada pelo código. Está aqui em destaque para que nenhuma
> conversa futura — humana ou com IA — reintroduza a premissa errada.

---

## 1. A distinção que sustenta tudo: MOTOR ≠ FLUXO

Separação total do **fluxo** não significa duplicar o **motor**. A distinção:

| | **MOTOR** (mecânica) | **FLUXO** (negócio) |
|---|---|---|
| O que é | Capacidade de mover card, gravar histórico, avaliar regra, registrar log, garantir idempotência | Quais colunas existem, o que dispara o quê, quais campos, quais chips, quais palavras, quais prazos |
| Sabe o que é "Qualificação"? | **NUNCA** | Sim — é a definição dele |
| Compartilhado? | Sim | **NUNCA** |
| Onde mora | Código | Dados, por tenant |

**O defeito de hoje não é motor compartilhado — é motor com regra de negócio dentro.**

Exemplos concretos de contaminação, todos verificados no código:

- `pipeline-move.ts` — helper genérico de movimentação — sabe que sair de
  `"Qualificação"` apaga o chip `interesse`, e que entrar em `"Consulta finalizada"`
  apaga 4 campos e liga `aguardando`. Isso é fluxo da ÓR dentro do motor.
- `pipeline-move.ts` sabe o que é `"Paciente antigo"` e tem uma guarda dedicada.
- `trg_lead_needs_extraction` — trigger **global** — procura *cetamina*, *EMT* e
  *EMDR* nas mensagens de **todas** as clínicas do banco.
- `schema.ts` define em TypeScript o conjunto fechado de colunas possíveis
  (`CANON_NAMES`) e de intenções (`INTENT_VALUES`).
- `apply.ts` embute a "Transição Agendamento Humano" — uma decisão da ÓR — como
  constante aplicada a todos.

**Critério de aceite da separação:** buscar por `"Qualificação"`, `"Paciente antigo"`,
`cetamina`, `EMDR` ou qualquer UUID de coluna dentro de `supabase/functions/` deve
retornar **zero** resultados. Tudo isso pertence ao fluxo da ÓR, não ao sistema.

---

## 2. A situação é mais favorável do que parece: existe UM tenant

**Hoje só a Clínica ÓR usa pipeline com eventos, gatilhos e IA.** Isso significa:

- ✅ Não há migração de múltiplos clientes para coordenar
- ✅ Não há risco de quebrar o tenant B ao arrumar o A
- ✅ Todo comportamento hardcoded hoje **pertence à ÓR** — não é herança compartilhada, é o fluxo dela no lugar errado

E leva à síntese que reconcilia sua ordem de trabalho com o objetivo de arquitetura:

> ### Arrumar a ÓR e separar os tenants são a MESMA tarefa.
>
> Como a ÓR é o único tenant, cada regra dela que hoje vive em constante global
> **é** a contaminação. Mover essa regra para a definição de fluxo da ÓR
> simultaneamente (a) corrige o defeito e (b) esvazia o motor.
>
> Não são duas fases. É uma, feita na ordem certa.

### Por que a ÓR é o caso complexo

O paciente **não sai do funil**: entra como lead novo, vira paciente, e depois vira
paciente antigo — **no mesmo pipeline**. O funil é um ciclo, não uma linha. Daí
vêm o guard D3, o sweep mensal, as duas geladeiras e o wake-up. Um fluxo que
volta para trás é estruturalmente mais difícil que um funil linear de vendas.

**Isto NÃO é o padrão.** É o fluxo da ÓR.

---

## 3. Por que a separação que você já construiu não entrou em vigor

A separação **foi construída**: registry no banco, helpers de tenant, template
clonável. O `PIPELINE_TENANT_ROADMAP.md` marca G1, G2, G3, G5, G9, G14 e G16 como
concluídos. Nada disso governa a ÓR. São **três desconexões independentes**:

### 3.1 O template existe e nunca foi clonado

`_template_pipeline_classify/` está completo e é o **único** consumidor dos helpers
`getTenantToggle` / `getTenantSetting`. Nenhuma outra edge function os chama.
Foi feito para ser copiado por tenant (tem a constante `TENANT_SLUG`) e **nunca foi
copiado — nem para a ÓR**, que roda o `pipeline-classify` compartilhado.

### 3.2 O registry saiu sem as colunas de roteamento

| Coluna especificada no roadmap (G3) | Existe? |
|---|---|
| `slug` · `edge_function_name` · `cron_enabled` · `byok_required` · `notes` | ❌ |
| `clinic_id` | ✅ |

A [migração 20260718003615](../../supabase/migrations/20260718003615_a2a21487-6d59-445b-9a2d-264ec49e71fd.sql)
comenta a divergência em voz alta. **As três colunas ausentes eram exatamente as de
roteamento** — sem `edge_function_name` nada decide qual função roda para qual
clínica; sem `slug` não se monta a chave `automation.<slug>.*` que os helpers
esperam. G3 foi marcado ✅ tendo entregue uma tabela de *configuração* onde o plano
pedia uma de *roteamento*.

### 3.3 Metade do registry não é lida

| Campo | Lido? |
|---|---|
| `enabled` · `classifier_version` · `override_prompts` · `allowed_intents` | ✅ |
| **`active_agents`** · **`locked_stages`** | ❌ **nunca** |

Os dois ignorados são os **comportamentais**. Dá para personalizar o que a IA
*fala*; o que ela *faz* é global. É a causa direta do defeito 🔴 da
[auditoria de 11/08](../tenants/clinica-or/auditoria-11-08-2026.md): a ÓR está
configurada como "2 agentes, 4 colunas travadas" e roda 5 agentes movendo cards.

### 3.4 A raiz estrutural

**`app_settings` é `key TEXT PRIMARY KEY` — sem `clinic_id`.** São ~45 toggles
`automation.*` globais. Desligar uma regra da ÓR desligaria de todos.

---

## 4. Já existem CINCO mecanismos de regra, três pela metade

| # | Mecanismo | Estado |
|---|---|---|
| 1 | `automations` + `automations-tick` | vivo — 6 regras na ÓR |
| 2 | `pipeline-deterministic` (9 regras em TypeScript) | vivo |
| 3 | `pipeline_field_rules` | **tabela órfã — zero leitores** |
| 4 | `stage_sequence_bindings` | código vivo, tabela vazia ("dormente") |
| 5 | Triggers SQL com UUID hardcoded | vivo |

`pipeline_field_rules` já é um motor declarativo — `priority`, `enabled`,
`conditions jsonb`, escopo por clínica e pipeline. Criada em 11/06, semeada em
13/06, **abandonada sem nunca ter sido lida**.

> **A pergunta do Caminho C não é "vale a pena construir?" — é "C consolida os
> cinco ou vira o sexto?"** Se nascer ao lado, multiplica o conflito. Só vale se
> absorver 1, 2, 3 e substituir 5.

---

## 5. Caminho escolhido: **C — fluxo como dado, por tenant**

### 5.1 Decisões já tomadas

| # | Decisão |
|---|---|
| D1 | Fluxo 100% por tenant, sem padrão e sem fallback global |
| D2 | Motor compartilhado, **sem nenhuma semântica de negócio** |
| D3 | **Nenhuma configuração pode ter default global.** Ausência de regra = não faz nada |
| D4 | A IA **só lê**: resumo e chips. Não move card, não decide etapa |
| D5 | Ordem: ordenar a casa → mapear → corrigir → só então alterar |

### 5.2 Separação lógica ou tabelas físicas por tenant?

Você levantou criar tabela por cliente. **Recomendação: separação lógica
(`clinic_id` em tudo) + proibição de default global — não tabelas físicas.**

O raciocínio: o conflito de hoje **não vem de tabela compartilhada**. `automations`,
`lead_custom_fields` e `stage_canonical_aliases` são compartilhadas, escopadas por
clínica, e **nunca deram conflito entre tenants**. O conflito vem de duas outras
fontes:

1. Configuração **sem dimensão de tenant** (`app_settings`)
2. Regra de negócio **em constante de código**

Tabela física por tenant não resolve nenhuma das duas e adiciona custo de operação
(migração ×N, query dinâmica, RLS por tabela). **O isolamento vem de eliminar o
global, não de partir a tabela.**

> Se depois quisermos parede mais dura, o passo é *schema* por tenant, não tabela
> por tenant. Fica registrado como opção, não como plano.

### 5.3 Seis decisões de desenho do motor

Separam "consolidação" de "sexto mecanismo":

1. **Vocabulário fechado, não motor genérico.** Conjunto pequeno de gatilhos e
   ações, crescendo sob demanda. É o que `automations` faz e funcionou.
2. **Dois tipos de regra desde o dia 1: ação e guarda.** Guardas avaliadas antes,
   sempre vencem, com lista de exceções. Guarda que entra depois entra como remendo.
3. **Modelar TRANSIÇÃO, não evento.** A unidade é `(origem, destino, ator)` com
   efeitos aplicados na **mesma transação** do move. É o que permite expressar o
   wipe de chips sem abrir janela de inconsistência. Escolha mais difícil de
   reverter — merece o maior cuidado.
4. **Escape hatch honesto.** Regra que não couber em dado vira tipo `handler`
   apontando para função registrada, **listada na mesma tabela**. O fluxo continua
   legível num lugar só, sem fingir que tudo virou dado.
5. **Trace obrigatório e testado.** Cada avaliação grava quais regras foram
   consideradas, qual casou e por que as outras não. O `failure_reasons` que grava
   `{}` desde sempre prova que observabilidade não testada não existe.
6. **Migrar os cinco, não criar o sexto.** `pipeline_field_rules` é candidata a
   esqueleto: schema adequado, órfã, sem dados de produção — reaproveitar ou apagar
   sem custo.

### 5.4 O que resiste a virar dado (e precisa do item 4)

Quatro propriedades tornam uma regra difícil de declarar. As regras da ÓR têm três
delas combinadas:

| Regra | Propriedade que resiste |
|---|---|
| **Guard D3** | Bloqueia em vez de agir · depende do **ator** (proibido p/ automação, livre p/ humano) · é "nunca, exceto" |
| **Wipe de chips** | Depende de origem **e** destino ao mesmo tempo · precisa ser **transacional** com o move · é read-modify-write sobre JSONB |
| **Tiers 24h/3d/7d** | Exclusividade mútua **implícita** na estrutura `if/else if` — some na tradução |
| **Chaves de idempotência** | Identidade da regra depende do dado (`field-changed-consulta:{lead}:{data}`) |

---

## 6. Ordem de trabalho

> Sequência definida com o cliente. **Não pular etapa.**

### FASE 0 — Ordenar a casa 🔜 *próxima*

Enquanto código, banco e documentação se contradizem, qualquer diagnóstico é
chute. **Deletar o que está errado** e estabelecer fonte de verdade única.

Candidatos a remoção/correção (a confirmar item a item antes de apagar):

| Item | Ação proposta |
|---|---|
| `pipeline_field_rules` | Tabela órfã — apagar **ou** promover a esqueleto do motor |
| `stage_sequence_bindings` | Dormente — decidir uso ou remover |
| `_template_pipeline_classify/` | Nunca clonado — canibalizar (dry-run e helpers são bons) ou remover |
| `index.v1.ts` | Caminho legado que ainda lê 2 toggles vivos — remover |
| `ruleConsultaPassou` | ~90 linhas inalcançáveis — remover |
| `modalidade_preferida` | Campo deletado, ainda no schema da IA — remover |
| `scripts/docs-sync.mjs` | Referenciado em `package.json` e na skill; **não existe** desde 18/06 — reescrever ou remover as referências |
| Migrações que nunca chegaram | 3 automações existem em migração e não no banco — reconciliar |
| `docs/pipeline/runtime/` | Congelado em 22/06; contradiz produção em vários pontos — corrigir ou marcar como histórico |
| `PIPELINE_TENANT_ROADMAP.md` | Marca ✅ itens que não estão em vigor — reverificar cada um |
| `csv/` + `.env` no repo público | Dado de paciente e chave de API versionados — remover e rotacionar |

### FASE 1 — Mapear o fluxo REAL da ÓR

Documento definitivo de "como está hoje", construído a partir de **banco +
código**, nunca de documentação. Coluna a coluna, gatilho a gatilho, campo a
campo, chip a chip. Base já levantada na
[auditoria de 11/08](../tenants/clinica-or/auditoria-11-08-2026.md).

### FASE 2 — Cliente aponta os erros → corrigir

Com o mapa na mão, o cliente marca o que está errado e corrigimos. **A correção
já deve mover a regra para a definição de fluxo da ÓR** — corrigir e separar na
mesma operação (§2).

### FASE 3 — Motor limpo + fluxo da ÓR como dado

Ao fim, o critério de aceite da §1 deve passar: zero semântica da ÓR dentro de
`supabase/functions/`.

### FASE 4 — Alterações novas de negócio

Só depois da casa em ordem. Já sinalizadas pelo cliente, ainda não detalhadas:

- Ajustes no fluxo de **pagamento** (algo não está bom; haverá remoções)
- **Coluna nova** no pipeline

Se a Fase 3 estiver certa, estas mudanças são **configuração, não código**. Se
exigirem código, o modelo está errado — e é melhor descobrir com mudança conhecida
do que com tenant novo.

### FASE 5 — Onboarding do 2º tenant

Fluxo do zero, sem herdar nada da ÓR. É o teste real da separação.

---

## 7. Ponto a esclarecer na Fase 1

**"IA só lê e coloca os chips" (D4) precisa de uma verificação factual:** hoje os
chips **não** são colocados pela IA. Quem os cria é o trigger
`trg_lead_needs_extraction` — regex em SQL — que também escreve 13 campos
diretamente. A IA (`pipeline-classify`) faz resumo, tags e campos, e hoje também
move card (defeito conhecido).

Ou seja, "a IA que coloca os ticks" descreve o efeito visível, mas o mecanismo é
outro. Isso importa porque **o vocabulário de chips é 100% da ÓR e está global** —
é um dos primeiros itens a migrar para a definição de fluxo do tenant.

A decidir na Fase 1: os chips continuam vindo de regex por tenant, passam a vir da
IA, ou os dois caminhos coexistem com papéis distintos.

---

## 8. Riscos registrados

- **A documentação não é confiável como ponto de partida.** A auditoria de 11/08
  refutou 3 conclusões tiradas de `docs/pipeline/runtime/`. Ordem de confiança:
  **banco → código → documentação**.
- **O repositório diverge da produção.** Três automações presentes em migrações não
  existem no banco.
- **Não sabemos o que está deployado.** As Edge Functions rodam na infra da
  Supabase e o repositório pode estar atrás. Lacuna ainda não coberta.
- **Contaminação reintroduzida por descuido.** Sem o critério de aceite da §1 rodando
  como verificação, uma constante nova volta a virar padrão global.

---

## 9. Alterações aplicadas

### 2026-08-11 — Gate por tenant no motor de chips

**Decisão registrada:** os chips continuam vindo de **regex, por tenant**. Hoje,
exclusivo da Clínica ÓR.

[`20260811170000_scope_lead_extraction_per_tenant.sql`](../../supabase/migrations/20260811170000_scope_lead_extraction_per_tenant.sql)
adiciona um gate em `trg_lead_needs_extraction`, que até então rodava o
vocabulário psiquiátrico da ÓR em **toda mensagem inbound de todas as clínicas**.

- Gate lê `clinics.settings.lead_extraction_enabled` — **sem default global**
  (decisão D3): clínica sem a flag não recebe extração alguma
- A função **não carrega UUID de clínica**; o tenant é nomeado apenas no seed
- Os regex ficaram **byte a byte idênticos** — verificado por diff. Comportamento
  da ÓR inalterado
- Efeito colateral desejado: leads de outras clínicas param de receber
  `needs_ai_review = true` por este caminho, esvaziando a fila-lixo do classifier

**O que isto NÃO faz:**

- Não move os padrões para tabela por clínica — o vocabulário da ÓR continua
  embutido na função. Isso é Fase 3 (`clinic_extraction_rules`)
- Não corrige o acúmulo de chips (auditoria §3.8) — `ai_review_reasons` continua
  crescendo sem limpeza
- Não altera o que a IA faz

**Não aplicado no banco.** Migração criada, aguardando execução.
