## Causa raiz

`transcribe-audio` retorna 502 porque a chave OpenAI da Clínica Ór (`ai_agents.role=summary/analyst`) está inválida (`401 Incorrect API key`). Hoje a função só usa a chave do agente da clínica — sem fallback — então qualquer transcrição quebra até o usuário trocar a chave manualmente.

## Objetivo

1. Destravar transcrição imediatamente (sem depender do cliente trocar a chave).
2. Mostrar mensagem clara no toast quando ainda falhar.
3. Avisar o admin da clínica que a chave OpenAI precisa ser renovada.

## Mudanças

### 1. `supabase/functions/transcribe-audio/index.ts`
- Manter ordem atual: tentar primeiro o agente da clínica (OpenAI Whisper ou Gemini direto).
- **Adicionar fallback Lovable AI Gateway** quando:
  - nenhum agente OpenAI/Google com chave válida estiver configurado, **ou**
  - a chamada do agente retornar 401/403/invalid_api_key.
- Fallback usa `google/gemini-2.5-flash` via Gateway (`LOVABLE_API_KEY`, já disponível) com `inline_data` áudio → prompt "Transcreva fielmente em PT-BR. Retorne apenas a transcrição." (formato documentado em `ai-multimodal-input`, endpoint `/v1/chat/completions` com `input_audio` base64 — `audio/ogg` é suportado).
- Tratar `429` (credits/rate) e `402` do Gateway com mensagens específicas.
- Quando a chave do agente devolver 401, gravar evento em `webhook_events` (`type='ai_key_invalid'`, payload com `clinic_id`, `provider`, prefixo da chave) para diagnóstico/alerta — sem desabilitar o agente automaticamente.
- Resposta de erro continua HTTP 200 com `{ ok: false, error, code }` para o cliente conseguir ler (hoje volta 4xx/5xx e o invoke do supabase-js esconde o body).

### 2. `src/components/inbox/...` (botão "Transcrever áudio")
Localizar o handler do botão (provavelmente em `MediaBubbles.tsx` ou `ChatPane.tsx`), e:
- Ler `data.error` quando `data.ok === false` e mostrar no toast (ex.: "Chave OpenAI inválida — atualize em IA → Agentes" ou "Sem créditos no Lovable AI").
- Manter mensagem genérica só como último fallback.

### 3. Aviso para o admin
- Em `src/components/settings/OpenAIKeyCard.tsx` (ou card de agentes), adicionar badge quando houver evento recente `ai_key_invalid` para o `clinic_id` (consulta simples nos últimos 7 dias) → "Chave OpenAI rejeitada em <data>, atualize".

### 4. Warning Radix `DialogTitle/Description`
- Identificar o `DialogContent` sem título (provavelmente o `CommandPalette` ou outro) e envolver com `VisuallyHidden` + `DialogTitle`/`DialogDescription`. Mudança cosmética, no mesmo passe.

## Fora de escopo

- Não trocar a chave do cliente automaticamente.
- Não migrar todo o pipeline de IA para o Gateway — só transcrição ganha fallback.
- Não mexer em `record-audio` / envio de áudio outbound.

## Validação

1. `supabase--curl_edge_functions /transcribe-audio` com a mensagem `f4ad61ef-...` deve retornar `{ ok:true, transcript:"..." }` via Gateway.
2. Repetir após o cliente atualizar a chave → deve voltar a usar OpenAI Whisper (primeiro caminho).
3. UI: clicar "Transcrever áudio" e confirmar toast com mensagem real em caso de erro.
4. Conferir que `webhook_events` registra `ai_key_invalid` uma vez por falha.

Posso seguir?