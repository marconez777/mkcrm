Atualizar os botões de CTA de cada plano em `src/components/site/Pricing.tsx` para apontarem para o WhatsApp do número 11991795436 com mensagem pré-preenchida.

## Mudanças

- Substituir o `<a href="#contato">` por um link `https://wa.me/5511991795436?text=...` em cada card de plano.
- Mensagem dinâmica por plano: `Quero assinar o plano {nome}` (URL-encoded).
- Abrir em nova aba (`target="_blank"` + `rel="noopener noreferrer"`).
- Sem outras alterações visuais ou de conteúdo.

## Detalhes técnicos

```tsx
href={`https://wa.me/5511991795436?text=${encodeURIComponent(`Quero assinar o plano ${plan.name}`)}`}
target="_blank"
rel="noopener noreferrer"
```

Aplicado nos 3 planos (Starter, Pro, Supreme). Adiciono o código do país `55` (Brasil) ao número, padrão exigido pelo `wa.me`.