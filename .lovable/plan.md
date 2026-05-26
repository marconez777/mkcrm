# Adicionar Seção 0 (Inventário) ao prompt para IA

Pequena adição cirúrgica ao `buildAiPrompt` em `src/pages/SettingsForms.tsx`. Nenhum outro arquivo é tocado.

## O que muda

Inserir uma nova **Seção 0 — Inventário obrigatório** logo após o cabeçalho do prompt e **antes** da Seção 1 (Instalar os scripts). Renumerar as seções existentes (1→ continua 1, mas com nota explícita de "só execute depois do inventário").

## Conteúdo da Seção 0

Texto que instrui a IA do site a, **antes de tocar em qualquer coisa**:

1. **Listar todos os `<script>` no `<head>`** que mencionem: `tracking-pixel`, `forms-snippet`, `MKForms`, `mkcrm`, `supabase.co/functions/v1`.
2. **Listar todos os `<form>`** do projeto e classificar cada um:
   - `onSubmit` nativo + `<button type="submit">` → snippet captura sozinho.
   - `fetch` custom / `<button type="button">` → precisa de `window.MKForms.send(formRef)` manual.
   - Já tem chamada manual a `MKForms.send` → marcar para revisão (risco de duplicação).
3. **Listar qualquer código de tracking caseiro** que dispare requests para URLs de CRM/analytics antigas (concorre com o pixel oficial).
4. **Apresentar o inventário ao usuário e aguardar OK** antes de aplicar mudanças.

## Regras de decisão (incluídas na seção)

Tabela curta orientando a IA sobre cada caso:

| Achado | Ação |
|---|---|
| Pixel já existe com `project_id` correto | Manter, não duplicar |
| Pixel existe com `project_id` diferente | Substituir pelo correto |
| Snippet já existe com token correto | Manter |
| Snippet existe com token diferente / antigo | Substituir |
| Pixel **depois** do snippet no HTML | Reordenar (pixel primeiro) |
| Form com `onSubmit` nativo + `MKForms.send` manual | Remover a chamada manual (duplicaria) |
| Form com `fetch` custom **sem** `MKForms.send` | Adicionar a chamada manual |
| Tracking caseiro / dataLayer antigo apontando pra outro CRM | Remover |

## Aviso sobre cookies

Curta nota explicando: **não limpar `_mk_vid` / `_mk_sid`** dos visitantes. Esses cookies preservam o histórico de jornada — apagá-los faz o site tratar visitantes recorrentes como novos.

## Detalhe técnico

- Arquivo: `src/pages/SettingsForms.tsx`
- Função: `buildAiPrompt` (linhas ~511-669)
- Inserir bloco Markdown novo entre o parágrafo introdutório e a "## 1. Instalar os 2 scripts"
- Renumeração: nenhum identificador externo depende dos números das seções, então não há side-effects.

## Fora de escopo

- Não muda nada além do texto do prompt.
- Não toca edge functions, schema, rotas ou UI.
