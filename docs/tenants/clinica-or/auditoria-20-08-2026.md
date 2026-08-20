---
title: "Auditoria de 20/08/2026 — estado real do pipeline e do classifier"
topic: kanban
kind: reference
audience: both
status: vigente
tenant: clinica-or
clinic_id: cf038458-457d-4c1a-9ac4-c88c3c8353a1
updated: 2026-08-20
verified_at: 2026-08-20
verified_against: 15f5cb41
summary: "O que a Clínica ÓR é hoje, uma semana depois do Bloco B: dois funis, 13 colunas, o filtro de pipeline que congelou toda a automação do funil de Pacientes desde 13/08, o classifier rodando 5 agentes em modo strict no-move, e os quatro caminhos de movimentação que sobreviveram. Contrasta cada fato com o que a documentação afirma."
related_docs:
  - docs/tenants/clinica-or/FLUXO_ALVO.md
  - docs/tenants/clinica-or/FLUXO_REAL.md
  - docs/tenants/clinica-or/PLANO_IMPLEMENTACAO.md
  - docs/tenants/clinica-or/auditoria-11-08-2026.md
  - docs/roadmap/ROADMAP_DOCS_OR_POS_BLOCO_B.md
code_refs:
  - supabase/functions/pipeline-deterministic/index.ts
  - supabase/functions/_shared/pipeline-move.ts
  - supabase/functions/_shared/ai-pipeline-filter.ts
  - supabase/functions/pipeline-classify/apply.ts
  - supabase/functions/pipeline-auto-finalize-or/index.ts
---

# Auditoria de 20/08/2026 — Clínica ÓR

> **Ordem de confiança (R2):** banco → código → documentação.
> Tudo marcado ✅ foi medido no banco ou lido no código hoje. Tudo marcado ❓ **não
> foi verificado** — trate como suposição até a query da §8 rodar.

**Contexto.** A última auditoria completa é de [11/08](auditoria-11-08-2026.md).
Depois dela aconteceram três coisas que invalidaram quase toda a documentação de
fluxo: o **Bloco B** (13/08, separação em dois funis), o **rename** de
*Reagendamento* para *"Paciente Ativo"* (14/08) e a descoberta de hoje — o funil
de Pacientes está **sem automação nenhuma desde o Bloco B**.

---

## 1. A descoberta de hoje 🔴 — **corrigida em 20/08 às 10:41**

> ✅ **Desfecho.** O funil de Pacientes (`0ac4e0ad-bf6b-46d7-85b7-2fafff493b96`) foi
> acrescentado a `ai_target_pipeline_ids` e os **134 pacientes presos** foram
> reprocessados via `notify_pipeline_deterministic`. *Paciente Inativo* caiu de
> **603 para 481**; *Paciente Ativo* subiu para **145**. Zero presos restantes.
>
> ⚠️ Duas lições no reprocessamento: o filtro fica **30s em cache por instância**
> da edge (esperar antes do backfill), e das 134 chamadas `pg_net` **12 não foram
> entregues, sem deixar rastro** — só apareceram porque a contagem foi conferida.
> É o achado A5 na prática. Bastou repetir o backfill.
>
> **Continua aberto:** A2 — as regras de 7d e 60d seguem desligadas, então
> *Paciente Ativo* hoje **só enche**. Nada tira card de lá automaticamente.

**`clinics.settings.ai_target_pipeline_ids` continha apenas o funil de Vendas.**

```
[ { "funil": "Clínica ÓR — Vendas", "id": "17c27f4d-8256-4ea7-b5b9-ed706494f686" } ]
```

O gate vive em `pipelineMove` ([_shared/pipeline-move.ts:150](../../../supabase/functions/_shared/pipeline-move.ts)),
via `isAiAllowedForPipeline` ([_shared/ai-pipeline-filter.ts](../../../supabase/functions/_shared/ai-pipeline-filter.ts)).
O nome engana: apesar do `ai_`, ele **não filtra só a IA** — barra qualquer
movimentação cuja `source` comece com `auto:`. Como o Bloco B levou 6 colunas para
o funil novo e ninguém marcou esse funil na lista, **toda regra automática do funil
de Pacientes morre no gate**, em silêncio, desde 13/08.

Medido hoje:

