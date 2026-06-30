## F-INTL-1 (fundação) — react-i18next ligado ao RegionConfig

Bootstrap mínimo do i18n. Próximas passagens traduzem o restante das telas incrementalmente.

- `bun add react-i18next i18next`.
- `src/i18n/index.ts` inicializa o `i18n` com `pt-BR` (fallback) e carrega `pt-BR.json`, `es-ES.json`, `en-US.json` (apenas chaves de navegação por ora).
- `src/i18n/useI18nSync.ts` mantém `i18n.language` colado em `useRegion().locale` (BR/ES/US).
- `src/components/AppShell.tsx`: importa `useI18nSync()`, mapeia `to → nav.<key>` e traduz o label da sidebar.
- `src/main.tsx`: importa `./i18n` no bootstrap.

Validação: `tsgo` verde. Sidebar agora segue automaticamente a região da empresa logada.
