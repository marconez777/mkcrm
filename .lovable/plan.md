Adicionar o fundo gradiente (variante demo.tsx — slate-950 com radial roxo/verde) atrás da seção "Sobre o MK-CRM" em `src/components/site/About.tsx`.

## O que muda

- `src/components/site/About.tsx`:
  - Trocar `bg-site-bg` da `<section>` por classes de fundo escuro + camadas radiais absolutas.
  - Adicionar dois `<div aria-hidden>` posicionados absolutamente dentro da section com os radial-gradients do snippet.
  - Garantir `position: relative` e `overflow-hidden` na section para conter as camadas.
  - Manter todo o conteúdo (pillars, headline, copy) inalterado — apenas o background da seção é afetado.

## Detalhes técnicos

A section ficará assim (estrutura):

```text
<section relative overflow-hidden bg-slate-950>
  <div absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(139,92,246,0.35),transparent)] />
  <div absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_90%,rgba(34,197,94,0.2),transparent)] />
  <div relative ...> {/* conteúdo existente */} </div>
</section>
```

Não usamos a versão `fixed inset-0 -z-10` do snippet porque queremos o fundo **somente na seção Sobre**, não no site inteiro. Por isso adapto para `absolute` dentro da própria section.

Observação: o snippet usa cores hex/rgba diretas (fora do design system de tokens). Como é um efeito decorativo pontual pedido pelo usuário, mantenho os valores do snippet. Se preferir tokenizar (`--site-accent`, `--site-primary`) depois, é só pedir.

Nenhum arquivo novo, nenhuma dependência nova.