## Objetivo

Permitir que a importação de contatos do **Disparo em massa** aceite telefones em formato internacional (ex.: `+34 604 81 44 22`, `+1 415 555 9876`, `+351 …`), independente da região da conta (BR, ES, US).

## Diagnóstico

- `src/lib/broadcast-template.ts::parseContactsFile` chama `normalizePhone(raw, region.phoneCountry)`.
- `src/lib/phone.ts::normalizePhone` só passa números internacionais quando o `+` está presente **E** o libphonenumber consegue parsear com o país default. Se o Excel salvar a célula como numérica, o `+` some (`+34604814422` → `34604814422`) e o fallback BR prefixa `55`, gerando telefone inválido.
- Não há UI de entrada manual de telefone no disparo — só upload de planilha —, então basta corrigir o parser + template.

## Mudanças

### 1. `src/lib/phone.ts` — parser internacional-first

Adicionar helper `normalizePhoneIntl(raw, defaultCountry)`:

1. Se `raw` já começa com `+`, parsear sem hint de país.
2. Se não começa com `+`, mas os dígitos batem com um **country code conhecido** (34, 1, 351, 44, 33, 55, 52, 54, 49, 39, 351, etc.), tentar `parsePhoneNumberFromString("+" + digits)`.
3. Se ainda inválido, cair no comportamento atual (`normalizePhone(raw, defaultCountry)`).
4. Devolver `null` se nada funcionar.

Manter `normalizePhone` como está (usado em muitos lugares) — só o disparo passa a usar `normalizePhoneIntl`.

### 2. `src/lib/broadcast-template.ts`

- Trocar `normalizePhone(phoneRaw, spec.phoneCountry)` por `normalizePhoneIntl(phoneRaw, spec.phoneCountry)`.
- Aceitar aliases adicionais no header: `phone`, `whatsapp`, `mobile` em todas as regiões (já é o caso na maioria — garantir consistência).
- Atualizar `headerNote` das 3 regiões para deixar claro que números internacionais com `+DDI` são aceitos:
  - BR: "Inclua DDD. DDI 55 é adicionado se ausente. Para números estrangeiros, use +DDI (ex.: +34 604 81 44 22)."
  - ES: "Incluye +DDI para números extranjeros (ej.: +55 11 99999 8888)."
  - US: "Include +country code for foreign numbers (e.g., +55 11 99999 8888)."
- Nos exemplos do XLSX, incluir 1 linha internacional para ilustrar (ex.: `+1 415 555 9876` na planilha BR).

### 3. Preservar `+` no Excel

Como planilhas costumam salvar telefones como número e perder o `+`, o parser já vai lidar tentando detectar country code por prefixo (passo 2 acima). Não precisa mudar o formato do template — só documentar.

## Testes manuais

Após implementar, testar upload com uma planilha contendo:

- `+34 604 81 44 22` (ES com espaços)
- `34604814422` (ES sem `+`, cell numérico)
- `+1 (415) 555-9876` (US)
- `5511999998888` (BR — continua funcionando)
- `11999998888` (BR nacional — continua funcionando em conta BR)

Todos devem entrar em `ok`, nenhum em `errors`.

## Fora de escopo

- Import do Kommo (arquivo separado, mesmo helper pode ser reusado depois).
- Novas conversas no Inbox (`NewConversationDialog`) — só se você pedir.
