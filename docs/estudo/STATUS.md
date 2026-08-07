---
title: Estudo ÓR — Status da execução
topic: general
kind: doc
audience: agent
updated: 2026-06-16
summary: "Total processado: **14 colunas, 441 leads, 3.973 mensagens, 306 áudios**."
---
# Estudo ÓR — Status da execução

**Última atualização:** 2026-06-16 (rev. B+C aplicada)

## Escopo ajustado (confirmado pelo usuário)

- ❌ Excluída: coluna **Administrativo**
- ✂️ **Paciente antigo**: apenas os 30 primeiros leads (por `created_at` asc)
- ✂️ **Nutrição de Leads Inativos**: apenas os 300 primeiros
- ✅ Demais colunas: todos os leads

Total processado: **14 colunas, 441 leads, 3.973 mensagens, 306 áudios**.

## ✅ Concluído

1. **Bucket privado `estudo-cache`** criado na Lovable Cloud — todo o cache (áudios, sínteses) é persistido lá. Sandbox pode reciclar sem perder trabalho.
2. **Dump** em `/tmp/estudo-or/data/` (stages, leads, messages).
3. **Transcrição de áudio**: **306/306 transcritos** via Gemini multimodal e salvos em `estudo-cache/audio/<msg_id>.txt`.

## ✅ Concluído (correção 2026-08-07)

> Os passos 4-6 estavam listados como pendentes, mas **já haviam sido executados** — os 14
> arquivos de coluna e o `estudo-geral.md` existem e estão preenchidos. O STATUS ficou
> desatualizado.

4. ✅ Síntese por lead — JSON estruturado, cache em `lead/<id>.json`.
5. ✅ Síntese por coluna (14) — cache em `column/<stage_id>.json`.
6. ✅ `docs/estudo/*.md` + `docs/estudo-geral.md` renderizados.
7. ⚠️ `node scripts/docs-sync.mjs` — **o script não existe no repositório**, embora
   `package.json` ainda declare `docs:sync` e `docs:check` apontando para ele. Os dois
   comandos falham. O verificador em uso hoje é `npm run docs:verify`
   (`scripts/docs-verify.mjs`).

## 🗄️ Nota de escopo

Este estudo cobre o pipeline **"Agendamentos Novo" (14 colunas)**, extinto em 2026-06-17.
Ver o banner em [`README.md`](./README.md).

## Arquivos do pipeline

- `/tmp/estudo-or/cache_storage.py` — helper get/put/hydrate no bucket
- `/tmp/estudo-or/01_dump.py` — dump SQL → JSON (com escopo novo)
- `/tmp/estudo-or/02_transcribe.py` — transcrição idempotente, cache em Storage
- Faltam: `03_synthesize_leads.py`, `04_synthesize_columns.py`, `05_render.py`
