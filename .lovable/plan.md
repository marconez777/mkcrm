
# Refino do roadmap do pipeline (Parte II do AUDIT_EXTRACTOR_PIPELINE)

Apenas documentação. Sem mudanças de código/SQL nesta etapa.

## Decisões fechadas (D1–D5)

- **D1 — Coluna "Retorno Tratamento Finalizado": MANTER + gatilho automático.**
  Regra: `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}` com último atendimento finalizado há ≥ 30 dias **E** sem mensagem inbound/outbound há ≥ 60 dias → mover para "Retorno Tratamento Finalizado". Sai da coluna se: nova mensagem do lead, novo agendamento, ou drag manual.
- **D2 — Contatos B2B / administrativos: coluna fixa "Administrativo".**
  Não criar pipeline separado. Todos os leads classificados como `is_internal_contact=true` (Dr. Karina, Distrimed, Marco Guimarães, Elton/Hospital, parceiros, fornecedores) vão direto para a coluna **Administrativo** e ficam fixos lá — extractor não os move por mais nenhuma regra. Métricas operacionais excluem essa coluna por default.
- **D3 — `status_consulta`: transição automática por data.**
  Quando `data_consulta < now()` e status atual = `agendada` → extractor/cron move para `realizada` automaticamente. No-show é resolução humana (botão "marcar no-show" no `LeadDrawer.tsx`), que reverte para `no_show` e move o lead para coluna apropriada. Modelagem fica em `custom_fields.status_consulta` (enum `agendada | realizada | no_show | cancelada | reagendada`) — sem nova tabela.
- **D4 — Texto fora-de-horário (B31) confirmado:** "Olá, obrigado pelo contato! Aqui é a equipe de consultoras da Clínica Ór Psiquiatria. Por estarmos fora do nosso horário de atendimento, podemos demorar um pouco a te responder. Assim que possível, retornaremos a sua mensagem." Marcadas com `messages.is_auto_reply=true` e ignoradas na regra de qualificação.
- **D5 — Mapeamento profissional → modalidade: hardcoded só para Clínica Ór** (`clinic_id = cf038458…`). Futuro: arquivo `supabase/functions/extractor-tick/clinics/<clinic_id>/professionals.json`.

## Estrutura nova de `docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md` (Parte II — anexada após Fase 7)

### Seção A — Invariantes do pipeline (I1–I8)
Regras duras que extractor, automações e UI devem respeitar. Cada bug B# referencia qual invariante viola.

- **I1** Qualificação só após ≥1 outbound real (humano OU agente IA com LLM). Auto-reply não conta. (B31)
- **I2** "Procedimento pago" exige `custom_fields.pagamento_confirmado=true` E `tipo_atendimento ∈ {sessao_emt, sessao_cetamina}`. Consulta normal nunca entra aqui. (B15, B30)
- **I3** Toda data extraída deve ser ≥ `now()` no momento da escrita; passado = rejeitar e logar.
- **I4** Campos estruturais (`tipo_atendimento`, `pagamento_confirmado`, `status_consulta`) só são gravados com ≥2 sinais convergentes na conversa.
- **I5** Mensagens em chats administrativos / `is_internal_contact=true` nunca disparam regras de pipeline comercial — vão fixos para coluna **Administrativo**. (D2, B14, B19)
- **I6** `qualificacao='desqualificado'` exige `motivo_desqualificacao` preenchido (enum). (B32, B33)
- **I7** Toda mudança de stage automática grava `moved_by_agent_id` + razão em `lead_stage_history.metadata`.
- **I8** "Interessado em retorno" exige sinal explícito de reativação após período de inatividade — "vou pensar e volto" durante negociação ativa **não** qualifica. (B32)

### Seção B — Eixos de trabalho (E1–E6)
Cada bug ganha tag `eixo:` para agrupar PRs.

