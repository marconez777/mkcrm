Aplicar o mesmo background da seção "Sobre o MK-CRM" na seção "Tudo o que vem dentro" (`src/components/site/Capabilities.tsx`), girado 90° (vertical em vez de horizontal).

## O que muda

- `src/components/site/Capabilities.tsx`:
  - Remover os dois `<AuroraBlob>` decorativos atuais (canto superior-esquerdo e inferior-direito).
  - Adicionar duas camadas radiais absolutas iguais às do `About.tsx`, mas com o eixo trocado:
    - Esquerda (no lugar do "topo"): roxo `hsl(var(--site-accent-glow) / 0.45)` — elipse com eixo maior na vertical, posicionada em `-10% 50%`.
    - Direita (no lugar do "fundo"): verde `hsl(var(--site-primary) / 0.22)` — elipse vertical em `110% 50%` (equivalente a `90% 50%` espelhado, ficando na borda direita).
  - Manter `bg-site-surface` (fundo levemente diferente do About, preservando contraste entre seções) e o restante do conteúdo intacto.

## Detalhes técnicos

Sintaxe das camadas (rotação 90°: trocar largura/altura do `ellipse` e mover o foco do eixo Y para o eixo X):

```text
radial-gradient(ellipse 70% 90% at -10% 50%, hsl(var(--site-accent-glow) / 0.45), transparent)
radial-gradient(ellipse 50% 70% at 110% 50%, hsl(var(--site-primary) / 0.22), transparent)
```

Import de `AuroraBlob` continua sendo usado em outras seções? Vou verificar; se este arquivo for o único consumidor da importação, removo o import também. Se for compartilhado, só removo o uso.

Nenhum arquivo novo, nenhuma dependência nova.