## Objetivo

Gerar um estudo profundo das conversas da clínica **ÓR** (pipeline "Agendamentos Novo") para alimentar o treino do agente de pipeline (extractor / automation) e do futuro agente de atendimento. Cada coluna do Kanban vira um documento próprio com transcrições, sínteses, padrões e recomendações.

## Escopo confirmado

- Clínica: **ÓR** (`cf038458-457d-4c1a-9ac4-c88c3c8353a1`)
- Pipeline: **Agendamentos Novo** (16 colunas, 1.619 leads, 13.262 mensagens, 820 áudios, 464 leads com conversa)
- Janela: **todos os leads, sem corte de data**
- Áudios: **transcrever todos** com Gemini multimodal via Lovable AI
- Entregável: **`docs/estudo/` (índice + 1 arquivo por coluna)** + `docs/estudo-geral.md` como hub

## Estrutura de arquivos

```text
docs/
├── estudo-geral.md                    ← hub: visão consolidada, padrões cross-coluna, recomendações
└── estudo/
    ├── README.md                       ← índice + metodologia + glossário
    ├── 00-leads-de-entrada.md
    ├── 01-paciente-antigo.md
    ├── 02-qualificacao.md
    ├── 03-consulta-agendada.md
    ├── 05-consulta-finalizada.md
    ├── 06-fechamento-pendente-consulta.md
    ├── 07-lead-parou-de-responder.md
    ├── 08-lead-nao-qualificado.md
    ├── 09-fechamento-pendente-procedimento.md
    ├── 10-procedimento-agendado.md
    ├── 11-procedimento-pago.md
    ├── 12-retorno-tratamento-finalizado.md
    ├── 13-antigo-consulta-procedimento-agendado.md
    ├── 14-nutricao-leads-inativos.md
    └── 15-administrativo.md
```

## Conteúdo de cada arquivo por coluna

1. **Metadados**: stage_id, posição, contagem de leads, distribuição temporal, taxa de conversão para a próxima coluna.
2. **Lista completa de leads** com: nome, telefone, data de entrada na coluna, qtd de mensagens, status_consulta, motivo_desqualificacao, profissional, procedimento, teleconsulta sim/não.
3. **Transcrição + síntese individual** para cada lead com mais de 3 mensagens. Estrutura:
   - Cabeçalho: dados do lead + custom_fields relevantes.
   - Transcrição cronológica (mensagens textuais + áudios transcritos com marcador `[ÁUDIO]`).
   - Síntese em 4-6 linhas: o que o lead queria, objeções, decisão, resultado.
   - Sinais detectados: gatilhos de interesse, gatilhos de objeção, pedido de remarcação, menção a preço, menção a concorrente, telecon vs presencial, psicólogo vs psiquiatra.
4. **Síntese da coluna**: o que define um lead "típico" dessa coluna, perfil demográfico, principais procedimentos/profissionais.
5. **Padrões identificados**: top 10 padrões linguísticos/comportamentais (ex.: "lead pergunta preço antes de mostrar problema = alta chance de não fechar").
6. **Erros do agente IA atual** que apareceram nas conversas (campo errado, mensagem fora de contexto, falha em detectar reagendamento, etc.).
7. **Recomendações para o agente de pipeline** (regras de extração, novos campos a capturar, ajustes em B-rules).
8. **Recomendações para o agente de atendimento** (scripts, tom, perguntas-chave, gatilhos de handoff).

## Conteúdo do `estudo-geral.md`

- Resumo executivo da clínica (volume, conversão funil, principais procedimentos, profissionais mais procurados).
- Mapa de jornada: como os leads transitam entre colunas (Sankey textual).
- **Cenários canônicos** (cada um com 3-5 exemplos reais):
  - Agendou consulta na primeira mensagem
  - Agendou só após objeção (preço / horário / dúvida sobre profissional)
  - Agendou consulta + procedimento juntos
  - Agendou consulta com psicólogo
  - Agendou consulta com psiquiatra
  - Reagendamento implícito (caso Ana Paula)
  - Pediu fora do escopo (EMDR, atendimento fora do país)
  - Paciente antigo voltando
  - Lead sumiu após cotação
  - Lead administrativo (parceria, fornecedor, currículo)
  - Teleconsulta vs presencial
- Padrões transversais que aparecem em várias colunas.
- Recomendações priorizadas (P0/P1/P2) para evoluir o extractor (`extractor-tick`) e desenhar o agente de atendimento.
- Glossário de termos da ÓR (siglas, nomes de profissionais, procedimentos).

## Como o estudo será produzido (técnico)

Script Python rodando no sandbox (`/tmp/estudo_or.py`) que:

1. Lê via `psql` (acesso já habilitado) os leads + custom_fields + stage_id + mensagens (ordenadas, com `media_url`, `media_mime`, `from_me`, `bot_agent_id`, `timestamp`).
2. Para cada mensagem `audio/*`, baixa o `media_url` e envia para `google/gemini-3-flash-preview` via Lovable AI Gateway (multimodal `input_audio`) — usa skill `ai-gateway` (`/tmp/lovable_ai.py`) ou chamada direta `requests`. Cache em `/tmp/audio-cache/<msg_id>.txt` para idempotência.
3. Para cada lead com ≥3 mensagens, chama Gemini com o transcript completo + custom_fields atuais e pede saída JSON estruturada: `{ sintese, objecoes[], gatilhos[], procedimento, profissional, teleconsulta, reagendamento, erros_ia_detectados[], recomendacoes_pipeline[], recomendacoes_atendimento[] }`. Cache por `lead_id+last_message_at`.
4. Agrega por coluna e roda Gemini novamente para destilar os padrões da coluna.
5. Renderiza markdown obedecendo a estrutura acima e grava em `docs/estudo/*.md` + `docs/estudo-geral.md`.
6. No fim, roda `node scripts/docs-sync.mjs` para atualizar `docs/INDEX.json` (skill docs-maintainer).

## Custo, tempo e risco

- ~820 áudios × ~5s cada de Gemini Flash multimodal + ~464 leads × 1 chamada de síntese + 16 chamadas de coluna + 1 chamada do hub ≈ **~1.300 chamadas** ao Gateway. Em Gemini Flash isso é viável mas consome créditos consideráveis — vou logar custo por etapa e parar/avisar se passar de um limite que você definir (default: aviso a cada 500 chamadas).
- Tempo estimado: 30-60 min de execução, dependendo de tamanho dos áudios.
- O script é idempotente (cache por message_id e lead_id) — se cair no meio, retoma.
- Documentos podem ficar grandes (esperado ~80-150 KB por coluna grande, ~500 KB no total). Aceitável; o `docs/INDEX.json` lida com isso.

## Validação final

- `node scripts/docs-sync.mjs` sem erros.
- Sanity-check manual: 3 leads que eu sei o desfecho (incluindo Ana Paula em "Consulta Agendada") aparecem com síntese coerente e o reagendamento implícito é detectado.
- Sumário no chat com: total de leads processados, total de áudios transcritos, total de tokens/custo gasto, link para `docs/estudo-geral.md`.

## O que NÃO faz parte deste plano

- Não altera código de produção (extractor, agentes, prompts).
- Não cria migrations nem mexe em dados de leads.
- Não envia mensagens para leads.
- Recomendações são geradas como texto no estudo; a implementação delas vira plano separado depois que você revisar.
