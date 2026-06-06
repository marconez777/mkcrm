Animar suavemente as duas "fumaças" (roxa e verde) do Hero em um ciclo contínuo.

## Arquivo
- `src/components/site/Hero.tsx` — bloco "Glow ambiente roxo + verde" (linhas 57-64).

## Mudança
- Separar o background em duas camadas (uma para o roxo, outra para o verde), cada uma como `motion.div`, para poder anima-las independentemente.
- Animar via framer-motion (já usado no projeto), com `animate={{ x: [...], y: [...] }}`, `transition={{ duration, times, repeat: Infinity, ease: "easeInOut" }}`.
- Ciclo (≈12s, lento e suave) para cada camada:
  1. ponto inicial (0,0)
  2. sobe (y: -20px)
  3. lado (x: +25px)
  4. desce (y: +20px)
  5. volta ao centro (0,0)
  6. pausa de 1s no ponto inicial
  7. repete
- A camada verde usa direção espelhada (lado oposto) para dar variedade visual.
- Movimento bem sutil (20-25px), `ease: "easeInOut"` para parecer fumaça.

## Detalhes técnicos

Estrutura aproximada:
```tsx
<motion.div
  aria-hidden
  className="pointer-events-none absolute inset-0 -z-10"
  style={{
    background:
      "radial-gradient(60% 50% at 20% 30%, hsl(var(--site-accent) / 0.55) 0%, transparent 60%)",
  }}
  animate={{ x: [0, 0, 25, 0, 0, 0], y: [0, -20, 0, 20, 0, 0] }}
  transition={{
    duration: 12,
    times: [0, 0.2, 0.4, 0.6, 0.8, 0.92], // 8% final = pausa ≈1s antes de repetir
    repeat: Infinity,
    ease: "easeInOut",
  }}
/>
<motion.div /* verde, valores espelhados */ />
```

Nada mais é alterado (grid, máscara, conteúdo). Sem novas dependências.