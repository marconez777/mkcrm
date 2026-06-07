---
title: Convenções — Migrações & PRs
topic: conventions
kind: reference
audience: agent
updated: 2026-06-07
---
# Convenções — Migrações & PRs

> **Quando ler:** ao criar migração SQL ou agrupar mudanças.
> **Última atualização:** 2026-06-03

---

## Migrações

- Sempre via tool `supabase--migration`. Nunca SQL manual.
- **Description obrigatória**: markdown curto, voltado a usuário não-técnico. Listar tabelas tocadas e regras de acesso em linguagem comum (sem `SELECT/INSERT/UPDATE/DELETE`).
- Migração deve ser **idempotente quando possível** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS ...`).
- Nome do arquivo: `{timestamp}_{uuid}.sql` — gerado automaticamente.
- **Nunca** incluir `ALTER DATABASE postgres ...` — proibido na plataforma.

### Checklist de toda migração

- [ ] `clinic_id` presente (se for tabela de negócio) com default
- [ ] RLS habilitada
- [ ] Policies de SELECT/INSERT/UPDATE/DELETE
- [ ] Trigger `set_updated_at` se houver `updated_at`
- [ ] Índices em FKs e colunas usadas em filtros frequentes
- [ ] `search_path` em qualquer função criada
- [ ] Realtime (se relevante): `ALTER PUBLICATION supabase_realtime ADD TABLE ...`

---

## Agrupamento de mudanças

- Uma migração = uma intenção. Não misturar "adicionar tabela X" com "ajustar policy de Y".
- Migração + código frontend que a consome podem ir no **mesmo turno**, mas em chamadas separadas (migration primeiro, depois edits).

---

## Documentação

- Toda mudança não-trivial atualiza o doc correspondente em `docs/`.
- Renovar `Última atualização: YYYY-MM-DD` no topo do arquivo modificado.
- Se a área não tem doc ainda, criar pelo menos um stub.

### Mapas (`docs/maps/*.md`) — regra de manutenção

- **Todo PR que adicionar, mover ou remover arquivo em uma feature mapeada DEVE atualizar o mapa correspondente no mesmo PR.** Mapa desatualizado = mapa que mente.
- Verificar antes de commitar: a feature tocada tem mapa em `docs/MAP.md`? Se sim, abrir `docs/maps/<FEATURE>.md` e ajustar §3 (frontend), §4 (edges), §5 (DB), e §9 (receitas) se aplicável.
- Mudou um arquivo `_shared/*` ou helper global → atualizar o **Índice reverso** em `docs/MAP.md`.
- Mudou um invariante (regra de RLS, anti-loop, dedupe, etc.) → atualizar §7 do mapa relevante + §"Invariantes globais" de `docs/MAP.md` se for cross-feature.
- Criou feature nova sem mapa → criar `docs/maps/<NOME>.md` seguindo o template fixo de 9 seções (ver mapas existentes).

### Documentação de suporte (`docs/support/`)

- **Todo PR que altera texto visível, label de botão, fluxo de tela, mensagem de erro, ou adiciona/remove uma rota DEVE atualizar o arquivo correspondente em `docs/support/`** no mesmo PR. Essa KB treina o agente de IA de suporte ao cliente — desatualizada, ela faz o agente mentir.
- Checklist:
  - Mexeu numa **rota/página** → atualizar `docs/support/pages/<rota>.md` (template em `docs/support/_templates/page.md`).
  - Mexeu num **fluxo transversal** (criar agente, conectar WhatsApp, importar leads, etc.) → atualizar `docs/support/journeys/<tema>.md` (template em `_templates/journey.md`).
  - Mudou **mensagem de erro** ou comportamento de recuperação → atualizar `docs/support/troubleshooting/<área>.md`.
  - Novo conceito de usuário → adicionar em `docs/support/00-conceitos.md`.
- Sempre em **PT-BR claro**, sem jargão técnico (`RLS`, `RPC`, `edge function`, nomes de tabela).

---

## Edge functions

- Deploy é automático ao salvar `index.ts`.
- Se a função precisa de secret novo: `secrets--add_secret` ANTES de mexer no código que usa.
- Se a função tem schedule (cron), documentar em `integrations/PG_NET_CRON.md`.
