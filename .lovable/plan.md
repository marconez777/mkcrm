## Backup completo dos leads — Clínica ÓR

Gerar um arquivo de backup com **todos os leads** do pipeline da Clínica ÓR, contendo tudo que é necessário para reimportar caso sejam perdidos.

### O que vai no backup

Para cada lead (tabela `leads`, filtrado por `clinic_id` da Clínica ÓR):

- **Identificação**: `id`, `phone`, `name`, `email`, `company`
- **Posição no pipeline**: `pipeline_id` + nome do pipeline, `stage_id` + **nome do stage** (resolvido via `pipeline_stages`), `position`, `stage_changed_at`
- **Tags**: array `tags` completo
- **Custom fields**: JSON completo de `custom_fields` (com os 23 campos da Clínica ÓR — `interesse`, `procedimentos`, `data_horario`, `status_financeiro`, `status_consulta`, `procedimento_agendado_em`, etc.)
- **Atendente**: `attendant_id` + nome
- **Instância WhatsApp**: `whatsapp_instance_id`
- **Resumo IA**: `ai_summary`, `ai_summary_at`
- **Flags**: `archived_at`, `is_internal_contact`, `manual_lock_until`, `pinned_at`, `marked_unread`, `unread_count`
- **Timestamps**: `created_at`, `updated_at`, `last_message_at`, `last_human_activity_at`, `last_classified_at`
- **Negócio**: `deal_value`, `notes`, `avatar_url`

### Tabelas relacionadas incluídas (opcional, mas recomendado)

Para um backup realmente restaurável:

1. **`lead_tags_normalized`** já vem dentro de `leads.tags` → ok
2. **`lead_stage_history`** — últimos N movimentos por lead (para preservar o histórico)
3. **`lead_tasks`** — tarefas em aberto vinculadas
4. **`lead_internal_notes`** — notas internas
5. **Definições de referência** (snapshot para mapear stage_id/pipeline_id no futuro):
   - `pipelines` da clínica
   - `pipeline_stages` da clínica
   - `lead_custom_fields` (defs dos 23 campos)
   - `attendants` da clínica

### Formato do arquivo

**Um arquivo ZIP** em `/mnt/documents/` contendo:

```
clinica-or-leads-backup-2026-06-18.zip
├── README.md                    # como reimportar + estatísticas (total de leads, por stage)
├── leads.csv                    # uma linha por lead, colunas planas + custom_fields como JSON
├── leads.json                   # mesma coisa em JSON (preserva tipos e arrays/objetos)
├── lead_stage_history.csv       # histórico completo de movimentações
├── lead_tasks.csv               # tarefas
├── lead_internal_notes.csv      # notas internas
└── reference/
    ├── pipelines.json
    ├── pipeline_stages.json
    ├── lead_custom_fields.json
    └── attendants.json
```

Por que CSV **e** JSON: CSV é fácil de abrir no Excel para conferência; JSON preserva fielmente `tags[]` e `custom_fields{}` para reimportação programática.

### Como será feito (somente leitura)

1. Descobrir `clinic_id` da Clínica ÓR via `pipelines.name ILIKE '%clínica ór%'` ou pelo já conhecido `cf038458-457d-4c1a-9ac4-c88c3c8353a1`.
2. `psql` com paginação (`COPY ... TO STDOUT WITH CSV HEADER`) para extrair as 8 tabelas acima filtradas por `clinic_id`.
3. Script Python que junta tudo, resolve nomes (stage/pipeline/attendant), gera CSV+JSON, e empacota o ZIP em `/mnt/documents/`.
4. Entregar via `<presentation-artifact>` para download imediato.
5. **Zero alterações no banco ou no código** — só leitura.

### Confirmações antes de executar

1. **Escopo do "perder"**: quer incluir leads `archived_at IS NOT NULL` no backup? (recomendo **sim** — backup completo).
2. **Mensagens (`messages`)**: quer incluir o histórico de conversa WhatsApp de cada lead? Isso pode aumentar muito o arquivo (potencialmente centenas de MB). Padrão sugerido: **não incluir**, só os metadados do lead.
3. Confirma o formato ZIP com CSV+JSON acima, ou prefere algo diferente (ex.: só um `.sql` com `INSERT`s prontos)?
