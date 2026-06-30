
## Escopo

1. **UI para ligar IA por etapa** (você aciona manualmente em cada estágio que quiser).
2. **`docs/agents/FEBRACIS_ROADMAP.md`** com Fase 2 e Fase 3.

Sem migration de binding — os 286 contatos ficam como estão.

---

## 1. UI — aba "IA" no diálogo "Editar etapa"

**Arquivo único:** `src/components/kanban/EditStageDialog.tsx` (86 → ~180 linhas).

Converte o diálogo em `Tabs`:

```
[ Geral ] [ IA ]

Geral: Nome, Cor   (igual ao atual)

IA:
  Agente de auto-resposta
  [ Select: Nenhum (desligado) | Atendimento Febracis | … ▼ ]

  ☑ Responder automaticamente
  Quando um lead enviar mensagem neste estágio,
  o agente acima responde sozinho em ~4s.
```

**Comportamento:**
- Ao abrir, lê `stage_ai_defaults` para `stage.id` → preenche Select + Switch.
- Select popula com `ai_agents` da clínica atual onde `enabled=true`, ordem por `name`. Primeira opção fixa: **"Nenhum (desligado)"**.
- Switch só fica habilitado se um agente estiver selecionado.
- Botão **Salvar**:
  - persiste nome/cor em `pipeline_stages` (igual hoje).
  - se "Nenhum" → `delete from stage_ai_defaults where stage_id = …`.
  - senão → `upsert` em `stage_ai_defaults` (`stage_id`, `agent_id`, `auto_reply`).
- Toast "Etapa atualizada".

**Indicador visual na coluna** (em `src/pages/Kanban.tsx`): chip pequeno `✨ IA · Nome do agente` no header das colunas que tiverem `stage_ai_defaults.auto_reply=true`. Carrega em um único query batch por `pipeline_id` ao montar o board, para você ver de relance onde está ligado.

Sem mudança de RLS — policy `stage_ai_defaults clinic scoped` já filtra por clínica.

---

## 2. `docs/agents/FEBRACIS_ROADMAP.md`

Arquivo novo, ~120 linhas:

- **Status Fase 1** — debounce 4s, 4 personas, 4 stages internos, 6 KB docs populados, prompt 11k chars. Pendência: re-save manual dos 6 docs na UI para disparar reembedding.
- **Como ligar o agente em produção** — passo a passo da nova UI deste plano: abrir etapa → aba IA → escolher agente → ligar switch → salvar. Repetir nas etapas onde quiser auto-resposta.
- **Fase 2 — Guardrails determinísticos** (código novo, não implementado ainda)
  - `supabase/functions/_shared/agent-response-validator.ts`: whitelist URLs Stripe (`9B69AT4ha6iQ0dg78H7Vm1`, `cNi8wP4haaz69NQ3Wv7Vm18`), whitelist preços (`US$ 497/197/697/297`), bloqueio de R$/PIX, parcelamento inventado, URL Stripe fora da whitelist.
  - Hook no `ai-auto-reply` antes do envio + em `pipeline-classify` validando que o `stage_id` sugerido pertence ao pipeline do lead.
  - Violação → bloqueia envio, `agent_traces.reason=guardrail_violation`, reenfileira com instrução corretiva.
  - Aceite: rodar as 4 personas + 1 maliciosa pedindo "link de pix" → validator bloqueia.
- **Fase 3 — Loop de melhoria contínua** (sem código novo, usa `agent_evals` / `agent_personas` / `agent_prompt_versions`)
  - Cron semanal rodando as 4 personas → grava score (cobertura playbook, latência, % com link, % violações).
  - Painel `/admin/agents/:id/evals` com chart semanal + drill-down em transcripts ruins.
  - A/B de prompt em 10% dos leads novos por 7 dias; KPI = clique no link Stripe.
  - Alerta quando score cair >15% semana/semana.
  - Aceite: 4 semanas de evals automáticos + 1 ciclo A/B documentado.

---

## Ordem de execução

1. Editar `EditStageDialog.tsx` (Tabs + Select + Switch + load/save).
2. Adicionar chip `✨ IA · Nome` no header da coluna em `Kanban.tsx`.
3. Criar `docs/agents/FEBRACIS_ROADMAP.md`.

Aprova?