- **E1 — Extractor**: prompt, tool schema, desambiguação semântica (B1–B6, B12, B17, B25, B29, B30, B32, B33).
- **E2 — Field-rules + cron**: `pipeline_field_rules`, cron de transições automáticas (B8, B10, B16, B18, B27, D1, D3).
- **E3 — Schema/migrations**: novas colunas/enums (`is_auto_reply`, `is_internal_contact`, `tipo_atendimento`, `status_consulta`, `motivo_desqualificacao`, `pagamento_confirmado`).
- **E4 — Onboarding/outreach**: sequências de boas-vindas + auto-reply fora-de-horário (B31, D4, 188 leads sem outreach).
- **E5 — Coluna Administrativo / B2B**: classificador `is_internal_contact` + UI fixa (D2, B14, B19, B33).
- **E6 — Higiene de dados**: backfills, blocklist, marcação de spam (B26, B33, backfill B31).

### Seção C — Ondas de implementação (Onda 0 → Onda 6)
Ordem que respeita dependências (foundation antes de regras).

```text
Onda 0 — Foundation (E3)
  Migrations: is_auto_reply, is_internal_contact, tipo_atendimento,
  status_consulta, motivo_desqualificacao, pagamento_confirmado.
  Sem mudança de comportamento ainda.

Onda 1 — Quick wins críticos (E2 + E6)
  B15 (procedimento pago só com I2)
  B31 (auto-reply não qualifica) + backfill ~25 leads
  D2 — mover contatos B2B atuais para coluna Administrativo
  B26 — limpar 18 leads "Consulta Agendada" sem data

Onda 2 — Extractor (E1)
  Prompt + tool schema cobrindo B1–B6, B12, B17, B25, B29, B30, B32, B33
  Golden set v1 (~50 conversas) + eval-extractor.ts

Onda 3 — Field-rules + crons (E2)
  D1 — gatilho Retorno Tratamento Finalizado
  D3 — status_consulta agendada → realizada por data
  B8, B10, B16, B18, B27

Onda 4 — Pagamentos & comprovantes (E1+E2)
  B22, B28, B23 (NF/recibo/print → pagamento_confirmado)

Onda 5 — B2B / Administrativo (E5)
  Classificador is_internal_contact automático
  UI coluna Administrativo fixa
  B14, B19, B33 (spam → desqualificado, não para Administrativo)

Onda 6 — Polimento
  B7, B11, B13, B20, B21, B24
```

### Seção D — Eval contínuo
- Golden set em `supabase/functions/extractor-tick/eval/golden/*.json` (~50 conversas com expected output).
- Script `supabase/functions/extractor-tick/eval/run.ts` roda no CI; reporta `accuracy` por campo + por invariante.
- Regra: nenhum deploy do extractor pode reduzir score > 2pp vs baseline anterior.

### Seção E — Inventário consolidado (tabela única)
Substitui as listas espalhadas das Fases 1–7. Colunas:

`B# | Título curto | Eixo | Severidade | Onda | Invariante | Leads afetados | Status | Métrica de pronto`

Exemplo de linha:
`B31 | Qualificação por auto-reply | E1+E6 | ALTO | 1 | I1 | ~25 | aberto | 0 leads em Qualificação cuja única outbound é is_auto_reply`

### Seção F — Decisões registradas (D1–D5)
As cinco decisões acima ficam documentadas com data (2026-06-14) e quem decidiu (usuário).

## Arquivos a editar (apenas docs)

- `docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md` — anexar Parte II (seções A–F). Fases 1–7 permanecem como log histórico.
- `docs/DRIFT.md` — entrada da atualização.
- `docs/INDEX.json` + `public/docs-index.json` + `public/docs-content.json` — via `node scripts/docs-sync.mjs`.
- `mem://docs/maintenance-progress` — registrar onde paramos (D1–D5 fechadas, Parte II escrita).

## Fora de escopo desta etapa

- Migrations das novas colunas (Onda 0).
- Alterações no prompt do extractor / tool schema.
- Criação do golden set e do `eval/run.ts`.
- Implementação da coluna fixa "Administrativo" na UI.
- Implementação dos crons de transição (D1, D3).
