
# Cascata de follow-up até Nutrição

## Fluxo desejado

```
[Qualificação] ──┐
[Fech. pend. consulta] ─┼─ 24h sem resposta ──► [lead parou de responder]
[Fech. pend. proced.] ──┘                              │
                                                       ├─ +24h: follow-up 1 (template)
                                                       ├─ +48h: follow-up 2 (template)
                                                       └─ +72h: move ──► [Nutrição de Leads Inativos]
                                                                                │
                                                                                └─ stage_enter → sequence "Nutrição"
```

Você configura os textos dos templates e da sequência depois pela UI — esta entrega cria só o encanamento (capacidade do motor + UX) para você plugar tudo.

## Gap atual

Hoje `automations.trigger_config` aceita só **um** `stage_id`. Para cobrir 3 colunas precisaríamos criar 3 automations clonadas. Vamos ampliar o motor para aceitar **lista de stages** — assim 1 automação cobre as 3 colunas e fica fácil manter.

## Mudanças

### 1. Backend — `automations-tick`
Em `findCandidates`, para `no_reply_after` e `stage_idle`:
- Se `trigger_config.stage_ids` (array) presente → `.in("stage_id", stage_ids)`.
- Mantém compat com `stage_id` (single) — se ambos vierem, `stage_ids` ganha.
- Sem mudança de schema (campo é JSONB).

### 2. Frontend — `src/pages/Automations.tsx`
- Substituir `<Select stage_id>` por **multi-select** (checkbox list de stages do pipeline default) para `no_reply_after` e `stage_idle`.
- Persiste como `stage_ids: string[]`. Migra leitura: se ler `stage_id` legado, hidrata como `stage_ids:[stage_id]`.
- Stage da **ação** `move_stage` continua single-select (sem mudança).

### 3. Seed das 3 automations (via insert tool, opt-in)
Pergunto antes de inserir — mas o plano contempla criar:

| # | Nome | Trigger | Ação | Cooldown |
|---|---|---|---|---|
| A1 | `Sem resposta 24h → Parou de responder` | `no_reply_after` 24h em `[Qualificação(2), Fech. pend. consulta, Fech. pend. proced.]` | `move_stage` → `lead parou de responder` | 72h |
| A2 | `Parou de responder — Follow-up 24h` | `no_reply_after` 24h em `[lead parou de responder]` | `send_template` (placeholder até você criar) | 48h |
| A3 | `Parou de responder — Follow-up 48h` | `no_reply_after` 48h em `[lead parou de responder]` | `send_template` (placeholder) | 48h |
| A4 | `Parou de responder 72h → Nutrição` | `stage_idle` 72h em `[lead parou de responder]` | `move_stage` → `Nutrição de Leads Inativos` | 168h |

Observações:
- **A1 usa `no_reply_after`** (medido por última mensagem do lead) — exatamente o que você pediu ("não responde por 24h").
- **A4 usa `stage_idle`** (medido por tempo na coluna) — porque depois que o lead já está em "parou de responder", o sinal correto é "ficou 72h sem voltar a responder na coluna", independente de quem mandou o último follow-up. Se preferir `no_reply_after` 72h aqui também, troco — só dizer.
- Cooldowns evitam duplicar move/envio se o tick reprocessar.
- Os templates de A2/A3 ficam vazios (`template_id: null`) até você escolher na UI; nesse estado a automação fica `enabled=false` para não falhar.

### 4. Sequência da Nutrição (você configura na UI)
Não criada por esta entrega — só deixo documentado:
- Em `/sequences` → nova sequência com `trigger_type='stage_enter'` apontando para `Nutrição de Leads Inativos`.
- Passos com delays a seu gosto.
- Marcar **Parar se lead responder** (default já é assim via `trg_stop_sequences_on_reply`).

### 5. Docs
- `docs/support/pages/automations.md`: documentar seleção múltipla de estágios.
- `docs/maps/AUTOMATIONS_SEQUENCES.md`: adicionar receita "Cascata sem-resposta → Nutrição".
- `node scripts/docs-sync.mjs`.

## Interação com Onda 7 (Fase 2 — `kind`)

Quando a Fase 2 entrar, o trigger `nurture_recovery` (mensagem entrante em stage `kind='nurture'`) cuidará do retorno automático para Qualificação com tag `recuperado`. Esta automação A4 alimenta exatamente esse fluxo: ela enche a "Nutrição" e o trigger SQL faz o caminho de volta. Sem conflito.

## Validação
- Após criar A1, forçar um lead em Qualificação com `last_message_at` 25h atrás (último msg `from_me=false`) → tick → lead em "parou de responder" + `automation_runs` success.
- Verificar `automation_runs.detail` mostra a regra disparou para os 3 stages distintos.
- UI: abrir uma das automations, ver chips das 3 colunas selecionadas.

## Fora do escopo
- Conteúdo dos templates e da sequência (você faz na UI).
- Mudança no motor de sequences (já cobre `stage_enter`).
- Multi-select da ação `move_stage` (continua single — uma automação = um destino).

Quando aprovar, sigo direto para implementação + pergunto antes de inserir os 4 seeds.
