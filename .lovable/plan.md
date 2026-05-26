# Correção do domínio da Clínica Or + revisão da Fase 0

## Contexto

A documentação 11/12/13 assumiu o domínio `clinicaor.com.br`, que **não existe**. O site real roda em `https://mindscape-revive.lovable.app`. Ao re-consultar o banco com o domínio correto, descobrimos um problema mais grave que o esperado:

- Integração **"Site Or"** (`cf9ec890-83fe-4751-9bc5-aacc69f7e9bd`)
- `total_submissions = 0` — nunca recebeu nada
- `allowed_domains = ["https://clinicaohrpsiquiatria.com/"]` — domínio errado **e** em formato inválido (deve ser hostname puro, sem `https://` nem `/`)
- Nenhum `form_submission` nem `lead` no banco com referência a `mindscape-revive`

**Conclusão**: o snippet do site provavelmente nem está instalado, ou está instalado mas todas as tentativas são rejeitadas pelo check de origem do `forms-ingest`. Os 172 leads do baseline anterior vêm de outras integrações (WhatsApp, manual, etc.), não do site da Or.

## Objetivo

1. Reconfigurar `allowed_domains` corretamente.
2. Re-rodar o baseline filtrando pelo domínio real.
3. Atualizar docs 11, 12 e 13 substituindo todas as menções a `clinicaor.com.br`.
4. Definir critério claro de "site está enviando" para validar a próxima etapa.

## Mudanças

### 1. Reconfigurar a integração Or (manual, via UI)

Em `/settings/forms` → "Site Or" → Configurações:

- **Allowed domains**: `mindscape-revive.lovable.app` (apenas hostname, sem `https://`, sem `/`, sem espaço)
- Remover o valor antigo `https://clinicaohrpsiquiatria.com/`

> Por que manual: editar `form_integrations` direto no banco pula auditoria; a UI já existe e faz a validação correta.

### 2. Re-rodar queries da Fase 0 com filtro correto

Queries read-only (`supabase--read_query`), todas filtrando por `integration_id = 'cf9ec890-83fe-4751-9bc5-aacc69f7e9bd'` ou `payload ILIKE '%mindscape-revive%'`:

1. `form_submissions` da integração Or (count, status breakdown, últimas 20) — esperado **0** até instalar snippet
2. `leads` cujo `custom_fields->>'landing_page'` ou `form_source` contém `mindscape-revive` — esperado **0**
3. `lead_events` com `event_data->>'url'` contendo `mindscape-revive` — esperado **0** (confirma falta de tracking)
4. `tracking_identity_links` para a clínica Or, filtrando por URL — esperado **0**
5. Reconfirmar a query de telefone (1.479 leads digits-only não muda — é clinic-wide)

### 3. Atualizar documentação

- **`docs/integracao/13-baseline-fase0.md`**: substituir todas as ocorrências de `clinicaor.com.br` por `mindscape-revive.lovable.app`; reescrever a seção "Allowed domains" com o achado real (`["https://clinicaohrpsiquiatria.com/"]` → formato inválido); adicionar uma seção nova **"Estado real do site Or"** explicando que 0 submissions chegaram; mover o tópico do `enqueue_email` para "Não relacionado ao site Or" (afeta outros leads).
- **`docs/integracao/12-roadmap-correcao.md`**: atualizar a Ação 0.1 (configurar domínios) com o valor correto; manter Fase 1 como planejada.
- **`docs/integracao/11-analise-conflitos-site-or.md`**: corrigir menções ao domínio.
- **`docs/integracao/README.md`**: nota curta sobre a correção.

### 4. Critério de validação para destravar Fase 1

Antes de implementar `track-event`, listener WhatsApp e migration de telefone, **precisamos provar que o pipeline básico funciona**:

- [ ] Snippet `<script async src=".../forms-snippet?token=mkf_3a2f5dd0…"></script>` instalado no `index.html` do projeto mindscape-revive
- [ ] Allowed domain ajustado para `mindscape-revive.lovable.app`
- [ ] 1 submissão de teste real no site → aparece em `form_submissions` com `status='ok'` e `lead_id` preenchido

Sem esses 3 itens, Fase 1 não tem como ser validada end-to-end.

## Fora de escopo (continua adiado)

- Endpoint `track-event` (Fase 1.1)
- Listener `wa.me` no snippet (Fase 1.2)
- Migration de telefone para `+E.164` (Fase 1.3)
- Tudo de Fase 2/3/4

## Entregáveis

- Doc 13 atualizado com baseline real do site Or (essencialmente "zero atividade")
- Docs 11 e 12 com domínio corrigido
- Checklist de validação para o desenvolvedor do site (3 itens acima)
- README com nota da correção

## Detalhes técnicos

- Token da integração Or: `mkf_3a2f5dd0…` (preservar)
- Validação de origem do `forms-ingest`: compara `request.headers.get('origin')` com `allowed_domains` via hostname match — por isso o valor com `https://` e `/` falha silenciosamente
- Nenhuma migration de banco nessa etapa; só leitura + edição de markdown
