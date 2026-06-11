# Roadmap: Pipeline Clínica ÓR + Agentes IA (v5 — aprovado)

## Decisões fechadas

| # | Tema | Decisão |
|---|---|---|
| 1 | Chave OpenAI | **BYOK por clínica** — cada clínica configura a sua |
| 2 | Edição humana | IA **respeita** edição manual recente (`manual_lock_minutes`, default 30) |
| 3 | Áudio | **Whisper-1** (mais barato, ~$0.006/min) |
| 4 | Storage da chave | Máxima segurança — tabela `clinic_secrets` com **pgsodium** + RLS service_role-only |
| 5 | Sobrescrita | Permitida quando `confidence ≥ threshold` (default 0.7) e fora da janela de manual_lock |
| 6 | Comprovante/áudio ilegível | Cria **tarefa pra humano** |
| 7 | Limites | **Configuráveis na UI** por clínica |
| 8 | Regex schedule | **PT-BR somente** |
| 9 | Procedimentos atendidos | Infusão de Cetamina · EMT · Primeira Consulta · Consulta de seguimento · Retorno · Sessão de terapia |
| 10 | **EMDR (e demais procedimentos fora da lista)** | **Não atendidos** — se aparecer na conversa, o extrator marca o lead como `qualificacao = desqualificado` com `reason = "procedimento não oferecido: EMDR"`. Sem follow-up de IA, sem mover pra agendamento. |

## Entregável agora (apenas documentação)

Criar **`docs/roadmap/CLINIC_PIPELINE.md`** com frontmatter padrão (`topic: automations`, `kind: roadmap`, `audience: agent`, `code_refs` apontando para arquivos a criar).

### Estrutura

```
1. Visão geral
2. Decisões fechadas (tabela acima, incluindo EMDR/desqualificação)
3. Arquitetura
   3.1 Source of truth = custom fields
   3.2 4 camadas (keywords SQL → extrator → visão → áudio)
   3.3 Diagrama ASCII
4. Modelos & custos (OpenAI BYOK)
   - texto (gpt-5-nano / gpt-4o-mini)
   - visão (gpt-5-mini / gpt-4o)
   - áudio (whisper-1)
   - tabela estimada $/lead/dia
5. Database
   - messages: is_automated, vision_processed, transcript, transcript_status,
     transcript_cost_usd, needs_audio_transcription
   - leads: needs_ai_review, ai_review_reasons[], ai_review_queued_at, manual_lock_until
   - clinics: classifier_config jsonb
   - lead_stage_history: reason
   - clinic_secrets (pgsodium, service_role only)
   - lead_ai_extraction_runs (kind, model, tokens, cost, fields_set, confidence)
   - pipeline_field_rules (crawl)
6. Edge functions
   - trigger SQL trg_lead_needs_extraction
   - extractor-tick (cron 10m)
   - vision-tick (cron 10m)
   - audio-tick (cron 5m)
   - automations-tick + branch field_rules_crawl
7. Keywords PT-BR (separadas por procedimento)
   - PROCEDURE_REGEX (6 atendidos + 1 lista de bloqueio: EMDR e similares → desqualifica)
   - INTEREST_REGEX, PAYMENT_REGEX, SCHEDULE_REGEX
   - Glossário Whisper (EMT, cetamina)
8. Lógica de desqualificação
   - Se mensagem matchar PROC_NAO_ATENDIDO_REGEX (EMDR e variações) →
     extrator preenche qualificacao=desqualificado, reason, não aciona follow-up
   - Card pode ir pra coluna "Desqualificado" via field rule
9. UI — Settings → IA do Pipeline (6 abas)
   - Chave OpenAI (input + teste + status, nunca exibe a chave)
   - Extrator de texto
   - Visão
   - Áudio
   - Palavras-chave (read-only, inclui lista de bloqueio)
   - Histórico & custos
10. Regras de movimentação por campo (crawl)
    - pipeline_field_rules + UI em /automations
    - min_field_age_minutes (default 15)
11. Tratamento de erros & tarefas humanas
    - Comprovante ilegível → board Financeiro
    - Áudio falha 2× → board Atendimento
    - Chave OpenAI inválida → banner + agentes pausam
    - Procedimento não oferecido → tarefa opcional pra confirmar desqualificação
12. Observabilidade
    - /metrics: custo/dia, custo/lead, % preenchimento IA, taxa de sobrescrita,
      % desqualificados por procedimento não oferecido
    - Chips no card do Kanban: 🤖 / 👁️ / 🎧 / 🚫(desqualificado)
13. Fragilidades & mitigações (~15 cenários)
14. Fases
    F0 — Migrations + UI da chave OpenAI + roadmap doc
    F1 — Trigger keyword + 4 automações rule-based + lógica EMDR/desqualifica
    F2 — Extrator texto + UI completa + histórico/custos
    F3 — Visão (comprovante) + fallback humano
    F4 — Áudio Whisper + transcript no chat
    F5 — Crawl de regras de coluna
    F6 — Observabilidade + chips + docs-sync
15. Changelog do roadmap
```

### Segurança da chave OpenAI

- `clinic_secrets (clinic_id pk, openai_api_key_encrypted bytea, key_id uuid, updated_at)`
- Criptografia via **pgsodium** (`crypto_aead_det_encrypt`) com `key_id` por clínica
- RLS revoga `anon`/`authenticated`; só `service_role` via função `get_openai_key(clinic_id)` SECURITY DEFINER decriptografa em runtime
- UI mostra apenas status `configured/empty/invalid` + últimos 4 chars
- Health-check diário; se inválida, `classifier_config.openai_status='invalid'` + banner

### Próximo passo após este plano

1. Criar `docs/roadmap/CLINIC_PIPELINE.md` com o conteúdo acima.
2. Rodar `node scripts/docs-sync.mjs`.
3. Aguardar OK pra iniciar **F0** (migrations + UI da chave).

Nenhum código de feature nem migration é tocado nesta etapa — só o documento de roadmap.
