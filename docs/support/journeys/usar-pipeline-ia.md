---
title: Manual do Pipeline IA — como usar, monitorar e configurar
topic: ai
kind: journey
audience: both
updated: 2026-06-11
summary: Manual leigo de ponta a ponta do Pipeline IA (extractor, vision, audio, field-rules, crons e budgets) para donos de clínica.
code_refs:
  - src/pages/Settings.tsx
  - src/components/settings/ExtractorHistoryCard.tsx
  - src/components/settings/AILimitsCard.tsx
  - src/components/settings/FieldRulesCard.tsx
  - src/pages/Kanban.tsx
  - supabase/functions/extractor-tick/
  - supabase/functions/vision-tick/
  - supabase/functions/audio-tick/
  - supabase/functions/field-rules-tick/
related_docs:
  - docs/roadmap/CLINIC_PIPELINE.md
  - docs/support/pages/settings.md
  - docs/support/pages/kanban.md
---

# 🤖 Manual do Pipeline IA — como usar, monitorar e configurar

> Este manual é para **dono(a) de clínica e equipe da recepção**. Você **não precisa** entender nada de programação. Se aparecer alguma palavra estranha, ela está explicada no **Glossário** no final.

---

## 1. O que é o "Pipeline IA"?

Imagine que você contratou um **estagiário super dedicado** que fica 24h online lendo o WhatsApp da clínica. Esse estagiário:

- **Lê cada mensagem** que chega de um lead (paciente em potencial).
- **Anota num caderninho** o que ele entendeu: "essa pessoa quer fazer EMT", "pediu o preço", "mandou comprovante de pagamento", "agendou pra terça".
- **Move o cartãozinho da pessoa de coluna no Kanban** sozinho conforme a conversa avança (de "Novo lead" → "Interessado" → "Negociação" → "Agendado").
- **Avisa você** quando algo importante acontece (ex.: chegou um comprovante de pagamento).

Esse estagiário, na verdade, são **4 robôs** trabalhando em conjunto. Cada um cuida de uma coisa.

> 💡 **Por que isso importa?** Sua recepção deixa de perder tempo lendo todas as mensagens só pra atualizar o CRM. A IA faz isso. Você cuida do que importa: **fechar tratamento**.

---

## 2. Os 4 robôs em 1 página

| Robô | O que ele faz | Quando ele acorda |
|---|---|---|
| 🧠 **Extractor** (texto) | Lê as últimas mensagens de texto do lead e preenche os campos personalizados ("qualificação", "procedimento de interesse", "tentou pagamento"…). | A cada **2 minutos** |
| 👁️ **Vision** (imagem) | Olha foto ou PDF de comprovante de Pix/transferência e marca o lead como "pagou" (com valor, método, data). | A cada **3 minutos** |
| 🎤 **Audio** (Whisper) | Transcreve o áudio do WhatsApp pra texto, pra você não precisar ouvir. Depois o Extractor lê a transcrição. | A cada **5 minutos** |
| 📋 **Field-rules** (regras) | Lê o caderninho preenchido pelos outros e **move o card no Kanban** conforme regras que você criou (ex.: "se pagou, vai pra coluna Agendamento"). | A cada **2 minutos** |

> 🧪 **Teste rápido pra entender**: mande pra clínica, do seu próprio WhatsApp, a frase **"quero saber sobre EMT, qual o valor?"**. Em até 2 min, o card desse lead vai ter o chip **Interessado** e a etiqueta **EMT** preenchidos sozinhos.

---

## 3. Como ligar (5 minutos)

A IA **não funciona sozinha** — você precisa cadastrar uma **chave da OpenAI** (o cérebro). A clínica paga o consumo da própria OpenAI direto (chamamos isso de **BYOK** — *Bring Your Own Key*, "traga sua própria chave").

