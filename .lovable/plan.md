## Objetivo

Criar `docs/integracao/11-analise-conflitos-site-or.md` cruzando a documentação que o Lovable do site da Clínica ÓR enviou (`integracao-crm.md`) com o que o snippet/edge functions do CRM realmente fazem hoje (`forms-snippet`, `forms-ingest`, `tracking-pixel`). Em seguida, criar `docs/integracao/12-roadmap-correcao.md` com plano priorizado.

Nenhum código de produção será alterado nesta etapa — só documentação.

## Conflitos já identificados (preview do conteúdo)

### Bloqueadores (P0)

1. **Tracking-pixel NÃO está instalado no site.** O site só tem `forms-snippet`. Consequência em cadeia:
   - `_mk_vid` e `_mk_sid` nunca são criados → snippet envia `visitor_id: null` / `session_id: null` em todo submit → `tracking_identity_links` nunca é populado por essa via → atribuição visitante↔lead **não existe**.
   - Nenhum page-view, UTM, referrer, gclid/fbclid é gravado. Toda a seção "atribuição" da nossa doc é inerte para esse cliente.
   - O dashboard do CRM mostra leads "sem origem" para 100% do tráfego desse site.

2. **Etapa 2 do quiz (`submit-test-result`) não passa por `<form>`.** O snippet só escuta evento `submit`. Resultado: o CRM **nunca recebe** score/result_label/conclusão do teste. Hoje só sabe que o lead começou um teste (Etapa 1).

3. **WhatsApp clicks não são capturados.** O snippet não escuta `click`. Toda conversão por CTA WhatsApp some.

### Altos (P1)

4. **Campos sem `name=` em TestLeadForm e WebinarLP** — funciona por coincidência (fallback para `id`), mas:
   - WebinarLP usa IDs prefixados (`webinar-name`, `webinar-email`) e o matching do `forms-ingest` por substring (`includes(a)`) cobre isso, porém é frágil. Qualquer renomeação quebra silenciosamente.
   - O alias "tel" em `phone` colide com qualquer campo que contenha "tel" no id (`treatmentInterest` não contém "tel", então passa, mas é um campo minado).

5. **`allowed_domains` do token `mkf_3a2f5dd0…`** — precisa validar no CRM se inclui `clinicaohrpsiquiatria.com`, `clinicaor.com.br` e `mindscape-revive.lovable.app`. Se ficou vazio, OK (permite tudo); se foi preenchido sem o domínio Lovable de preview, submissões de preview retornam 403.

6. **Formato de telefone divergente.** Site grava `+5511...` (com `+`). `forms-ingest` normaliza para `5511...` (sem `+`). Se houver lookup cruzado entre tabelas dos dois lados via telefone, **não bate**.

7. **Dedup no CRM por `(clinic_id, phone)` ou `email`**, mas o lead vem só do snippet — sem `lead_id` canônico do site. Lead criado pelo site e capturado pelo snippet vivem como entidades separadas (UUID no site ≠ UUID no CRM).

### Médios (P2)

8. **Snippet trafega email/phone em claro** no body; site só armazena hash. Diferença de política — não bloqueia, mas inconsistente com a política LGPD descrita pelo site.

9. **SPA navigation:** snippet não escuta `pushState`/`popstate`, então em mudança de rota client-side perdemos contexto de `source_page` para eventos pós-load.

10. **`source_page` enviado pelo snippet é `location.href`** (URL completa com query), mas o site envia `location.pathname` (sem query). Relatórios de "por página" no CRM e no site não vão bater 1:1.

11. **`form_key` autodescoberto** vira `form_definition` "phq9", "gad7", "contato", "webinar" — bom, mas sem `field_map` configurado, então campos extras (`treatmentInterest`, `message`) ficam só em `custom_fields.form_submission` em vez de virarem colunas reconhecidas.

### Baixos (P3)

12. Snippet não captura `accepts_marketing` (checkbox sem `checked` é descartado pela lógica `if(!el.checked)continue`). Se o usuário **não** marcou, o CRM nunca registra a escolha — só registra quando marcou.

13. Nenhum mecanismo de retry no snippet — `fetch().catch(()=>{})` silencia falha.

14. Sem versionamento do snippet (`Cache-Control: max-age=300`), mudança demora 5 min para propagar.

## Estrutura do documento `11-analise-conflitos-site-or.md`

```text
1. Resumo executivo (1 parágrafo + tabela P0/P1/P2/P3)
2. Metodologia (o que comparei: doc do site + código do CRM)
3. Conflitos detalhados — um por item (14 itens acima)
   Para cada um:
     - Sintoma observável no CRM
     - Causa técnica (com referência a arquivo:linha dos dois lados)
     - Impacto no negócio
     - Quem precisa corrigir (site, CRM, ou ambos)
4. Diagnóstico no site (prompt para rodar lá)
   Bloco pronto para colar no chat do Lovable do site, pedindo para:
     - Confirmar versão do snippet carregada
     - Listar todos os <form> com data-mk-form em produção
     - Verificar se algum bloqueador (CSP, ad-block) está derrubando o script
     - Rodar window.MKForms no console e validar
5. Diagnóstico no CRM (queries SQL prontas)
   - SELECT por integration_id: contagem de form_submissions por dia
   - SELECT form_submissions com visitor_id IS NULL (deve ser 100%)
   - SELECT leads com form_source='form:phq9' e custom_fields completos
   - SELECT tracking_identity_links do clinic_id (deve estar vazio)
6. Matriz "o que cada conflito quebra"
   Linhas: features do CRM (atribuição, funil por origem, dedup, automação por score do teste, ROI por canal)
   Colunas: conflitos P0–P3
```

## Estrutura do documento `12-roadmap-correcao.md`

```text
Fase 0 — Validar (1 dia)
  - Rodar diagnóstico do item 4/5 acima
  - Confirmar allowed_domains do token
  - Confirmar que snippet está realmente carregando nos 3 domínios

Fase 1 — Captura mínima viável (1–2 dias, lado CRM)
  - P0.2: adicionar interceptor de fetch no forms-snippet para /submit-test-result
    → enviar evento "test_completed" para nova rota /track-event ou reutilizar /forms-ingest
  - P0.3: adicionar listener de click delegado para [href*="wa.me"]
    → registrar como lead_event tipo "whatsapp_click"
  - P1.6: alinhar normalização de telefone (decidir: com + ou sem +) e fazer migration retroativa

Fase 2 — Atribuição (3–5 dias)
  - P0.1: pedir ao site para instalar tracking-pixel
    Prompt pronto para o Lovable do site
  - P2.9 + P2.10: adicionar hook de pushState no snippet
  - P1.5: revisar e documentar allowed_domains

Fase 3 — Robustez (1 semana)
  - P1.4: criar field_map explícito por integração via UI do CRM
  - P3.12: capturar checkbox sempre (não só quando marcado)
  - P3.13: adicionar retry com backoff
  - P3.14: versionar snippet (URL com ?v=hash)

Fase 4 — Identidade canônica (opcional, 1 semana)
  - Webhook reverso do site (pg_net) → CRM
    para garantir 100% dos leads independentemente do snippet
  - Mapear lead_id do site ↔ lead_id do CRM via external_ref
```

## Entregáveis

- `docs/integracao/11-analise-conflitos-site-or.md` (~600 linhas, em PT-BR)
- `docs/integracao/12-roadmap-correcao.md` (~250 linhas)
- Atualizar `docs/integracao/README.md` para listar os dois novos arquivos

Não vou tocar em código de edge functions, banco, ou frontend. Só docs.