| Medida | Valor |
|---|---|
| Disparos de `auto:reactivation-inbound` em 30d | **319** |
| ↳ barrados com `pipeline_not_in_ai_targets` | **294** (92%) |
| ↳ que moveram (todos no funil de Vendas) | 25 |
| Leads em *Paciente Inativo* que responderam e não saíram | **134** |
| Moves *Paciente Ativo* → *Paciente Inativo* em 30d | **0** |

O último barrado foi hoje às 09:52. A tela de Configurações chama isso de
*"Filtro de Pipelines da IA"* e o texto do card já diz "a Inteligência Artificial
**e as automações**" — o comportamento é o desenhado; o que faltou foi marcar o
funil novo ao criá-lo, e nenhuma doc avisa que criar pipeline exige esse passo.

**Efeito colateral simétrico:** o mesmo filtro roda no
[`pipeline-classify/index.ts:135`](../../../supabase/functions/pipeline-classify/index.ts).
A IA também **não lê** nenhum lead do funil de Pacientes desde 13/08 — sem resumo,
sem chips, sem tags. O que reduziu custo por acidente.

---

## 2. Topologia — 2 funis, 13 colunas ✅

### Funil de Vendas — `17c27f4d-8256-4ea7-b5b9-ed706494f686`

| Coluna | UUID | Canônico | Alias |
|---|---|---|---|
| Leads de entrada | `b1aa2fc9` | `Novo` | ✅ |
| Qualificação | `c6eb67f3` | `Qualificação` | ✅ |
| Sem resposta | `9f408ae6` | `Sem resposta` | ✅ |
| Nutrição Inativa (Geladeira de Leads) | `64356dbe` | `Nutrição inativa` · `nutricao_inativa` · `geladeira_de_leads` | ✅ |
| Desqualificado / Fora de escopo | `35670cad` | — | ❌ **D1 continua** |
| Administrativo | `23a7bfd7` | `B2B / Stakeholders` (legado) | ✅ |
| Nutrição Antigos (migrada) | `9de8e54e` | — (alias apagado de propósito) | ❌ |

### Funil de Pacientes — `Clínica ÓR — Pacientes`

| Coluna | UUID | Canônico | `lock_auto_move` |
|---|---|---|---|
| Consulta agendada | `e12f004a` | `Consulta agendada` | false |
| **Paciente Ativo** | `6f492197` | **`Reagendamento`** | false |
| Tratamento agendado | `98320189` | `Tratamento agendado` | false |
| Consulta finalizada | `7584241f` | `Consulta finalizada` | false |
| Tratamento Finalizado | `2a352661` | `1ª Sessão Finalizada` · `em_tratamento` · `primeira_sessao_finalizada` | false |
| **Paciente Inativo** | `7fea97d7` | **`Paciente antigo`** | false |

Os 17 aliases estão coerentes (`alias_pipeline_ok = true` em todos) e nenhum lead
ficou com funil e coluna desalinhados (`inativos_com_funil_errado = 0`).

> ⚠️ **Nome de tela ≠ nome canônico, e a distância só cresceu.** *Paciente Ativo*
> resolve por `Reagendamento`; *Paciente Inativo* resolve por `Paciente antigo`.
> Quem lê o código sem saber disso não encontra a regra que procura — e quem lê a
> doc encontra o nome de 11/08.

> ⚠️ Nenhuma coluna tem `lock_auto_move = true`: **o gate G2 não protege nada**,
> igual a 11/08.

---

## 3. Regras determinísticas — o que existe no código ✅

`pipeline-deterministic` expõe 9 ações. Todas passam por `pipelineMove`.

| Ação | Dispara por | Move | Toggle | Estado hoje |
|---|---|---|---|---|
| `novo-lead` | trigger INSERT em `leads` | → `Novo` | `automation.novo_lead.enabled` | Vendas — ok |
| `secretary-replied` | 1ª mensagem outbound | `Novo` → `Qualificação` | `automation.secretary_replied.enabled` | Vendas — ok |
| `reactivation-inbound` | trigger INSERT em `messages` (`from_me=false`) | `Nutrição inativa`/`Sem resposta` → `Qualificação` · `Paciente antigo`/`Consulta finalizada`/`1ª Sessão Finalizada` → `Reagendamento` | `automation.reactivation_inbound.enabled` = `true` | 🔴 **92% barrado** (§1) |
| `appointment-sync` | trigger em `appointments` | agendado → colunas de agenda · realizado → finalizadas · faltou/cancelado → `Reagendamento` | `automation.appointment_sync.enabled` | 🔴 barrado no funil de Pacientes |
| `field-changed` | UPDATE de `leads.custom_fields` | data preenchida → agendada 🔀 · **data apagada** → `Reagendamento` | `automation.appointment_sync.enabled` | 🔴 idem |
| `inactivity-tick` | cron | 24h de silêncio em `Qualificação` → `Sem resposta` | `automation.followup_24h.enabled` | Vendas — ❓ cron não verificado |
| `reactivation-tick` | cron | **só aplica tag** `reativacao` | `automation.reactivation.enabled` | ❓ |
| `human-reactor-tick` | cron | limpa `precisa_atencao_humana` após 7d | `automation.human_reactor.enabled` | ❓ |
| `monthly-sweep-tick` | — | nada | — | stub morto (Etapa 5) |

