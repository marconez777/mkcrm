# Auditoria lead-a-lead do pipeline + comportamento da IA

## Objetivo
Ler cada lead "ativo" do funil, conferir se a coluna atual bate com a conversa, ler notas internas e ações da IA (extractor + field-rules), e diagnosticar onde a IA acertou/errou. Salvar tudo em `docs/roadmap/AUDIT_EXTRACTOR_PIPELINE.md` em fases (o arquivo cresce em cada fase, não recomeça).

## Escopo
~155 leads em 14 colunas ativas. Ficam de fora as 4 colunas-depósito (Nutrição/Paciente antigo/Administrativo/Não respondeu) — vão entrar só por amostragem (5 leads cada) pra checar se algum lead "vivo" caiu lá por engano.

## Definição de cada coluna (fonte da verdade)
Construo na Fase 0, baseada nas suas mensagens anteriores + nas regras de pipeline + nomes:

| Coluna | O que deve estar aqui |
|---|---|
| Contato inicial | Lead novo, sem qualificação clara ainda |
| Qualificação | Lead respondendo, interesse genuíno, sem agendamento |
| Fechamento pendente consulta | Negociou data/valor, falta confirmar consulta |
| Consulta Agendada | Consulta marcada com data futura |
| Consulta finalizada | Consulta já aconteceu, aguarda próxima ação |
| reuniao agendada | (médico parceiro/admin — confirmar com você) |
| Fechamento pendente procedimento | Negociando próxima sessão de cetamina/EMT |
| Procedimento Agendado | Sessão futura confirmada |
| Procedimento pago | Pagamento confirmado pelo atendente |
| Retorno Tratamento Finalizado | Pós-tratamento, candidato a retorno |
| Lead não qualificado | Pediu serviço não oferecido (EMDR etc.) ou recusou |
| lead parou de responder | >X dias sem resposta após qualificação |
| Negou parceria | (parceiro médico, não paciente) |
| Antigo Consulta/proc agendado | Legado da migração — flagrar pra limpar |

Onde a definição não for óbvia, marco `❓ confirmar com cliente` em vez de chutar.

## Fases (cada uma vira uma seção nova no MD)

### Fase 0 — Base do documento
- Frontmatter + objetivo do robô + prompt atual + 7 regras + estatísticas 30d (auditoria que rascunhei na resposta anterior). Sem leitura de leads ainda.

### Fase 1 — Coluna "Qualificação" (22 leads)
Pra cada lead: nome, últimas ~12 mensagens resumidas em 2 linhas, custom_fields, últimas 3 runs da IA (confidence + fields_set + erro), histórico de stage, veredito **✅ correta / ⚠️ deveria estar em X / ❌ IA errou — motivo**.

### Fase 2 — "Consulta Agendada" (18) + "Procedimento Agendado" (8) + "reuniao agendada" (7) = 33
Foco: a data está realmente futura? IA preencheu sozinha ou foi manual? `consulta_agendada_em` vs `procedimento_agendado_em` corretos?

### Fase 3 — Funis de fechamento: "Fechamento pendente consulta" (14) + "Fechamento pendente procedimento" (5) + "Procedimento pago" (25) = 44
Foco: tem mesmo negociação ativa? `pagamento_confirmado` foi setado por confirmação real do atendente ou pelo lead enviando comprovante?

### Fase 4 — Pós-atendimento: "Consulta finalizada" (17) + "Retorno Tratamento Finalizado" (10) + "Antigo Consulta/proc agendado" (6) + "lead parou de responder" (6) = 39
Foco: regras de tempo poderiam ter movido sozinho? Tem stages órfãos sendo usados manualmente?

### Fase 5 — Resíduos: "Contato inicial" (9) + "Lead não qualificado" (6) + "Negou parceria" (2) + amostra 5 de cada coluna-depósito = ~37
Foco: a desqualificação foi por motivo válido (EMDR, fora da geografia, etc.) ou IA chutou?

### Fase 6 — Síntese final
- Matriz **stage_atual × stage_esperado** (taxa de acerto da IA por coluna).
- Top 10 padrões de erro recorrentes da IA (com lead_id pra você reproduzir).
- Mapeamento erro→fix (cada erro aponta pra item do roadmap da Fase 0).
- Lista de leads que precisam intervenção manual urgente.

## Como cada fase é executada
1. SQL: pega lead_id, custom_fields, stage atual, último stage_history, último extraction_run.
2. SQL: pega últimas 12 messages (content, from_me, transcript, created_at).
3. SQL: pega lead_internal_notes.
4. Para cada lead, julgo em 2-4 linhas no MD.
5. Ao fim da fase, append no MD + `git`-style summary no chat ("Fase X concluída: N leads, M divergências").

## O que NÃO faço nesta task
- Não movo lead nenhum.
- Não mudo prompt nem regras.
- Não altero código de edge function.
Apenas leio e relato. Build de correções fica pra depois, com base nos achados.

## Tamanho esperado
~155 leads × ~6 linhas cada = ~900 linhas de auditoria + estatística. MD final ~30-40 KB. Cabe folgado num arquivo só, mas as seções por fase deixam navegável.

## Confirmar antes de começar
1. **Tudo bem auditar ~155 leads de uma vez** (vai consumir tempo de execução e tokens de leitura de mensagens)? Ou prefere começar só pela Fase 1 e parar pra revisar?
2. As **definições de coluna** acima batem com o que você espera? Marquei `reuniao agendada` e `Negou parceria` como dúvidas — quer descrever?
3. **Período**: leads ativos *hoje* (qualquer data de criação) ou só leads movimentados nos últimos 30/60 dias?