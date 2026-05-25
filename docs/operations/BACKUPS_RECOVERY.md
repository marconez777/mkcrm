# Operações: Backups e Recovery

> **Quando ler:** antes de fazer migration destrutiva, restore após incidente, ou planejar disaster recovery.
> **Última atualização:** 2026-05-25

---

## O que está coberto

| Dado | Backup | RPO | RTO |
|---|---|---|---|
| Postgres (todas tabelas) | Supabase managed daily + PITR | 24h (sem PITR) / ~5min (com PITR habilitado) | ~1h restore completo |
| Storage (`wa-media`, `email-assets`) | Supabase managed | 24h | depende do volume |
| Edge functions code | Git (este repo) | sem perda | minutos (re-deploy) |
| Secrets (Lovable Cloud) | Lovable platform | sem perda | imediato |
| Evolution instances (sessões WhatsApp) | **NÃO** backupado | — | re-parear todas |

**Crítico**: sessão WhatsApp do Evolution vive no servidor Evolution. Se o servidor cair sem backup do volume, todas as clínicas re-pareiam (UX ruim mas recuperável).

---

## Estratégia Supabase

- **Daily backup** automático (retenção 7 dias no plano padrão, 30 no Pro).
- **PITR (Point-in-Time Recovery)**: requer add-on pago. Recomendado para produção real.
- **Logical exports**: para migração ou snapshot manual:
  ```bash
  pg_dump --no-owner --no-acl postgresql://... > snapshot.sql
  ```

---

## Restore — passo a passo

### Restore completo (catástrofe)

1. Painel Lovable Cloud → Backups → escolher data → "Restore".
2. Aguardar `cloud_status` voltar a `ACTIVE_HEALTHY`.
3. Re-deploy de todas edge functions (geralmente automático, mas confere).
4. Verificar secrets ainda presentes (`fetch_secrets`).
5. Re-parear instâncias Evolution se servidor caiu junto.
6. Notificar usuários.

### Restore parcial (uma tabela perdida)

- Abrir `psql` no backup como banco temporário (snapshot via Lovable).
- `INSERT INTO public.<tabela> SELECT * FROM backup.<tabela> WHERE ...`.
- Conferir FK e RLS antes.

### Restore de storage

- Storage tem versionamento por bucket (se habilitado). Senão, só backup snapshot.

---

## Antes de uma migration destrutiva

Checklist obrigatório:

1. [ ] Backup ad-hoc via painel ("Create on-demand backup").
2. [ ] Dry-run da migration em ambiente isolado.
3. [ ] Migration reversível: incluir `DOWN` (mesmo que documentação, sem rodar).
4. [ ] Rodar fora do horário de pico.
5. [ ] Monitorar `cloud_status` + `db_health` durante.

Operações que **exigem** o checklist:
- `DROP TABLE` / `DROP COLUMN`
- `ALTER COLUMN TYPE` em coluna grande
- `DELETE` em massa (>10k linhas)
- Mudança de RLS que pode esconder dados

---

## Cenários de incidente (runbooks resumidos)

### Banco com 100% disco
- `supabase--db_health` mostra `data_disk_pct > 95`.
- Curto prazo: `VACUUM FULL` em tabelas grandes (`tracking_events`, `wa_messages`).
- Médio: aumentar tamanho do disco (Settings → Compute).
- Longo: arquivamento de eventos antigos (job mensal).

### Evolution server caiu
- `evolution-health` falha em todas clínicas.
- Subir Evolution novamente.
- Se volume preservado → instâncias voltam automaticamente.
- Se volume perdido → `evolution-provision` para cada clínica + re-parear (manda email).

### Lovable AI gateway fora
- `ai-auto-reply` retorna `upstream_error`.
- Fallback hoje: mensagem padrão "um humano te responde em breve".
- TODO: fallback para outro modelo via outro caminho.

### Resend bloqueou conta
- `send-email` retorna 401/403 persistente.
- Pausa de campanhas (manual).
- Trocar para provedor backup (SES) — sem implementação automática hoje.

---

## Pegadinhas

- **PITR não cobre Storage** (só o DB).
- **Restore não traz Realtime publication** automaticamente: rodar `ALTER PUBLICATION supabase_realtime ADD TABLE ...` pós-restore.
- **Secrets não vão no `pg_dump`** — guardados separados, sem risco mas também sem snapshot consistente.
- **Foreign keys em `auth.users`**: cuidado — restore parcial pode quebrar referências se UIDs mudarem.
- **Backup local de dev**: nunca incluir produção PII em dump compartilhado.

---

## Melhorias sugeridas

- Habilitar PITR no plano Pro.
- Job mensal de export para storage frio (S3-compatible).
- Runbook automatizado por incidente (script CLI).
- Backup do volume Evolution (responsabilidade do operador do servidor).

---

## Arquivos-chave

- `database/MIGRATIONS.md`
- `operations/OBSERVABILITY.md`
- `integrations/EVOLUTION_API.md`
