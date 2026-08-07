---
title: "Processo de tradução PT→ES/EN"
topic: operations
kind: reference
audience: agent
updated: 2026-06-30
summary: "Fluxo contínuo de tradução: extração de strings, geração via Lovable AI, revisão nativa e versionamento dos locales."
code_refs:
  - src/locales/
related_docs:
  - docs/i18n/ROADMAP.md
---

# Processo de tradução

## Estrutura de arquivos

```
src/locales/
├── pt/   (base — fonte da verdade)
│   ├── common.json
│   ├── inbox.json
│   ├── kanban.json
│   ├── settings.json
│   ├── admin.json
│   ├── broadcasts.json
│   └── ...
├── es/
└── en/
```

## Fluxo

1. **Desenvolvedor** adiciona/modifica chave em `src/locales/pt/<ns>.json`.
2. Pre-commit hook detecta diff e marca `<chave>` como `__pending__` em `es/` e `en/`.
3. **Geração automática** (Lovable AI Gateway, Gemini 2.5 Flash):
   ```bash
   node scripts/i18n-translate.mjs --from pt --to es,en
   ```
   - System prompt inclui glossário (`docs/i18n/GLOSSARY.md`).
   - Saída marcada como `__draft__`.
4. **Revisão nativa** (humano ES/US) muda `__draft__` → valor final.
5. PR exige `__pending__` e `__draft__` zerados antes de merge.

## Glossário (a criar)

Termos com tradução fixa para evitar drift:

| PT | ES | EN |
|---|---|---|
| Funil | Embudo | Pipeline |
| Lead | Lead | Lead |
| Disparo em massa | Envío masivo | Broadcast |
| Atendente | Agente | Agent |
| Etapa | Etapa | Stage |
| Empresa | Empresa | Company |

## CI

`scripts/i18n-validate.mjs` (a criar) falha se:
- Chave existe em `pt/` mas não em `es/` ou `en/`.
- Valor `__pending__` ou `__draft__` em PR para `main`.
- Interpolations (`{{var}}`) divergem entre idiomas.
