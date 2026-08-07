---
title: "Guia Prático para IAs: Edição de I18N e Multi-Região"
topic: architecture
kind: map
audience: agent
updated: 2026-07-03
summary: "Instruções passo a passo para agentes (Lovable, Gemini, etc.) sobre como adicionar, modificar ou remover textos, componentes e configurações respeitando o suporte a multi-idiomas e multi-região (BR, ES, US)."
related_docs:
  - docs/maps/I18N_MULTIREGION.md
  - docs/i18n/TRANSLATION_PROCESS.md
---

# Guia para IA: Lidando com I18N e Multi-Região

Este documento serve como um mapa prático para qualquer Inteligência Artificial (ou desenvolvedor humano) ao modificar código neste projeto, garantindo que o sistema de Internacionalização (i18n) e a arquitetura Multi-Região (BR, ES, US) sejam respeitados.

## 1. Onde estão as configurações?
Antes de editar, saiba onde as coisas moram:
- **Traduções (Dicionários):** `src/i18n/locales/pt-BR.json`, `es-ES.json`, `en-US.json`.
- **Configuração de Região (RegionConfig):** `src/lib/region.ts` (Frontend) e `supabase/functions/_shared/region.ts` (Backend).
- **Componente de Switch:** `src/components/LanguageSwitcher.tsx`.
- **Documentação Master:** `docs/maps/I18N_MULTIREGION.md`.

## 2. Regra de Ouro: Nunca "Hardcode"
Ao criar ou editar interfaces (React components):
- ❌ **Não** escreva textos diretamente em português, inglês ou espanhol nas tags JSX (ex: `<div>Salvar</div>`).
- ✅ **Faça** uso do hook `useTranslation()` do `react-i18next` e renderize chaves (ex: `<div>{t("comum.salvar")}</div>`).

### Exemplo de Uso
```tsx
import { useTranslation } from "react-i18next";

export function MeuComponente() {
  const { t } = useTranslation();
  return <button>{t("features.meuComponente.botaoAcao")}</button>;
}
```

## 3. Como Adicionar ou Modificar Textos
Se você precisa adicionar um novo texto na interface:
1. Vá até `src/i18n/locales/pt-BR.json`.
2. Adicione a sua nova chave seguindo a estrutura de objetos existente (use o escopo da sua feature).
3. **CRÍTICO:** Você **DEVE** adicionar exatamente a mesma chave em `es-ES.json` e `en-US.json`. 
   * Se você é um agente de IA e não souber a tradução perfeita, coloque a chave em espanhol e inglês traduzindo da melhor maneira possível. Não quebre a paridade das árvores JSON. O CI do projeto fará a validação, mas não faça um commit faltando as chaves equivalentes.

## 4. Formatando Moeda, Datas e Telefones
O sistema é Multi-Tenant e Multi-Região. Um inquilino (clínica) pode estar no Brasil, Espanha ou EUA.
- ❌ **Não** presuma `BRL` (Reais) ou `R$`.
- ❌ **Não** presuma o fuso horário `America/Sao_Paulo`.
- ❌ **Não** presuma código de país `+55`.

### O jeito correto no Frontend
Sempre invoque o hook `useRegion()` no frontend para obter os dados da região atual do usuário.

```tsx
import { useRegion } from "@/hooks/useRegion";

export function TabelaPrecos() {
  const { currency, timezone, phoneCountry } = useRegion();
  
  // Exemplo de formatação monetária correta:
  const formatadorMoeda = new Intl.NumberFormat(undefined, { 
    style: "currency", 
    currency: currency // Pode ser BRL, EUR, USD
  });
  
  return <span>{formatadorMoeda.format(150.00)}</span>;
}
```

## 5. Edições no Backend (Edge Functions)
Se você estiver editando funções na pasta `supabase/functions/`:
- Utilize `_shared/region.ts` para resolver o `RegionConfig` a partir do `clinic_id`.
- Ao lidar com cron jobs (`automations-tick`, etc) ou parser de datas, certifique-se de passar o `timezone` correto daquela clínica. Não assuma que o servidor roda no horário do Brasil.

## 6. Integridade de Sync
Se, por qualquer motivo, você editar o schema ou o default region fallback no arquivo `src/lib/region.ts` (ex: adicionando uma nova região "mx" ou novo provider de pagamento), você é **obrigado** a refletir a mesma alteração em `supabase/functions/_shared/region.ts`. Eles devem permanecer sincronizados.
