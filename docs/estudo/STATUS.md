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

## 🟡 Pendente — me peça "continuar o estudo"

4. Síntese por lead (~ leads com ≥3 mensagens) — JSON estruturado, cache em `lead/<id>.json`.
5. Síntese por coluna (14) — cache em `column/<stage_id>.json`.
6. Renderizar `docs/estudo/*.md` + `docs/estudo-geral.md`.
7. Rodar `node scripts/docs-sync.mjs`.

## Arquivos do pipeline

- `/tmp/estudo-or/cache_storage.py` — helper get/put/hydrate no bucket
- `/tmp/estudo-or/01_dump.py` — dump SQL → JSON (com escopo novo)
- `/tmp/estudo-or/02_transcribe.py` — transcrição idempotente, cache em Storage
- Faltam: `03_synthesize_leads.py`, `04_synthesize_columns.py`, `05_render.py`
