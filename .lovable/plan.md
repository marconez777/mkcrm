Atualizar os 3 botões de CTA dos planos em `src/components/site/Pricing.tsx` para usar fundo verde WhatsApp com o ícone do WhatsApp à esquerda do texto.

## Mudanças

- Remover variação de estilo entre plano destacado e não destacado: todos os botões ficam verdes (`bg-[#25D366]` com hover `brightness-110`), texto branco.
- Adicionar ícone do WhatsApp (lucide `MessageCircle` substituído pelo SVG oficial inline, ou usar `lucide-react`'s não tem — usar SVG inline simples do WhatsApp) à esquerda do label.
- Manter href, target e mensagem já existentes.

## Detalhes técnicos

- Usar SVG inline do logo WhatsApp (path oficial) com `h-5 w-5 fill-white` para garantir fidelidade visual (lucide não tem ícone WhatsApp dedicado).
- Classe do botão unificada: `bg-[#25D366] text-white hover:brightness-110` mantendo `h-12 rounded-full px-6`.
- Sem outras alterações.
