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

---

## Edge functions

- Deploy é automático ao salvar `index.ts`.
- Se a função precisa de secret novo: `secrets--add_secret` ANTES de mexer no código que usa.
- Se a função tem schedule (cron), documentar em `integrations/PG_NET_CRON.md`.
