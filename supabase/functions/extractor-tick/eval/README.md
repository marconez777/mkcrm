# Eval — extractor-tick

Avaliação contínua do extractor contra um golden set de conversas reais (anonimizadas).

## Como rodar

```bash
# precisa de OPENAI_API_KEY no ambiente; modelo default gpt-5-nano
deno run --allow-net --allow-env --allow-read \
  supabase/functions/extractor-tick/eval/run.ts
```

Saída: tabela por conversa + `accuracy` global + violações por invariante (I1–I8).

## Adicionar um caso novo

1. Crie `golden/NN-nome-curto.json` com a estrutura:
   ```jsonc
   {
     "id": "NN-nome-curto",
     "description": "uma frase descrevendo o caso",
     "covers": ["B30", "I5"],            // bugs/invariantes cobertos
     "now": "2026-06-14T15:00:00-03:00", // data simulada
     "custom_fields": { "...": "..." },  // estado atual do lead
     "messages": [                        // ordem cronológica
       { "from_me": false, "content": "Oi, queria saber sobre cetamina" },
       { "from_me": true,  "content": "Claro! Aqui é a equipe..." }
     ],
     "expected": {
       "is_administrative_contact": false,
       "procedimento_interesse": "cetamina",
       "qualificacao": "interessado",
       "tipo_atendimento": null
     }
   }
   ```
2. Em `expected` só liste o que você espera assertivamente; campos omitidos são ignorados.
3. Rode o eval e ajuste prompt/schema se algo regredir.

## Baseline

- Onda 2 (2026-06-14): meta ≥ 75% de acerto (vs 44% medido na Parte I).
- Onda 6: meta ≥ 90%.

## Convenção

Anonimize: nomes reais → "Paciente X", "Dr. Y". Mantenha o conteúdo da
conversa fiel — é o que estressa o extractor.
