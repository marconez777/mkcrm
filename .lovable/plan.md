Mudança mínima em `src/pages/SettingsCustomFields.tsx` na função `newField()`:

- `field_type` inicial: `"text"` → `"select"`
- `options` inicial: `null` → `[]`

Assim, ao clicar em "Novo campo", o tipo já vem como **Lista (uma opção)** e o textarea de opções aparece imediatamente, lembrando o usuário de cadastrar as opções.

Sem mudança de schema, sem efeito em campos já existentes.