🔀 = travessia entre funis, exige linha em `pipeline_crossings` (gate G9).

### Gates do `pipelineMove`, na ordem real de execução

| # | Gate | O que faz hoje |
|---|---|---|
| G3 | toggle em `app_settings` | só vale para `auto:*`; default fail-safe `false` |
| G4 | idempotência via `lead_events` | grava só em move bem-sucedido — **falha não deixa rastro** |
| — | allowlist por clínica (`pipeline_automation_allowlist`) | ❓ não verificada |
| — | **filtro `ai_target_pipeline_ids`** | 🔴 **barra o funil de Pacientes inteiro** (§1) |
| G9 | travessia entre funis via `pipeline_crossings` | humano e `system:*` passam direto |
| G2 | `lock_auto_move` no destino | inerte — nenhuma coluna marcada |
| D3 | "paciente antigo não sai por automação" | ☠️ **morto**: compara com a string `"Paciente antigo"` e a coluna se chama `Paciente Inativo` desde 13/08 |
| V5 | wipe de chips | sai de `Qualificação` limpa `interesse`; entra em `Consulta finalizada` limpa datas e marca `aguardando` |
| G8 | UPDATE restrito a `stage_id` | `pipeline_id` só em travessia |
| G5 | histórico em `lead_stage_history` | UPSERT que enriquece a linha do trigger |

> **D3 morrendo por rename foi sorte, não projeto.** Se a coluna tivesse mantido o
> nome, ela bloquearia a própria regra que hoje tira o paciente de lá. A constante
> `PACIENTE_ANTIGO_NAME` continua no código, apontando para um nome que não existe.

### O rastro que falta

Quando um move é **recusado**, `pipelineMove` devolve `{moved:false, reason}` e
**não grava nada**. Só sobrevive o que a regra registrar por conta própria em
`lead_events.payload.res.reason` — foi o que permitiu medir a §1. Regras que
desistem antes de chamar `pipelineMove` (todos os `skipped:*`) são **invisíveis**.

---

## 4. Classifier — 5 agentes, nenhum move ✅

| Afirmação da doc | Realidade no código |
|---|---|
| "V7: 2 agentes (Resumidor + Tipificador)" | ❌ **5 agentes** rodam: Resumidor, Agendador, Preenchedor, Movimentador, Maestro (`agent-core.ts`) |
| "a IA move cards — 64 moves em 30 dias" (11/08) | ❌ não mais: `apply.ts` §6 é **strict no-move** (`strict_no_move:ai_movement_removed`) |
| "modelos OpenAI" | ⚠️ default é **Gemini via Lovable AI Gateway**; OpenAI é rollback |

O Movimentador continua produzindo `stage_suggestion` — e a sugestão é **descartada**
logo depois. Cinco agentes por lead, dos quais um existe para ter a saída jogada
fora. É custo puro, e é a explicação mais provável para a conta de IA.

O que o classifier ainda faz e vale: resumo, chips/campos com **G10** (trava de 7
dias sobre edição humana), lock vitalício de `origem`, whitelist de tags, e a
regra determinística de "1ª consulta". Datas de agendamento continuam proibidas.

---

## 5. Os quatro caminhos de movimentação que existem hoje ✅

| Caminho | `source` | Estado |
|---|---|---|
| `pipeline-deterministic` (9 regras) | `auto:*` | §3 — barrado no funil de Pacientes |
| `automations-tick` → ação `move_stage` | `auto:automation-rule` | as **2 automações do funil de Pacientes estão desligadas** |
| `ai-chat` → ferramenta `move_lead_stage` | `auto:ai-chat-tool` | toggle `automation.ai_chat_move.enabled` — ❓ valor não verificado |
| Secretária na UI | `manual` / `ui` | passa por todos os gates que ignoram humano |