### 3.1 Pegar a chave na OpenAI (uma única vez)
1. Acesse [platform.openai.com](https://platform.openai.com) e crie uma conta (ou faça login).
2. Vá em **API keys** → **Create new secret key**.
3. Copie a chave que começa com `sk-...`. **Guarde com cuidado** — ela só aparece uma vez.
4. Coloque um cartão de crédito em **Billing** e adicione **US$ 10** de saldo (já dá pra rodar muito).

### 3.2 Cadastrar a chave na clínica
1. No CRM, vá em **Configurações** (`/settings`) → aba **IA do Pipeline**.
2. No primeiro card, cole sua chave `sk-...` no campo **Chave da OpenAI**.
3. Clique em **Salvar**.
4. Clique em **Validar chave** — se aparecer **✅ Chave válida**, está pronto. Se aparecer **❌ Inválida**, confira se copiou inteira.

### 3.3 Confirmar que está rodando
Tudo já vem **ligado de fábrica**. Os 4 robôs rodam automaticamente nos intervalos da tabela acima. Se você quiser ver "funcionando ao vivo", role até o card **Histórico & custos** e clique em **Rodar texto** — ele dispara o Extractor agora e mostra o resultado em segundos.

> ⚠️ **Cuidado**: nunca compartilhe sua chave `sk-...` por WhatsApp ou e-mail. Quem tiver ela pode gastar seu saldo da OpenAI. Se vazou, vá na OpenAI e clique em **Revoke** pra invalidar, depois gere uma nova.

---

## 4. Limites e orçamento — pra não estourar a fatura

Tudo isto está no card **Limites & budgets da IA** (mesma aba). Os valores padrão já são conservadores. Mexa só se entender o porquê.

### 4.1 Comportamento

| Campo | O que significa | Padrão | Se aumentar | Se diminuir |
|---|---|---|---|---|
| **Lock manual (minutos)** | Depois que um humano responde no chat, a IA fica "presa" por X minutos sem mexer naquele lead. É o **"freio de mão"**. | 30 | IA respeita mais o humano | IA pode atropelar o que você acabou de escrever |
| **Threshold de confiança** | Nota de 0 a 1. Só se a IA estiver MUITO certa (acima desse valor) ela sobrescreve um campo. | 0.7 | Mais conservador (preenche menos) | Mais agressivo (pode errar mais) |
| **Sobrescrever campos preenchidos** | Se ligado, IA pode trocar valor que já existia. Se desligado, só preenche o que está em branco. | Desligado | IA atualiza dados antigos | IA não toca em nada já preenchido |

### 4.2 Extrator de texto

| Campo | Significa | Padrão | Exemplo de gasto |
|---|---|---|---|
| **Mensagens por extração** | Quantas mensagens recentes a IA lê de uma vez por lead | 8 | — |
| **Extrações por lead / dia** | Máximo de vezes que cada lead pode ser reanalisado por dia | 3 | — |
| **Budget diário (chamadas)** | Total de chamadas que o Extractor pode fazer em 24h pra clínica inteira | 200 | 200 chamadas/dia ≈ **US$ 0,02** (gpt-5-nano é baratíssimo) |

### 4.3 Visão (comprovantes)

| Campo | Significa | Padrão | Custo aproximado |
|---|---|---|---|
| **Análises por lead (vida toda)** | Quantas imagens do mesmo lead a IA olha (evita ficar olhando o mesmo comprovante 10 vezes) | 3 | — |
| **Budget diário (imagens)** | Máximo de imagens que a IA analisa por dia | 50 | 50 imagens/dia ≈ **US$ 0,15** |

### 4.4 Áudio (Whisper)

| Campo | Significa | Padrão | Custo aproximado |
|---|---|---|---|
| **Budget diário (minutos)** | Total de minutos de áudio que o Whisper pode transcrever por dia | 60 min | 60 min/dia × US$ 0,006 ≈ **US$ 0,36** |

> 💡 **Resumindo o custo "padrão"**: rodando no padrão (sem mexer em nada), uma clínica média gasta entre **US$ 0,50 e US$ 2,00 por dia** na OpenAI. Ou seja, em torno de **R$ 50–100 por mês**. Se passar muito disso, é sinal de que o volume aumentou — aí vale revisar.

### 4.5 Escolha de modelo

| Robô | Modelo padrão | Quando trocar |
|---|---|---|
| Texto | `gpt-5-nano` | Use `gpt-5-mini` se sentir que a IA está errando muito na qualificação (mais caro, ~3x). |
| Visão | `gpt-5-mini` | Já é o melhor custo-benefício, **não mude** sem testar. |
| Áudio | `whisper-1` | Único modelo recomendado hoje. |

---

## 5. Regras automáticas do Kanban (Field-rules)

Aqui mora a parte mais legal: você **ensina o robô a mover os cards sozinho**. Tudo no card **Regras de campo → estágio** (mesma aba).

### 5.1 Anatomia de uma regra
Uma regra tem 3 partes:
1. **Nome** — apelido pra você lembrar (ex.: "Pagou → Agendamento").
2. **Etapa de destino** — pra qual coluna do Kanban o card vai.
3. **Condições** — uma lista de "se… e… e…". Todas precisam ser verdadeiras.

### 5.2 Exemplo passo a passo: "se pagou, manda pra Agendamento"
1. Em **Configurações → IA do Pipeline → Regras de campo**, clique **➕ Nova regra**.
2. Preencha:
   - **Nome**: `Pagou → Agendamento`
   - **Prioridade**: `10` (números maiores rodam primeiro)
   - **Etapa de destino**: escolha a coluna **Agendamento** do seu funil
3. Em **Condições**, cole/edite o JSON:
   ```json
   [
     { "field": "tentou_pagamento", "op": "is_true" }
   ]
   ```
4. Salve. Em até 2 min, qualquer lead cujo campo `tentou_pagamento` virar verdadeiro vai pular automaticamente pra coluna **Agendamento**.

### 5.3 Operadores em português

| Operador | Significa | Exemplo |
|---|---|---|
| `equals` | Igual a | `qualificacao` = `"interessado"` |
| `not_equals` | Diferente de | `qualificacao` ≠ `"desqualificado"` |
| `is_true` / `is_false` | É verdadeiro / falso | `tentou_pagamento` é verdadeiro |
| `is_empty` / `not_empty` | Está vazio / preenchido | `data_agendamento` está preenchido |
| `in` | Está na lista | `procedimento` em `["EMT","EMDR","Cetamina"]` |
| `contains` | Contém o texto | `observacao` contém `"urgente"` |
| `gte` / `lte` | Maior-igual / menor-igual (números) | `valor_proposto` ≥ `3000` |

### 5.4 Prioridade
Quando vários regras se aplicam ao mesmo lead, **vence a de maior `priority`**. Por isso eu sugiro:
- `100` → regras "fim de funil" (pagou, agendou).
- `50` → regras de meio (interessado, em negociação).
- `10` → regras de triagem básica.

### 5.5 Salvaguardas que a IA respeita sozinha
- **Lock manual ligado** → ela **não move** o card até o humano soltar o freio.
- Lead atualizado há mais de **24h** → não mexe (evita revolver histórico antigo).
- Se a regra mandar pra **mesma coluna em que o card já está** → ignora.
- Toda movimentação automática é **registrada no histórico do lead** com o motivo `field_rule:<nome da regra>`.

---

## 6. Como usar no dia a dia

### 6.1 Lendo um card do Kanban
Cada cartãozinho ganha **chips** (etiquetas pequenas) que a IA preenche:

| Chip | Significa |
|---|---|
| 🟢 **Interessado** | IA classificou o lead como interessado |
| 🟡 **Negociação** | Está discutindo preço/condições |
| 🔴 **Desqualif.** | IA achou que não fecha (lead frio, errou de clínica…) |
| 💰 **Pago** | Comprovante reconhecido e validado |
| 🧾 **Comprovante** | Chegou imagem, mas IA não conseguiu validar (revisar manual) |
| 📅 **Data: 18/06** | Encontrou data de agendamento na conversa |
| ⏳ **IA na fila** | Esse lead está aguardando o próximo ciclo de extração |
| 🔒 **Lock manual** | Humano respondeu há pouco — IA não vai mexer |
| 🏷️ **EMT** / **EMDR** / **Cetamina** | Procedimento que disparou interesse |

### 6.2 Quando a IA pausa sozinha
**Sempre que você (ou alguém da equipe) responde manualmente** no chat de um lead, a IA entra em **lock manual** por 30 min (valor padrão). Isso evita que ela atropele algo que você acabou de escrever. Acabou o tempo, volta a trabalhar.

### 6.3 Forçar reprocessar um lead
Abra o **Lead Drawer** (clique no card) → role até **Ações IA** → **Reanalisar agora**. Útil quando o lead manda algo importante e você não quer esperar o próximo ciclo.

---

## 7. Como monitorar

Tudo num só lugar: card **Histórico & custos** em **Configurações → IA do Pipeline**.

### 7.1 Painel superior
| Indicador | O que mostra |
|---|---|
| **Execuções (24h)** | Quantas chamadas a IA fez hoje |
| **Custo total (24h)** | Quanto gastou em US$ no dia |
| **Ignorados** | Quantos leads ela pulou por causa de lock/budget |
| **Erros** | Chamadas que falharam (chave inválida, timeout…) |

### 7.2 Tabela diária
Lista dos últimos 14 dias com colunas: **data · execuções · custo · erros**. Bom pra acompanhar tendência (se o custo dobrou de uma semana pra outra, alguma coisa mudou).

### 7.3 Log das últimas 100 execuções
Cada linha: **lead · tipo (texto/visão/áudio) · campos preenchidos · custo · tempo · status**. Clique numa linha pra ver detalhes.

### 7.4 Botões manuais
| Botão | Quando usar |
|---|---|
| **Rodar texto** | Disparar o Extractor agora (não esperar 2 min) |
| **Rodar visão** | Forçar análise de comprovantes pendentes |
| **Rodar áudio** | Forçar transcrição de áudios pendentes |
| **Rodar regras agora** | Forçar a varredura de field-rules |

> 💡 **Use estes botões pra debugar**: se você acha que "a IA não está fazendo nada", clique em **Rodar texto** e veja o resultado em segundos. Se rodou e não preencheu nada, é sinal de que **não há leads na fila** (nenhuma mensagem nova com texto interessante).

### 7.5 Logs técnicos (avançado)
Se precisar pedir ajuda ao suporte com uma falha específica, vá em **Cloud → Edge Functions** e abra o log de `extractor-tick`, `vision-tick`, `audio-tick` ou `field-rules-tick`. Copie o erro e mande pra equipe.

---

## 8. Resolução de problemas (FAQ rápido)

### "Aparece **Chave inválida** mesmo eu tendo colado"
- Confira se a chave começa com `sk-` e tem 50+ caracteres.
- Vá na OpenAI, gere uma nova chave, cole de novo.
- Verifique se sua conta da OpenAI **tem saldo** (`Billing → Add to credit balance`).

### "**Orçamento diário esgotado** — o que fazer?"
- Ou aumente o **Budget diário** no card de Limites (e confirme que sua OpenAI tem saldo).
- Ou espere a virada da meia-noite (UTC) — o contador reseta sozinho.

### "Comprovante chegou mas não marcou como pago"
- Olhe o card do lead: se o chip é **🧾 Comprovante** (e não **💰 Pago**), é porque a IA **não conseguiu validar** (foto borrada, recortada, em ângulo difícil).
- Vai aparecer também uma tarefa de revisão humana. Abra, confirme o valor e marque manualmente.
- Quando isso acontece sempre com o mesmo banco, conta pra gente — a gente melhora o prompt.

### "Card não moveu sozinho"
Checklist na ordem:
1. A regra está **ativada** (`enabled = true`)?
2. As condições estão **todas verdadeiras** ao mesmo tempo? (lembra: é E, não OU)
3. O lead está em **lock manual** (chip 🔒 no card)?
4. O lead foi atualizado nas **últimas 24h**? Mais antigo do que isso, field-rules ignora.
5. A regra tem **maior prioridade** que outra que esteja levando pra outra coluna?

### "IA tá muito agressiva, preenchendo errado"
- Suba o **threshold de confiança** de `0.7` pra `0.85`.
- Desligue **Sobrescrever campos preenchidos**.
- Reduza **Mensagens por extração** de `8` pra `4` (lê menos contexto = decide menos).

### "Conta da OpenAI explodiu de gasto"
- Vá em **Limites & budgets** e abaixe o **Budget diário** dos 3 robôs pela metade.
- Verifique se alguém importou **milhares de leads de uma vez** (cada lead novo entra na fila).
- Em último caso: troque sua chave por uma nova com **hard limit mensal** configurado direto na OpenAI.

---

## 9. Glossário leigo

| Palavra | Tradução |
|---|---|
| **BYOK** | "Bring Your Own Key". Você usa a sua chave da OpenAI, a clínica paga direto pra OpenAI o que consumiu. |
| **Cron** | Relógio automático que dispara os robôs em intervalos fixos (a cada 2 min, 3 min, 5 min). |
| **Tokens** | Pedacinhos de palavra que a IA cobra por uso. Quanto mais texto, mais tokens, mais centavos. |
| **Custo USD** | Valor em dólares cobrado pela OpenAI por chamada. Mostrado direto no painel. |
| **Lock manual** | "Freio de mão". Janela em que a IA não mexe num lead porque um humano acabou de responder. |
| **Custom fields** | Campos personalizados do lead (qualificação, procedimento, tentou_pagamento…). É o "caderninho" que a IA preenche. |
| **Edge function** | Programinha que roda no servidor (cada robô é uma edge function). Você não precisa abrir. |
| **Stage / Etapa** | Coluna do Kanban (Novo lead, Interessado, Negociação, Agendado…). |
| **Threshold** | Limite mínimo de confiança pra IA tomar uma ação. Vai de 0 a 1. |

---

## 10. Checklist de implantação

Marque conforme for fazendo:

- [ ] Criei conta na OpenAI e adicionei **US$ 10** de saldo.
- [ ] Gerei uma chave `sk-...` e cadastrei em **Configurações → IA do Pipeline**.
- [ ] Cliquei em **Validar chave** e apareceu ✅.
- [ ] Mandei uma mensagem-teste do meu WhatsApp e em 2 min o card foi atualizado.
- [ ] Revisei (ou aceitei os padrões de) **Limites & budgets**.
- [ ] Criei pelo menos **1 regra de Kanban** (ex.: "Pagou → Agendamento").
- [ ] Mostrei pra equipe da recepção o que cada **chip do card** significa.
- [ ] Combinei com a equipe: **quando ver chip 🧾 Comprovante**, revisar manualmente.
- [ ] Abri o card **Histórico & custos** e entendi onde olhar gasto e erro.
- [ ] Salvei o link deste manual em algum lugar fácil de achar.

> 🎉 **Pronto!** A partir daqui, a IA cuida da parte chata e você foca em fechar tratamento. Em caso de dúvida, volte aqui — este manual é a fonte oficial.

---

## Relacionado
- Página de Configurações: `pages/settings.md`
- Página do Kanban: `pages/kanban.md`
- Roadmap técnico (pra desenvolvedor): `docs/roadmap/CLINIC_PIPELINE.md`
