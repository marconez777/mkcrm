# Estudo ÓR — Status da execução

**Última atualização:** 2026-06-16

## ✅ Já concluído

1. **Dump completo** dos dados em `/tmp/estudo-or/data/`:
   - 15 stages da pipeline "Agendamentos Novo"
   - 1.598 leads
   - 13.150 mensagens (461 leads com conversa)
   - 799 áudios identificados

2. **Transcrição de áudios** (Gemini multimodal via Lovable AI):
   - 578 áudios transcritos com sucesso, em cache `/tmp/estudo-or/cache/audio/<msg_id>.txt`
   - 221 áudios pendentes (falharam por rate limit 429 e foram limpos para retry)

## 🟡 Pendente — me peça para "continuar o estudo" e eu rodo

3. **Retry dos 221 áudios restantes** com concorrência reduzida (já está pronto: basta rodar `python /tmp/estudo-or/02_transcribe.py` novamente — é idempotente).
4. **Síntese por lead** (~371 leads com ≥3 mensagens) via Gemini com JSON estruturado.
5. **Síntese por coluna** (15 colunas).
6. **Renderização dos 16 markdown files** em `docs/estudo/` + hub `docs/estudo-geral.md`.
7. **`node scripts/docs-sync.mjs`** para atualizar o índice.

## Custo até agora

- ~578 chamadas Gemini Flash multimodal (transcrição).
- Estimativa para concluir: ~221 (retry) + ~371 (síntese lead) + 15 (síntese coluna) + 1 (hub) ≈ **+608 chamadas**.

## Arquivos do pipeline

- `/tmp/estudo-or/01_dump.py` — dump SQL → JSON
- `/tmp/estudo-or/02_transcribe.py` — transcrição idempotente
- `/tmp/estudo-or/data/` — leads.json, messages.json, stages.json
- `/tmp/estudo-or/cache/` — transcrições + futuras sínteses
- Faltam criar: `03_synthesize_leads.py`, `04_synthesize_columns.py`, `05_render.py`