E um caminho **indireto**, que a documentação de fluxo não menciona:

⚪ **`pipeline-auto-finalize-or`** — cron a cada 15 min, exclusivo da ÓR, marca como
`realizado` todo `appointment` com `status='agendado'` no passado; o trigger então
chama `appointment-sync`, que moveria o card para *Finalizada* sozinho.

> ✅ **Medido em 20/08 11:05: a tabela `appointments` da clínica está VAZIA.**
> Zero registros, de qualquer `kind` ou `status`. A função roda a cada 15 minutos
> sobre nada, e **toda a regra `appointment-sync` é código morto neste tenant** —
> inclusive os caminhos de `faltou` e `cancelado` que mandariam o card para
> *Paciente Ativo*. O FLUXO_ALVO §2.2 está certo: a saída para *Finalizada* é
> manual mesmo.

🔴 **Consequência maior:** **o agendamento na ÓR é 100% por campo de data no card.**
Quem move o paciente para as colunas de agendamento é `auto:field-changed-*`, lendo
`consulta_agendada_em` / `procedimento_agendado_em`. Toda doc que descreve o fluxo
via compromissos descreve um mecanismo que este tenant não usa — e qualquer regra
futura que dependa de `appointments` nasce morta.

---

## 6. Automações e sequências do funil de Pacientes ✅

| Item | Coluna | Ligada |
|---|---|---|
| Automação `ÓR — Reagendamento 7d → Paciente Inativo` (`stage_idle`) | Paciente Inativo | ❌ |
| Automação `ÓR — Finalizada 60d → Paciente Inativo` (`stage_idle`) | Paciente Inativo | ❌ |
| Sequência `ÓR — Reativação Paciente Antigo` | Paciente Inativo | ❌ |

As duas regras temporais que o FLUXO_ALVO trata como espinha do funil de Pacientes
(7 dias e 60 dias) **existem cadastradas e estão desligadas**. Mesmo que o filtro da
§1 seja corrigido, elas continuam sem rodar até alguém ligar o switch.

Nenhuma sequência vinculada a *Paciente Ativo* — ou seja, destravar o funil **não
dispara mensagem em massa**.

---

## 7. O que a documentação afirma e não é mais verdade

| Doc | `updated` | O que quebrou |
|---|---|---|
| `FLUXO_REAL.md` | 11/08 · `vigente` | Descreve **1 funil e 12 colunas**. Hoje são 2 funis e 13 colunas. Metade dos 14 defeitos (D2, D6, D10–D13 — "a IA move") morreu com o strict no-move |
| `README.md` (tenant) | 10/07 | "V7 = 2 agentes", *Paciente Antigo*, *Nutrição Antigos*, guard D3 vivo. Sem `status:` |
| `agentes-e-modelos.md` | 27/07 | "V7 determinístico, 2 agentes" — são 5. Sem `status:` |
| `gatilhos-e-automacoes.md` | 27/07 | SLA de 48h que nunca existiu; `faltou` → *Sem resposta* (hoje → *Paciente Ativo*); sweep mensal que foi removido em 13/08 |
| `fluxo.md` | 17/07 | Diagrama de 11 colunas num funil só; 3 sequências que hoje são outras |
| `tags-chips-e-campos.md` | 06/08 | Cita `ciclo_concluido` como gatilho que move — **aposentado na Etapa 5** |
| `glossario-e-bugs.md` | 17/07 | Cita `pipeline-inactivity-tick`, que não existe |
| `_registry/stages.md` | 12/08 | O mais correto de todos, mas anterior ao rename: chama a coluna de *Reagendamento* e não de *Paciente Ativo* |
| `_registry/toggles.md` | 07/08 | **Não lista** `ai_target_pipeline_ids` nem a allowlist por clínica — as duas chaves que congelaram o funil |
| `maps/PIPELINE_RUNTIME.md` | — | Menciona o filtro em uma linha, como se fosse só da IA |
| `FLUXO_ALVO.md` | 14/08 | É `planejado`, e está **quase todo implementado** — mas diz "manual → Finalizada" (§5) e não conhece o filtro |
| `pipeline/runtime/*.md` (18 arquivos) | 18–23/06 | Congelados desde junho; a triagem de 11/08 já mandou reescrever |

