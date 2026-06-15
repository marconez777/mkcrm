## Problema

Toda mensagem inicial enviada via `wa-redirect` (CTAs do site, testes PHQ-9 / GAD-7 / depressão / EMT, botões de "agendar consulta") tem o mesmo padrão:

```
<frase de marketing pré-definida pelo CTA>
---
*Mantenha esse código na sua mensagem para entrar na fila de atendimento:*
(ref=XXXXXXXX)
```

A IA está lendo o "gostaria de agendar uma avaliação" como intenção real → marca o lead como `interessado`/`tentou_agendar`, e o pipeline já o joga em "Qualificação" sem nenhum sinal de que ele veio de um teste/CTA específico.

## Solução

### 1. Detectar o template deterministicamente

Marcador universal (não depende do texto do CTA):

- linha contém `*Mantenha esse código na sua mensagem para entrar na fila de atendimento:*`
- OU regex `\(ref=[a-z0-9]{6,}\)` na mesma mensagem

Se a **última mensagem do lead** (inbound) é apenas template (sem texto adicional depois do bloco `---`), e **não há nenhuma outra inbound** com conteúdo livre depois dela, tratamos como **primeiro contato via site**.

### 2. Mapa "frase do CTA → origem" (passar pra IA e pra tag)

Extraído das mensagens reais já no banco (`messages` com `ref=`):

| Trecho identificador da 1ª linha | Origem / tag |
|---|---|
| `teste de depressão PHQ-9` | `lead-phq9` |
| `GAD-7` / `teste de ansiedade` | `lead-gad7` |
| `teste de depressão` (sem PHQ-9) | `lead-teste-depressao` |
| `tratamento com EMT` / `estimulação magnética` | `lead-emt` |
| `cetamina` / `escetamina` / `spravato` | `lead-cetamina` |
| `hipnose` / `hipnoterapia` | `lead-hipnose` |
| `agendar uma consulta na Clínica Ór` (CTA genérico) | `lead-site` |
| Qualquer outra com `(ref=)` que não bata acima | `lead-site` |

Mapa fica num módulo único `supabase/functions/_shared/wa-redirect-templates.ts` (exportando regex+tag) e é importado tanto pelo extractor quanto por testes.

### 3. Mudanças

**a) `supabase/functions/_shared/wa-redirect-templates.ts`** (novo)
- exporta `WA_REDIRECT_MARKER_RE`, `WA_REDIRECT_REF_RE`
- exporta `detectOrigin(text): { isTemplate: boolean; tag: string | null; cta: string | null }`
- exporta `KNOWN_CTAS` (array dos trechos da tabela acima) para usar no prompt

**b) `supabase/functions/extractor-tick/index.ts`**

- **System prompt**: adicionar bloco
  ```
  MENSAGENS-TEMPLATE DO SITE (wa-redirect):
  Mensagens que terminam com:
      ---
      *Mantenha esse código na sua mensagem para entrar na fila de atendimento:*
      (ref=XXXXXXXX)
  são TEMPLATES automáticos disparados quando o lead clica num CTA do site
  (não foram digitadas pelo lead). Exemplos de CTAs conhecidos:
  <lista de KNOWN_CTAS>

  Regras quando a única mensagem do lead é esse template:
  - NÃO preencha tentou_agendar, consulta_agendada_em, procedimento_agendado_em
  - NÃO classifique qualificacao (deixe null) — espere o lead realmente conversar
  - Pode preencher procedimento_interesse APENAS se o CTA mencionar
    explicitamente um procedimento (ex.: "tratamento com EMT" → emt;
    "cetamina"/"spravato" → cetamina; "hipnose" → hipnoterapia).
    Se for CTA genérico ("agendar consulta") → procedimento_interesse=null.
  - observacoes pode anotar: "lead veio do CTA <texto>".
  ```

- **`normalizeExtracted`** (guarda determinística):
  Antes de devolver, se `detectOrigin(lastInboundContent).isTemplate === true` E não houver outra inbound com conteúdo não-template, força:
  ```ts
  out.tentou_agendar = null;
  out.consulta_agendada_em = null;
  out.procedimento_agendado_em = null;
  out.qualificacao = null;
  out._wa_redirect_tag = tag;  // campo interno, removido antes do INSERT
  ```

- **`processClinic`**: depois do `applyFields`, se `_wa_redirect_tag` veio:
  - merge em `leads.tags` (sem duplicar)
  - registra `lead_events` `type='wa_redirect_template_detected'` com `{ tag, cta }`

**c) `supabase/functions/extractor-tick/eval/golden/`**
- `11-phq9-template.json` — só PHQ-9 → expected: tudo null, sem agendamento.
- `12-cta-cetamina-template.json` — CTA cetamina → expected: procedimento_interesse=cetamina, qualificacao=null, tentou_agendar=null.
- `13-cta-generico-template.json` — "agendar consulta" genérico → expected: tudo null.

### 4. Backfill (opcional — pergunta abaixo)

SQL único que para cada lead cuja única inbound é template:
- adiciona a tag correspondente (`lead-phq9`, etc) em `leads.tags`
- zera `custom_fields.qualificacao` se estiver como `interessado`
- limpa `tentou_agendar`/datas inferidas

## Fora de escopo

- Não muda `wa-redirect`, `forms-ingest`, nem o conteúdo enviado pelo site.
- Não muda `field-rules-tick` nem pipeline. Os efeitos vêm sozinhos: sem `qualificacao=interessado`, a regra "Interessado" não casa, então o lead fica no stage atual ou no default da clínica.
- Não cria stage/coluna nova.

## Validação

1. `Edmara Schröder` (PHQ-9): reprocessar com `force=true` → ganha tag `lead-phq9`, `qualificacao` vazia, sem `tentou_agendar`.
2. Lead que mandar o template + depois "oi, quero terça 14h às 15h" deve voltar a qualificar normalmente (`em_negociacao`/`tentou_agendar`).
3. Eval: novos 3 goldens passam 100%, sem regressão nos antigos.

## Perguntas

1. **Convenção de tag**: prefere kebab-case (`lead-phq9`, `lead-cetamina`) ou em português com espaços (`Lead PHQ-9`, `Lead Cetamina`)? O sistema já usa tags free-form em `leads.tags[]`.
2. **Backfill**: rodar nos leads existentes que já vieram via template (estimo ~35 leads pelo SQL acima), ou só aplicar daqui pra frente?
3. **CTA genérico "agendar consulta"**: tag `lead-site` está OK, ou prefere algo mais específico (`lead-cta-agendar`)?