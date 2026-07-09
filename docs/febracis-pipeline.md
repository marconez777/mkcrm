# Pipeline Febracis — Definição do Fluxo

Este documento mapeia o comportamento do agente e os gatilhos do pipeline de vendas de eventos/cursos da Febracis. O fluxo é construído para ser objetivo, priorizando gatilhos transacionais (Stripe) e gatilhos temporais, com a IA atuando na detecção básica de intenções para facilitar o trabalho dos vendedores.

## 1. Arquitetura e Papel do Agente (Importante)

- **Observador Silencioso:** O Agente de Pipeline **NÃO envia mensagens** para os leads. Seu papel é estritamente de *leitura e classificação*. Ele analisa a conversa (gerada pela secretária humana ou por um Agente de Atendimento separado) e atua nos bastidores apenas movendo os cards entre as colunas do Kanban.
- **Serviço Exclusivo do CRM:** O treinamento (prompt, regras e lógica de decisão) é *"hardcoded"* no código fonte do projeto. O cliente não tem acesso para editar ou adulterar as regras de movimentação. Pela UI (em configurações > IA do Pipeline), o cliente configura apenas a ativação e, eventualmente, sua própria chave de API (OpenAI/Gemini).

---

## 2. Estágios (Colunas do Kanban)

1. **Novo:** Entrada do lead.
2. **Qualificação:** Lead já em atendimento pela IA, tirando dúvidas comuns (ex: valor).
3. **Comprando:** Lead demonstrou intenção clara de compra (pediu link, confirmou que vai comprar).
4. **Comprou:** O pagamento foi confirmado via Stripe.
5. **Parou de responder:** Lead sumiu por 2 dias.
6. **Não Qualificado:** Lead sem perfil, sem dinheiro ou sem interesse.
7. **Administrativo:** Demandas de suporte, financeiras ou parcerias.

---

## 2. Regras de Movimentação (Gatilhos e IA)

O pipeline divide as responsabilidades entre **Automações de Sistema (Rule Engine)** e o **Classificador de IA**.

### Automações de Sistema (Determinísticas)
*Não dependem de interpretação de texto, são exatas.*

- **[Gatilho de Interação] Novo → Qualificação:** 
  Assim que o lead entra no estágio `Novo` e recebe a primeira resposta (da IA ou humana), o sistema move o lead automaticamente para `Qualificação`.
- **[Gatilho Transacional] Qualquer coluna → Comprou:** 
  Integração direta com o webhook da Stripe. Quando a Stripe confirmar o pagamento de um ingresso/curso atrelado àquele contato, o sistema move o card automaticamente para a coluna `Comprou`.
- **[Gatilho Temporal] Qualquer coluna (exceto finais) → Parou de responder:** 
  Se a última mensagem do lead tiver passado de 48 horas (2 dias) sem novas interações inbound, um script cron move o card para `Parou de responder`.

### Movimentações por Inteligência Artificial (Classificador)
*A IA analisa o contexto da conversa e sugere a movimentação para organizar a fila dos vendedores.*

- **Movimentação para `Comprando` (Intenção de Compra Alta):**
  - **Condição:** O lead pede ativamente o link de pagamento, pergunta as formas de pagamento para fechar agora, ou usa palavras que demonstrem que a decisão está tomada.
  - **Nota:** Como o usuário ressaltou, a precisão aqui não precisa ser cirúrgica. É um estágio de alerta para os vendedores "ficarem em cima" e fazerem follow-up agressivo.
- **Movimentação para `Não Qualificado` (Descarte):**
  - **Condição:** O lead afirma não ter dinheiro, acha caro demais e não vai comprar, diz expressamente que não gostou do evento ou não quer ir.
- **Movimentação para `Administrativo` (Suporte / B2B):**
  - **Condição:** O contato fala sobre problemas técnicos, pede estorno/reembolso, solicita emissão de nota fiscal, cobranças, ou se identifica como parceiro/fornecedor.

---

## 3. Comportamento do Agente de IA

Diferente do pipeline clínico que requer cuidado extremo (como bloqueios médicos), o agente Febracis foca em conversão e velocidade:

- **Resposta Imediata:** No estágio `Novo`/`Qualificação`, o agente já é treinado para quebrar objeções de valor e informar os dados do evento.
- **Detector de Intenção:** O principal papel do agente não é alterar campos customizados complexos, mas sim emitir corretamente a intenção (ex: `intent = "quer_comprar"`, `intent = "sem_dinheiro"`, `intent = "suporte_admin"`) que fará o motor mover o card para a coluna correspondente.

