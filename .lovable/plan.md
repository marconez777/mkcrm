## F-INTL-3 (parcial) — Moeda local nos surfaces de lead

Pequeno passo: surfaces que mostram valor de negócio agora respeitam `RegionConfig`.

- `src/pages/Kanban.tsx`: total da coluna usa `formatMoney(total, region.currency, region.locale)` em vez de `Intl` fixo BRL.
- `src/components/inbox/CustomFieldsPanel.tsx`: campo `currency` mostra o símbolo local (R$ / € / $) via `Intl.NumberFormat … currencyDisplay:"narrowSymbol"`, derivado do `useRegion()`.
- `src/pages/SettingsCustomFields.tsx`: rótulo do tipo `currency` agora é só "Moeda" (sem "R$").

### Fora de escopo desta passagem
- Datas hardcoded `toLocaleDateString("pt-BR")` no Kanban (linhas 90/96/197/299) — defer F-INTL-1.
- Admin/email surfaces (`AdminEduzz`, `EmailDashboard`, `UsageLimitsPanel`, etc.) continuam exibindo BRL — base BR/admin no MVP.

### Próximos passos sugeridos
- F-INTL-1: i18n frontend (`react-i18next`) para tirar strings PT hardcoded da UI.
- F-INTL-3 (full): sweep de datas/moeda nas páginas admin.
- F-INTL-4: integração Stripe ES/US.
