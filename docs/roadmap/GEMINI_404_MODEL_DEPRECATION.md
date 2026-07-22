# Roadmap — Gemini 404 "no longer available to new users"

Status: 🔴 aberto — 22/07/2026
Owner: plataforma
Escopo: `supabase/functions/_shared/ai.ts` (`googleChat`) e agentes que rodam em Gemini via BYOK.

---

## 1. Contexto do erro

Erro observado em produção (agente SDR 3.0 MK / Febracis):

```
ai-chat 502: google error 404 —
{
  "error": {
    "code": 404,
    "message": "This model models/gemini-2.5-flash is no longer available to new users.
                Please update your code to use a newer model for the latest features and improvements.",
    "status": "NOT_FOUND"
  }
}
```

Observado apenas em chaves/projetos GCP que **nunca tinham chamado `gemini-2.5-flash` antes**. Contas antigas continuam funcionando — por isso o erro é intermitente entre tenants.

## 2. Achados da pesquisa (Google AI Dev Forum, 09/jul/2026)

- `discuss.ai.google.dev/t/gemini-2-5-flash-suddenly-return-404/174225` — vários devs reportaram 404 simultâneo em `gemini-2.5-*` no dia 09/07.
- `discuss.ai.google.dev/t/gemini-2-5-flash-deprecated-without-warning-earlier-than-shutdown-date/174217` — Google confirmou que a data oficial de shutdown é 16/out/2026, mas o modelo já foi **removido para novos consumidores** antes do prazo.
- Logan Kilpatrick (Google) postou "should be rolled back already, config issue" — mas o rollback só cobre projetos que **já haviam usado** o modelo. Chaves novas continuam com 404.
- Mesmo padrão para variantes preview (`gemini-2.5-flash-preview-09-2025` etc.).
- Página oficial: `ai.google.dev/gemini-api/docs/deprecations` — recomenda migrar para `gemini-flash-latest` ou `gemini-3-flash-preview` (ou `gemini-3.1-flash-lite` como low-cost).

**Causa raiz do nosso caso:** em `_shared/ai.ts:292` estamos forçando `gemini-flash-latest` → `gemini-2.5-flash`. Esse remapeamento (feito ontem para contornar o 404 do `flash-latest` numa chave específica) agora quebra **todas** as chaves novas, porque Google fechou o acesso a 2.5-flash para consumidores novos.

---

## Fase 1 — Estancar (P0, minutos)

**Objetivo:** parar de mapear cegamente `flash-latest` → `2.5-flash`.

- [ ] F1.1 Remover o remapeamento hard-coded em `_shared/ai.ts:292`. Enviar o modelo do agente como está (`gemini-flash-latest`, `gemini-2.5-flash`, `gemini-3-flash-preview` etc.) e deixar o Google decidir.
- [ ] F1.2 Se `gemini-flash-latest` for chamado e retornar 404, cair em fallback ordenado: `gemini-flash-latest` → `gemini-3-flash-preview` → `gemini-2.5-flash`. Retornar erro apenas se todos falharem.
- [ ] F1.3 Deploy `ai-chat` e validar em Febracis + MK.

Critério de aceite: uma request bem-sucedida no agente SDR 3.0 MK usando a chave nova, sem 404.

## Fase 2 — Robustez do fallback (P1, hora)

**Objetivo:** o dispatcher precisa aprender qual modelo funciona por chave, não tentar 3 chamadas por request.

- [ ] F2.1 Cache in-memory por `agent.id` (TTL 10 min) do modelo efetivo resolvido no último sucesso.
- [ ] F2.2 Ao receber 404 "no longer available", marcar o modelo como bloqueado para aquela `google_api_key` (hash SHA-256 truncado como cache key) e pular direto para o próximo.
- [ ] F2.3 Logar `resolved_model` no `agent_run_logs` para termos telemetria de qual modelo cada tenant está usando de fato.

## Fase 3 — UI e catálogo (P1, hora)

**Objetivo:** parar de oferecer modelos que o Google já matou.

- [ ] F3.1 Em `src/pages/Agents.tsx`, atualizar a lista de modelos Gemini:
  - Manter: `gemini-flash-latest`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-2.5-pro` (quando disponível na conta).
  - Remover das opções default: `gemini-2.5-flash` (marcar como "legacy — só funciona em contas antigas").
- [ ] F3.2 Adicionar tooltip explicando: "Se sua chave é nova, use `gemini-flash-latest`. Contas antigas do GCP ainda conseguem usar 2.5-flash até 16/10/2026."
- [ ] F3.3 Botão "Testar modelo" no formulário do agente — dispara uma chamada mínima e mostra qual modelo o Google aceitou.

## Fase 4 — Migração dos tenants em produção (P2)

**Objetivo:** varredura silenciosa.

- [ ] F4.1 Query `SELECT id, name, clinic_id, model FROM agents WHERE model LIKE '%gemini-2.5%'`.
- [ ] F4.2 Para cada tenant, testar a chave dele contra `gemini-2.5-flash`. Se retornar 404, migrar para `gemini-flash-latest` via UPDATE + registro no changelog do tenant.
- [ ] F4.3 Comunicar no console/log de cada agente afetado.

## Fase 5 — Documentação (P2)

- [ ] F5.1 Adicionar seção em `docs/ai/GEMINI_API_QUIRKS.md`:
  > **Regra de ouro:** nunca hard-code a resolução de aliases (`gemini-flash-latest`, `gemini-pro-latest`). Deixe o Google resolver. Se um alias falhar com 404, faça fallback para o modelo estável **mais novo** disponível, não o mais antigo.
- [ ] F5.2 Atualizar playbook de onboarding de nova chave Gemini: instruir a testar com `gemini-flash-latest` primeiro.

---

## Modelos suportados hoje (fonte: `ai.google.dev/gemini-api/docs/models`, 22/jul/2026)

| Modelo | Status | Nota |
|---|---|---|
| `gemini-flash-latest` | ✅ ativo | Alias — resolve para o Flash mais recente da conta. |
| `gemini-3-flash-preview` | ✅ preview | Substituto direto de 2.5-flash para contas novas. |
| `gemini-3.1-flash-lite` | ✅ ativo | Custo-eficiente. |
| `gemini-2.5-flash` | ⚠️ deprecated | Shutdown 16/10/2026. **404 para contas novas desde 09/07/2026.** |
| `gemini-2.5-pro` | ⚠️ deprecated | Mesmo comportamento. |
| `gemini-2.5-flash-preview-*` | ❌ removido | 404 em qualquer conta. |

## Referências

- https://discuss.ai.google.dev/t/gemini-2-5-flash-suddenly-return-404/174225
- https://discuss.ai.google.dev/t/gemini-2-5-flash-deprecated-without-warning-earlier-than-shutdown-date/174217
- https://ai.google.dev/gemini-api/docs/deprecations
