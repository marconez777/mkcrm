Aumentar a amplitude do movimento das fumaças no Hero.

## Arquivo
- `src/components/site/Hero.tsx` — linhas 65 e 80 (`animate` das duas `motion.div`).

## Mudança
- Roxo: `x: [0, 0, 25, 0, 0, 0], y: [0, -20, 0, 20, 0, 0]` → `x: [0, 0, 120, 0, 0, 0], y: [0, -90, 0, 90, 0, 0]`.
- Verde (espelhado): `x: [0, 0, -25, 0, 0, 0], y: [0, 20, 0, -20, 0, 0]` → `x: [0, 0, -120, 0, 0, 0], y: [0, 90, 0, -90, 0, 0]`.

Duração (6s), pausa (1s no final) e easing continuam iguais. Sem novos arquivos.