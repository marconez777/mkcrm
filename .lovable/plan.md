## Problema
Hoje o horário (ex.: `08:02`) aparece em uma linha própria abaixo da mensagem, com tamanho parecido ao corpo e opacidade 70%. Isso faz ele competir visualmente com o texto, podendo ser lido como parte da mensagem (ex.: "amanhã 08:02").

No WhatsApp o horário fica encostado no canto inferior direito, **menor, mais claro e na mesma linha do final do texto**, com leve recuo para não tocar a borda.

## Mudança (apenas visual, em `src/components/inbox/ChatPane.tsx`)

Alvo: bloco do timestamp por volta da linha 912.

1. **Reduzir peso visual do horário**
   - Tamanho: `text-[10px]` → `text-[10px] leading-none`
   - Cor: trocar `opacity-70` por uma cor explícita mais suave, ex. `text-foreground/45` (mantendo legibilidade em ambas as bolhas — me/them).
   - Tabular nums para não "dançar": `tabular-nums`.

2. **Encostar no canto e dar respiro da borda**
   - Container do horário: `mt-0` (em vez de `mt-0.5`), `-mb-0.5 -mr-1 pl-2` para puxar até o canto inferior direito como o WhatsApp.

3. **Permitir que o horário fique na mesma linha do final do texto (efeito "float" do WhatsApp)**
   - Acrescentar ao final do `<div className="whitespace-pre-wrap break-words">` do conteúdo um espaçador invisível com a largura aproximada do horário+ticks, para que, quando a última linha for curta, o timestamp "encaixe" do lado. Algo como:
     ```tsx
     <span aria-hidden className="inline-block w-[58px] h-0 align-bottom" />
     ```
   - E posicionar o bloco do timestamp com `float: right` dentro da bolha (ou usar `position: absolute` no canto inferior direito da bolha — `relative` no container da bolha já existente). Vou usar a abordagem `absolute bottom-1 right-2` no bloco do timestamp + `relative pb-4` na bolha, que é a técnica que o WhatsApp Web usa e dá o melhor resultado.

4. **Ajustes finos da bolha**
   - Adicionar `relative` ao `div` da bolha (linha 868-877).
   - Trocar `py-1.5` por `pt-1.5 pb-1` e reservar espaço no canto via `pr-12 pb-4` apenas quando houver timestamp visível (sempre há).
   - O ícone de status (`StatusTicks`) continua ao lado do horário, mas com `h-3 w-3` e `text-foreground/45`.

5. **Não mexer**
   - Nenhuma mudança em lógica, dados, formatação de hora (`fmtTime`), agrupamento (`grouped`) ou nas ações de hover.
   - Não alterar bolhas de mídia/áudio além do padding da bolha externa.

## Validação
- Abrir `/inbox`, verificar mensagens curtas (`amanhã`, `oi`) e longas (`Podemos agendar para quinta as 15 horas?`):
  - Em mensagens curtas: horário aparece encaixado à direita do texto.
  - Em mensagens longas (quebra de linha): horário aparece no canto inferior direito, sem sobrepor o texto.
- Conferir em bolha "me" (verde) e "them" (cinza) — contraste do horário ok.
- Conferir bolhas com mídia, áudio e reply citado — horário continua no canto sem encostar na borda.
