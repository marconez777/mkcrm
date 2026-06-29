# Correções em `supabase/functions/clinic-openai-key/index.ts`

1. Trocar o modelo de validação do Gemini:
   - De: `const GEMINI_VALIDATE_MODEL = "gemini-2.5-flash";`
   - Para: `const GEMINI_VALIDATE_MODEL = "gemini-1.5-flash";`

2. No bloco `if (action === "set")`, remover o status 400 do retorno de falha de validação para que o front receba 200 e consiga ler `{ ok: false, error }` em vez do erro genérico "non-2xx":
   - De: `return json({ ok: false, error: r.error, status: await loadStatus(clinic_id) }, 400);`
   - Para: `return json({ ok: false, error: r.error, status: await loadStatus(clinic_id) });`

Sem outras mudanças. Após aplicar, redeploy automático da function; testar salvando a chave Gemini novamente — se ainda falhar, o toast vai exibir a mensagem real do Google.