## Diagnóstico

Olhando o print, os telefones estrangeiros entraram como `5534604814422` e `5534614113278` — ou seja, o Excel apagou o `+` (célula numérica), o input virou `34604814422` (11 dígitos) e o **fallback BR** do `normalizePhone` prefixou `55`, resultando em número inválido.

A ordem atual em `normalizePhoneIntl` (`src/lib/phone.ts`) é:

1. Se começa com `+` → parseia internacional. ✅
2. **Tenta como nacional primeiro** via `normalizePhone(raw, defaultCountry)`. ❌ Aqui, para conta BR, o libphonenumber falha com "34604814422" como BR, cai no fallback legado (`digits.length === 10 || 11 → "55" + digits`) e devolve `5534604814422`. **Nunca chega no passo 3.**
3. Prefix-match com `KNOWN_COUNTRY_CODES` (nunca executado no caso acima).

Ou seja: o fallback legado BR está "vencendo" a heurística internacional. Todo número estrangeiro de 10–11 dígitos sem `+` (ES, US, MX, AR etc.) é convertido em número BR falso.

## Plano em fases

### Fase 1 — Reordenar `normalizePhoneIntl` para priorizar detecção internacional

Em `src/lib/phone.ts`:

1. Se `raw` começa com `+` → parse internacional (mantém).
2. **Tentar prefix-match de country code conhecido ANTES do fallback nacional**, quando os dígitos começam com um DDI ≠ do país default. Se `parsePhoneNumberFromString("+" + digits)` for `isValid()`, retornar.
3. Tentar parse nacional estrito com libphonenumber (`parsePhoneNumberFromString(raw, defaultCountry)`) e só aceitar se `isValid()`.
4. **Só então** aplicar o fallback legado BR (`10/11 dígitos → 55 + digits`), e **apenas quando `defaultCountry === "BR"` e o prefixo não bater com outro DDI conhecido**.
5. Retornar `null` se nada validar.

Isso resolve o caso `34604814422` (ES via BR): passo 2 detecta DDI 34, libphonenumber valida móvel espanhol de 9 dígitos, retorna `34604814422`.

### Fase 2 — Blindar o fallback BR

Ainda em `src/lib/phone.ts::normalizePhone`, restringir o fallback:

- Aceitar `10/11 dígitos → 55+` só se **os dois primeiros dígitos formarem um DDD BR válido** (11–99, com a lista real de DDDs). Isso evita que "34…" (DDD inválido no BR) seja tratado como nacional.
- Aceitar `12/13 dígitos` como já são se começarem com `55`; caso comecem com outro DDI conhecido, delegar para libphonenumber sem prefixar nada.

### Fase 3 — Feedback visível ao usuário no disparo

Em `src/pages/Broadcasts.tsx` (lista importada mostrada no print):

- Formatar o telefone renderizado com `formatPhoneDisplay` (`+34 604 81 44 22`) em vez do E.164 cru, para o usuário perceber imediatamente quando o parse foi para o país errado.
- Continuar exibindo o contador de `errors` da `parseContactsFile`.

### Fase 4 — Testes manuais de regressão

Planilha de teste com uma linha de cada:

| Input no XLSX | Conta | Esperado |
|---|---|---|
| `+34 604 81 44 22` | BR | `34604814422` |
| `34604814422` (numérico, sem `+`) | BR | `34604814422` |
| `+1 (415) 555-9876` | BR | `14155559876` |
| `5511999998888` | BR | `5511999998888` |
| `11999998888` | BR | `5511999998888` |
| `34604814422` | ES | `34604814422` |
| `+55 11 99999 8888` | ES | `5511999998888` |

Todos devem cair em `ok`, zero em `errors`, e a UI deve mostrá-los formatados internacionalmente.

## Fora de escopo

- Kommo import, NewConversationDialog, edge functions de envio (o telefone chega já normalizado da Fase 1).
- Mudar o formato do XLSX de template.

## Detalhes técnicos (para referência)

- Arquivos tocados: `src/lib/phone.ts`, `src/pages/Broadcasts.tsx`.
- Dependência já instalada: `libphonenumber-js` (usa metadados completos).
- DDDs BR válidos: 11–19, 21–24, 27, 28, 31–35, 37, 38, 41–49, 51, 53–55, 61–69, 71, 73–75, 77, 79, 81–89, 91–99 (lista fechada, ~67 valores).