---

## 4. Arquitetura de Micro-Agentes e Custos (Treinamento)

Como a operação escolar tem um volume alto de mensagens e regras mais simples que a área da saúde, **o custo é o fator principal**. Em vez de usar um modelo caro (Maestro) e 5 agentes como na ÓR, o classificador da Febracis usará uma esteira enxuta de apenas **2 micro-agentes**, chamando modelos ultra-baratos e rápidos (ex: `gemini-2.5-flash-lite` ou `gpt-5-nano`).

O movimento do card **NÃO** é feito pela IA. O movimento é feito via código baseando-se na intenção que os agentes detectam.

### 4.1 Linha de Montagem de Baixo Custo e Resumo Incremental

O grande vilão de custo em agentes de pipeline é o modelo re-ler o histórico inteiro a cada nova mensagem. Para evitar isso, a Febracis usará a estratégia de **Resumo Incremental (Rolling Summary)** auxiliado por uma marca d'água (watermark) no banco de dados.

**Etapa 1: Agente Resumidor Incremental (Flash-Lite)**
- **A Lógica:** O banco de dados armazena um `ai_summary` (o resumo até o momento) e o ID da última mensagem lida (`last_processed_message_id`). Quando o pipeline roda, ele **NÃO** puxa o histórico. Ele puxa apenas as mensagens virgens (que chegaram depois da marca d'água).
- **Função:** Ler o `ai_summary` antigo + as `Novas Mensagens` e gerar um novo parágrafo atualizado.
- **Output:** Apenas texto (o Novo Resumo).
- **Vantagem:** O custo de input (tokens lidos) passa a ser **O(1)** (constante) e não O(N) crescente. O agente sempre vai ler no máximo ~800 caracteres do resumo + as 2 ou 3 mensagens novas, mantendo a requisição extremamente barata, independentemente se o lead tem 2 ou 2.000 mensagens no histórico.

**Etapa 2: Agente Tipificador de Intenção (Flash-Lite)**
- **Função:** Ler APENAS o resumo novo gerado pela Etapa 1 e classificar a intenção e aplicar chips (tags).
- **Output (Zod Schema):**
```typescript
z.object({
  intent: z.enum(["quer_comprar", "nao_qualificado", "suporte_admin", "outro"]),
  tags_suggested: z.array(z.string()).max(2) // Ex: "aluno_antigo", "reclamacao"
})
```

### 4.2 System Prompt (Agente Tipificador)

```text
Você é um Classificador de Intenção de Baixo Custo para a Febracis.
Leia o resumo da conversa e defina a INTENÇÃO atual do lead. 

Regras de Classificação (intent):
1. "quer_comprar": O lead pediu chave PIX, link de pagamento, opções de parcelamento ou disse frases fortes como "Vou comprar", "Eu quero ir no evento".
2. "nao_qualificado": O lead disse expressamente que NÃO vai ao evento, está sem dinheiro, acha caro ou não tem interesse. 
3. "suporte_admin": O lead é parceiro, fornecedor, pede reembolso, nota fiscal ou relata problemas sistêmicos.
4. "outro": O lead fez perguntas comuns sobre o evento (local, data, preço) ou interagiu sem sinalizar decisão clara.

Não justifique sua resposta. Apenas retorne o JSON estrito.
```

### 4.3 Motor de Movimentação (Código / Custo Zero)
No código (ex: `apply.ts`), consumimos o JSON barato da Etapa 2. Nenhum LLM é chamado aqui:
- `intent === 'quer_comprar'` → O código move para coluna `Comprando`
- `intent === 'nao_qualificado'` → O código move para coluna `Não Qualificado`
- `intent === 'suporte_admin'` → O código move para coluna `Administrativo`
- `intent === 'outro'` → O código move para coluna `Qualificação` (ou mantém onde está)

### 4.4 Telemetria (Custos de IA)
Essa execução gravará apenas duas linhas na tabela `ai_usage` por requisição:
1. `classifier:febracis_resumidor` (com o custo e latência do modelo nano)
2. `classifier:febracis_tipificador` (com o custo e latência do modelo nano)

Isso garante rastreabilidade precisa e isolada no painel financeiro do CRM, mantendo o custo na casa dos centavos por milhares de execuções.

