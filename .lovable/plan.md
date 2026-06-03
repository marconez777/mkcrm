## Objetivo

Criar uma camada de navegação em `docs/` que funcione como **GPS do código**: ao receber um pedido de edição, eu abro o mapa, encontro a feature, e tenho em uma só tela todos os arquivos (frontend + edge + DB) que preciso tocar — e os que **não** posso tocar sem quebrar invariantes.

Sem placeholders para features futuras: mapeamos o estado atual. Quando Stripe / planos pagos / limites forem construídos, atualizamos o mapa no mesmo PR.

---

## Estrutura proposta

```text
docs/
├── MAP.md                      ← índice mestre (novo)
└── maps/                       ← novo diretório
    ├── BUILDER_AGENTS.md       ← feature crítica
    ├── INBOX_WHATSAPP.md       ← feature crítica
    ├── EMAIL.md                ← feature crítica
    ├── KANBAN_LEADS.md
    ├── AI_RUNTIME.md           ← ai-chat, ai-auto-reply, tools, custos
    ├── TRACKING_FORMS.md
    ├── ADMIN_SUPER_ADMIN.md
    ├── AUTH_MULTI_TENANCY.md
    └── AUTOMATIONS_SEQUENCES.md
```

`docs/MAP.md` (mestre) terá:

- **Tabela de features → link para mapa detalhado + 1 linha de resumo**
- **Índice reverso por tipo de arquivo**: "se você está editando `_shared/ai.ts`, isto afeta: ai-chat, ai-auto-reply, ai-builder, ai-assist, ai-analyst-run"
- **Lista de invariantes globais** (RLS sempre, `has_role` para super_admin, cláusula de contexto do lead em prompts, etc.)
- **Convenção de leitura**: "antes de editar X, leia maps/Y.md primeiro"

---

## Formato de cada mapa de feature

Template fixo, sempre as mesmas seções, na mesma ordem (para eu escanear rápido):

```text
# Mapa: <Feature>

## 1. O que é (2-3 linhas)
## 2. Rotas / pontos de entrada do usuário
## 3. Frontend
   - Páginas:        src/pages/...        → função
   - Componentes:    src/components/...   → função
   - Hooks:          src/hooks/...        → função
   - Libs/helpers:   src/lib/...          → função
## 4. Edge functions
   - supabase/functions/<nome>/index.ts   → o que faz, quem chama
   - _shared/... usados                   → para que
## 5. Banco de dados
   - Tabelas:        nome → colunas-chave
   - RLS:            política → quem pode o quê
   - RPCs/funções:   nome → uso
   - Triggers:       nome → quando dispara
   - Migrations relevantes (datas)
## 6. Integrações externas
## 7. Invariantes / "não toque sem ler"
   - Regras que, se quebradas, derrubam a feature em produção.
## 8. Pegadinhas comuns
## 9. Como adicionar X (receitas)
   - "Para adicionar uma tool nova ao Builder, edite: 1)... 2)... 3)..."
```

A seção **9 (receitas)** é o ganho real: quando você pedir "adicione uma tool nova ao agente", eu abro o mapa e sigo a receita em vez de redescobrir o caminho.

---

## Cobertura por mapa (resumido)

| Mapa | Cobre | Por que é crítico |
|---|---|---|
| `BUILDER_AGENTS.md` | Wizard `/ai/agents/new`, edge `ai-builder` (9 actions), `builder_manual_versions`, Test Lab, KB Assistant, Insights, PromptHistory | Vai crescer muito; tem invariante forte (cláusula de contexto + multi-nicho) |
| `AI_RUNTIME.md` | `ai-chat`, `ai-auto-reply`, `ai-assist`, tools (`KNOWN_AGENT_TOOLS`), `_shared/ai.ts`, `spend-guard.ts`, `ai-pricing.ts` (+ espelho frontend), tabelas `ai_usage*`, `ai_chat_traces`, `ai_spend_limits` | Núcleo do produto; tocar em uma tool exige sincronizar 3 arquivos |
| `INBOX_WHATSAPP.md` | `/inbox`, `evolution-send`, `evolution-webhook`, `messages`, `leads.ai_paused`, mídia, agendamento | Muitos pontos de pausa/handoff |
| `EMAIL.md` | `/email/*`, editor de blocos, campanhas, automações, fila, domínios, Resend, `email_*` tabelas | Subsistema grande e isolado |
| `KANBAN_LEADS.md` | `/kanban`, pipelines, stages, `stage_ai_defaults`, custom fields, lead drawer | Acoplado a IA via stage defaults |
| `TRACKING_FORMS.md` | `/tracking`, `forms-ingest`, snippets, atribuição, `docs/integracao/*` | Muitas integrações externas |
| `ADMIN_SUPER_ADMIN.md` | `/admin`, `has_role`, RLS de super_admin, limites por clínica, builder manual panel | Já existe `SUPER_ADMIN.md` — vira mapa formal |
| `AUTH_MULTI_TENANCY.md` | `useAuth`, RLS por `clinic_id`, `profiles`, `user_roles`, convites | Invariante de segurança |
| `AUTOMATIONS_SEQUENCES.md` | `/sequences`, `/automations`, `message_sequence_runs`, lembretes de agendamento | Triggers críticos |

---

## Manutenção

- **Regra:** todo PR que adicionar/mover arquivo numa feature mapeada **deve** atualizar o mapa correspondente no mesmo PR. Adiciono essa regra em `docs/conventions/COMMIT_PR.md` e referencio em `docs/MAP.md` no topo.
- **Última atualização** no cabeçalho de cada mapa.
- **Validação leve:** script opcional (não nesta entrega) que grep nos paths citados nos mapas para detectar arquivos renomeados/deletados.

---

## Detalhes técnicos

- Sem código novo, só `.md` em `docs/MAP.md` + `docs/maps/*.md`.
- Reaproveito conteúdo já existente em `docs/features/*`, `docs/flows/*`, `docs/architecture/SUPER_ADMIN.md`, `docs/edge-functions/INDEX.md` — os mapas são uma **visão consolidada orientada a edição**, não substituem as docs longas (eles linkam para elas).
- Cabeçalho de cada mapa indica explicitamente: "este arquivo é para localizar o que editar — para entender *por que*, leia `docs/features/<X>.md`".
- Atualizo `docs/CHANGELOG.md` e `docs/README.md` apontando para `MAP.md` como porta de entrada para edições.

---

## Entrega em duas fases

**Fase 1 (este turno após aprovação):** `MAP.md` mestre + 3 mapas das features mais críticas e que mais vamos editar:
1. `maps/BUILDER_AGENTS.md`
2. `maps/AI_RUNTIME.md`
3. `maps/INBOX_WHATSAPP.md`

**Fase 2 (turno seguinte, se aprovar a Fase 1):** os 6 mapas restantes + atualização de `COMMIT_PR.md` com a regra de manutenção.

Dividir assim evita um PR gigante difícil de revisar e me permite calibrar o formato com você antes de replicar para 9 mapas.