**O verificador não pegou nada disso.** `npm run docs:verify` passa verde hoje —
ele compara **código ↔ registry** e ninguém compara **registry ↔ banco**. O filtro
da §1 é um fato que só existe no banco.

---

## 8. Não verificado — a query que fecha o mapa ❓

Nada abaixo foi conferido: crons ativos, valor de cada toggle, `is_default` do
funil de Vendas, travessias declaradas, contagem por coluna, whitelist de tags,
tipos de compromisso, config do classifier.

```sql
select jsonb_pretty(jsonb_build_object(
  'funis', (select jsonb_agg(jsonb_build_object(
        'nome', p.name, 'id', p.id, 'default', p.is_default, 'colunas',
        (select count(*) from pipeline_stages s where s.pipeline_id = p.id)) order by p.position)
      from pipelines p where p.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'),
  'colunas', (select jsonb_agg(jsonb_build_object(
        'funil', p.name, 'coluna', s.name, 'pos', s.position,
        'terminal', s.is_terminal, 'lock', s.lock_auto_move,
        'leads', (select count(*) from leads l where l.stage_id = s.id and l.archived_at is null))
        order by p.position, s.position)
      from pipeline_stages s join pipelines p on p.id = s.pipeline_id
     where s.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'),
  'travessias', (select jsonb_agg(jsonb_build_object(
        'de', a.name, 'para', b.name, 'gatilho', c.trigger_key,
        'auto', c.allow_auto, 'ligada', c.enabled))
      from pipeline_crossings c
      join pipeline_stages a on a.id = c.from_stage_id
      join pipeline_stages b on b.id = c.to_stage_id
     where c.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'),
  'toggles', (select jsonb_object_agg(key, value)
      from app_settings where key like 'automation.%'),
  'crons', (select jsonb_agg(jsonb_build_object(
        'job', jobname, 'schedule', schedule, 'ativo', active))
      from cron.job),
  'automacoes', (select jsonb_agg(jsonb_build_object(
        'nome', a.name, 'ligada', a.enabled, 'gatilho', a.trigger_type,
        'acao', a.action_type, 'config', a.trigger_config))
      from automations a where a.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'),
  'sequencias', (select jsonb_agg(jsonb_build_object(
        'nome', s.name, 'ligada', s.enabled, 'passos',
        (select count(*) from message_sequence_steps st where st.sequence_id = s.id)))
      from message_sequences s where s.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'),
  'tipos_compromisso', (select jsonb_agg(jsonb_build_object(
        'kind', t.kind_name, 'ativo', t.is_active))
      from clinic_appointment_types t
     where t.clinic_id = 'cf038458-457d-4c1a-9ac4-c88c3c8353a1'),
  'tags_whitelist', (select jsonb_array_length(value)
      from app_settings where key = 'automation.v42.allowed_tags')
)) as raio_x;
```

---

## 9. Achados abertos, por gravidade

| # | Achado | Gravidade |
|---|---|---|
| ~~**A1**~~ | ~~Funil de Pacientes fora de `ai_target_pipeline_ids`~~ ✅ **resolvido 20/08 10:41** — funil marcado, 134 presos reprocessados | — |
| **A2** | As 2 regras temporais do funil de Pacientes (7d e 60d) estão **desligadas** | 🔴 |
| **A3** | `appointments` **vazia**: `appointment-sync` e `pipeline-auto-finalize-or` são código morto na ÓR. Agendamento é 100% por campo de data | 🟠 |
| **A4** | Classifier gasta 5 agentes por lead e joga a saída do Movimentador fora | 🟠 |
| **A5** | Recusa de move não deixa rastro — diagnóstico depende de `logEvent` por regra | 🟠 |
| **A6** | Guard D3 e a constante `PACIENTE_ANTIGO_NAME` viraram código morto pelo rename | 🟡 |
| **A7** | G2 inerte: nenhuma coluna com `lock_auto_move` | 🟡 |
| **A8** | *Desqualificado* segue sem canônico (D1 de 11/08) | 🟡 |
| **A9** | `docs:verify` não cobre banco — o registry pode estar certo e a produção parada | 🟡 |

O plano para consertar a **documentação** está em
[ROADMAP_DOCS_OR_POS_BLOCO_B.md](../../roadmap/ROADMAP_DOCS_OR_POS_BLOCO_B.md).
A1 e A2 são operação, não doc, e são urgentes.
