## Diagnóstico

O erro `NotFoundError: Failed to execute 'removeChild' on 'Node'` que derruba a tela é um sintoma clássico do **Google Tradutor do Chrome** traduzindo a página em tempo real. Quando ele substitui nós de texto, o React perde a referência ao DOM original e qualquer próxima atualização (clique, abrir drawer, mudar de aba) quebra com esse erro e renderiza tela branca.

Por que afeta a clínica Sanapta e não outras: o `index.html` está com `<html lang="en">`, mas o conteúdo é todo em português. O Chrome desses usuários está configurado para traduzir automaticamente páginas em "outro idioma" — então traduz tudo e quebra. Em contas cujos usuários têm o tradutor desligado, não acontece.

Os 403 nas URLs `pps.whatsapp.net/...n.jpg` são separados (avatares do WhatsApp expirados / bloqueio de cookies de terceiros) e **não** causam a tela branca — apenas mostram um avatar quebrado. Trato à parte.

## Correção (UI / HTML apenas)

### 1. `index.html` — bloquear tradução automática
- Trocar `<html lang="en">` por `<html lang="pt-BR" translate="no">`.
- Adicionar no `<head>`:
  - `<meta name="google" content="notranslate" />`
  - `<meta http-equiv="Content-Language" content="pt-BR" />`
- Adicionar `class="notranslate"` no `<body>` como reforço.

Isso instrui o Chrome (e outros navegadores) a **não** traduzir a página, eliminando a causa raiz do `removeChild` em todas as contas.

### 2. Avatares do WhatsApp 403 (pequeno polimento, opcional dentro do mesmo fix)
- Em `src/components/inbox/ConversationList.tsx` / `ChatPane.tsx` / onde o avatar é renderizado, adicionar `onError` no `<img>` que faz fallback para as iniciais já existentes, evitando o ícone quebrado no console quando a URL do WhatsApp expira.
- Não mexer no `useWaAvatar` nem na edge `fetch-wa-avatar`.

## Como validar

1. Abrir a conta da Sanapta no Chrome com tradutor ativo.
2. Confirmar que o ícone de "traduzir" não aparece mais e nenhuma ação derruba a tela.
3. Conferir o console — sem `NotFoundError: removeChild`.

## Fora de escopo
- Sistema de bloqueio de login (já removido na mensagem anterior).
- Mudanças de lógica/back-end.
- Refazer fluxo de avatar do WhatsApp.
