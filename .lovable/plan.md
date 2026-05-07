## Problema

Quando uma mensagem é uma resposta (quote a outra), o balão fica com layout quebrado: a citação aparece "vazando" do balão e o texto principal/timestamp desalinham — exatamente o que está circulado em vermelho na sua imagem.

## Causa raiz

Em `src/components/inbox/ChatPane.tsx` (≈linha 951), a citação (`replied`) é renderizada como um `<button>` com `block w-full ... text-[11px] line-clamp-2`.

Dois conflitos com o CSS global:

1. `src/index.css` força `font-size: max(15px, 1em) !important` em praticamente tudo, e tem uma regra que reescreve `.text-[11px]` para `15px !important`. Ou seja, o "text-[11px]" da citação na verdade renderiza em 15px, ocupando muito mais altura do que o esperado.
2. `line-clamp-2` aplica `display: -webkit-box`, que junto com o `w-full` e a falta de `min-w-0` no balão pai faz o conteúdo "explodir" o bubble e o `border-l-2` parecer cortado.

## Correção

Em `src/components/inbox/ChatPane.tsx`, no `MessageRow`:

- Adicionar `min-w-0` no `<div>` do balão (`max-w-[78%] rounded-lg ...`) para que o flexbox respeite o limite.
- Substituir o `<button>` da citação por uma caixinha estilo WhatsApp:
  - container `flex` com uma barrinha vertical (`w-1 rounded-full bg-primary/70`) e o conteúdo num `min-w-0 flex-1 overflow-hidden`;
  - fundo levemente tingido (`bg-black/5 dark:bg-white/5`) e cantos arredondados;
  - primeira linha com label "Você" / "Mensagem" em negrito;
  - segunda linha com o trecho citado, truncado em 2 linhas via `-webkit-box` inline (já que classes utilitárias são sobrescritas pelo CSS global).

Isso elimina o `w-full` problemático, encapsula a citação numa caixa que respeita o bubble, e mantém o visual coerente com o WhatsApp.

Nenhum outro arquivo precisa mudar.
