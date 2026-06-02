# Construtor de Agentes guiado por IA (v3)

Aprovado para começar pela Fase 1. Esta versão incorpora 5 requisitos transversais (A-E) que valem para **todas** as fases.

---

## Decisões fechadas (mantidas da v2)

| Tópico | Decisão |
|---|---|
| Escopo do Builder | 1 por clinic, usa API key do próprio cliente |
| Modelo default | `openai/gpt-4o-mini` |
| UI do wizard | Rota dedicada `/ai/agents/new` |
| Entrevista | 4-5 perguntas, formulário único (não chat) |
| Modo Leigo | 1 slider único (modelo); demais settings em defaults fixos ocultos |
| Vínculo roadmap | Fase 6 = R-21; Fase 4 cobre parte do R-11 |

---

## Requisitos transversais (NOVOS, valem para todas as fases)

### D. Princípio multi-nicho explícito (governa tudo)

Foco inicial é clínicas, mas a ferramenta atende vários nichos. Portanto:

- **Nenhuma copy, exemplo, tooltip ou label do wizard pode assumir que o cliente é clínica.** Linguagem neutra: "seu negócio", "seus clientes", "seu produto/serviço". Proibido: "paciente", "consulta", "Dr.", "clínica" fora do branch específico do nicho clínica.
- Todos os system prompts gerados, cenários de teste, perguntas da entrevista e exemplos de tools se adaptam ao nicho escolhido na Etapa 1.
- A base de conhecimento padrão (item C) é neutra a nicho.
- Regra de revisão: antes de fechar qualquer PR de Fase 2+, fazer um grep por `clínica|paciente|consulta|Dr\.|médic` em código novo do wizard e confirmar que só aparece dentro de `if (niche === 'clinic')`.

### A. Regra obrigatória nos prompts gerados — usar contexto do lead

O `system_prompt` fixo do Builder (versionado em arquivo) inclui esta diretriz, que **toda saída** de `generate_system_prompt` deve conter literal no prompt gerado:

> **Use o contexto do lead antes de perguntar qualquer coisa.** Antes de fazer qualquer pergunta, verifique o que já está no contexto: nome, telefone, campos personalizados, histórico da conversa. Só pergunte o que estiver vazio. Se o nome já estiver preenchido, cumprimente pelo nome — nunca pergunte "qual é seu nome?". Se um campo personalizado já contém a informação, use-a em vez de perguntar de novo. Se o histórico mostra que o lead já disse algo, não peça de novo.

O `ai-chat` já injeta esses dados; só precisamos garantir que o prompt aproveite. Validado por um eval automático ("Builder verifica que o prompt gerado contém a cláusula de contexto" → falha bloqueia a etapa 5).

### B. Entrevista captura a oferta dominante do negócio (adaptada por nicho)

A action `interview_plan` retorna um plano de 3-5 perguntas com **pelo menos uma pergunta obrigatória de "oferta dominante"**, variando por nicho. O objetivo é gerar prompts que já oferecem o caminho mais comum em vez de perguntar genérico.

| Nicho | Pergunta de oferta dominante | Impacto no prompt |
|---|---|---|
| Clínica | "Qual profissional/especialidade é o principal?" | "Quer agendar com o {Dr.X}?" em vez de "qual especialidade?" |
| Imobiliária | "Locação, venda ou ambos? Bairros prioritários?" | Direciona logo de cara |
| Restaurante | (oferta fixa = reserva) "Capacidade média e horários?" | Já pergunta data e nº de pessoas |
| E-commerce | "Categoria/produto carro-chefe?" | Recomenda primeiro |
| SaaS B2B | "Plano de entrada e ICP?" | Qualifica para o plano correto |
| Advocacia | "Área de atuação principal?" | Triagem direto pela área |
| Educação | "Curso/turma com mais demanda?" | Oferece esse curso primeiro |
| Estética | "Procedimento mais procurado?" | Oferece esse procedimento |
| Odonto | "Especialidade principal?" | Mesmo padrão de clínica |
| Agência | "Serviço de entrada?" | Recomenda o serviço de entrada |
| Serviços locais | "Serviço mais pedido + região de atendimento?" | Filtra por região |
| Outro | "Qual é a oferta principal que você mais vende?" | Texto livre vira "caminho default" no prompt |

`generate_system_prompt` injeta essa resposta como **caminho default** do agente; outras ofertas viram **fallback** se o lead recusar.

### C. Base de conhecimento em camadas (padrão + usuário)

- Conjunto de documentos padrão genéricos, neutros a nicho, pré-carregados em todo agente novo:
  - Script de abertura/saudação
  - Script de qualificação básico (descobrir necessidade, urgência, decisor)
  - Script de agendamento/conversão (oferecer, confirmar, enviar resumo)
  - Como lidar com objeções comuns (preço, tempo, "vou pensar")
  - Como escalar para humano (gatilhos e fraseado)
  - Boas práticas de tom e tempo de resposta
- Marcados como `source = 'system_default'` em `ai_documents` (campo já existente ou novo enum).
- Aparecem na lista de KB desde o primeiro login do agente — **mesma interface**, sem aba separada. Badge sutil "padrão" do lado.
- Usuário pode editar ou excluir qualquer um, inclusive os padrão (sem confirmação especial).
- Backfill na Fase 1: clinics existentes recebem os documentos padrão por agente já existente que não tem nenhum doc. Trigger no `INSERT` de `ai_agents` provisiona daqui pra frente.
- Por enquanto **uma única base genérica** — versões por nicho ficam para depois.

### E. Manual de boas práticas = cérebro do Builder, **não** KB de agente

O manual de boas práticas que o usuário vai fornecer:

- **NÃO** entra em `ai_documents` de nenhum agente final. Proibido.
- Vai para `supabase/functions/_shared/builder-knowledge/best-practices.md` (arquivo versionado em git).
- O `ai-builder` carrega esse arquivo e o concatena ao `system_prompt` fixo do Builder.
- Trechos curtos viram tooltips "Por que isso importa?" em cada etapa do wizard (`src/lib/builder-tooltips.ts` extrai seções por anchor `## tooltip:nome`).

A KB padrão do item C é **diferente**: aquela é escrita como script neutro para o agente final responder cliente. O manual é meta-instrução para o Builder construir bem.

---

## Visão geral do fluxo (mantida)

```text
/ai/agents → "Criar com assistente" → /ai/agents/new
   1. Nicho                   (11 cards + "Outro")
   2. Objetivo                (SDR, classificador, suporte, agendador, custom)
   3. Provedor & API key      (Testar conexão obrigatório)
   4. Entrevista enxuta       (3-5 perguntas; 1 obrigatória = oferta dominante)
   5. Prompt gerado           (com cláusula de contexto do lead embutida)
   6. KB                      (padrão já listada + URLs do site + PDFs + texto)
   7. Configurações           (Leigo: 1 slider | Técnico: tudo)
   8. Test Lab                (chat livre + cenários adaptados ao nicho + evals)
   9. Ativação                (checklist + opcional rodar em leads ativos)
```

---

## Fase 1 — Builder + setup robusto + KB padrão + manual

**Backend / DB:**
- Índice único parcial em `ai_agents` para 1 Builder por clinic (`system_key = 'builder'`).
- Backfill: 1 Builder `enabled=false`, `is_system=true` para cada clinic existente.
- Trigger em criação de clinic para provisionar Builder + documentos KB padrão para qualquer agente novo da clinic.
- `ai_documents`: adicionar coluna `source_type text default 'user'` aceitando `'user' | 'system_default' | 'url' | 'pdf' | 'text'`. Backfill `'user'` para os existentes. Backfill dos 6 documentos padrão para todos os agentes ativos atuais.

**Arquivos novos:**
- `supabase/functions/_shared/builder-knowledge/best-practices.md` — vazio agora, será preenchido com o manual quando o usuário enviar.
- `supabase/functions/_shared/builder-knowledge/kb-defaults/*.md` — 6 arquivos com os scripts neutros.
- `supabase/functions/_shared/builder-system-prompt.ts` — exporta o prompt fixo do Builder, que concatena `best-practices.md` em runtime e contém as cláusulas A (regra de contexto) e D (multi-nicho).

**Edge function nova `ai-builder/`:**
- `{ action, payload }` genérico. Actions desta fase:
  - `ping` — smoke test de conectividade contra a API key.
  - `generate_system_prompt` — stub que já injeta cláusulas A e B; será refinado na Fase 3.
- Erros do provedor traduzidos em PT-BR (`parseProviderError`).

**Frontend (`Agents.tsx`):**
- Setup card destacado do Builder com estados 🔴/🟡/🟢/🔴-erro.
- Botão **"Testar conexão" obrigatório** antes do Builder ser considerado operacional (`builder_verified_at`).
- Lista de KB de cada agente já mostra os documentos padrão com badge "padrão".

**Módulo transversal:**
- `src/lib/builder-errors.ts` + `<ProviderErrorBanner />` reutilizável.

---

## Fase 2 — Rota `/ai/agents/new` + etapas 1-3

(Mantida da v2)

- Tabela `ai_agent_drafts` (1 draft por user por clinic).
- Stepper, layout estilo `Onboarding.tsx`, retomar draft.
- Etapa 1 = 11 nichos + "Outro". Etapa 2 = objetivo. Etapa 3 = provedor + key + **Testar conexão obrigatório**.
- Tooltips "Por que isso importa?" extraídos do manual (item E).
- **Lint multi-nicho** (item D) em toda copy nova.

---

## Fase 3 — Entrevista + geração de prompt com contexto e oferta

- `interview_plan` retorna 3-5 perguntas por `{niche, goal}`, **com 1 pergunta obrigatória de oferta dominante** conforme tabela do item B.
- UI: formulário único (todas as perguntas visíveis), não chat sequencial. Botão "Pular tudo".
- `generate_system_prompt` produz:
  ```ts
  { system_prompt, suggested_tools, suggested_temperature, suggested_top_k,
    suggested_max_iterations, rationale }
  ```
  - **Cláusula A (contexto do lead) sempre presente** — validado por eval automático.
  - **Resposta da pergunta de oferta dominante vira o caminho default** do prompt; alternativas viram fallback.
  - Tom e exemplos adaptados ao nicho.
- Editor lado-a-lado + campo "Refinar com instrução" → re-chama com `{previous_prompt, refinement}`.

---

## Fase 4 — KB assistida (camada do usuário sobre os padrão)

- A KB padrão (item C) já está lá desde a Fase 1.
- Esta fase adiciona a camada do usuário **na mesma interface**:
  - URL do site → `ai-ingest-url` na home → `suggest_kb_urls` → checklist → `ai-ingest-urls` em lote.
  - Texto colado → `draft_knowledge_base` limpa e estrutura.
  - PDF → reuso `ai-ingest-pdf`.
- `audit_kb` lê padrão + usuário e aponta lacunas adaptadas ao nicho ("Não há nada sobre {oferta dominante} — quer adicionar?").
- Roadmap: marcar R-11 como parcialmente coberto.

---

## Fase 5 — Configurações 2 modos + Test Lab

(Mantida da v2, com adaptações multi-nicho.)

- Leigo: 1 slider "Velocidade ↔ Qualidade" mapeando só o modelo dentro do provider. Demais settings ocultos em defaults.
- Test Lab com 3 abas: chat livre, cenários simulados, evals.
- **Cenários simulados são gerados por nicho** (item D): cliente típico do nicho, com a oferta dominante real do agente.
- Builder simula o cliente, agente em teste responde, Builder dá nota em 4 dimensões + sugere patch.

---

## Fase 6 — Insights + versionamento (= R-21) + polish

(Mantida da v2.)

- `ai_agent_prompt_versions` com snapshot + diff + revert.
- Painel de recomendações (custo, lacunas de KB, degradação).
- Vincular como "Resolvido por Builder Fase 6" no roadmap.

---

## Lacunas conhecidas / fora de escopo desta v3

- KB padrão **por nicho** (clínica, imobiliária, etc.) — só base única genérica por enquanto.
- Manual de boas práticas é um único arquivo global — sem versionamento separado.
- Tradução do wizard para outros idiomas além de PT-BR.

---

## Próximo passo

Aprovado, sigo com a **Fase 1** assim que mudar para build mode:
1. Migration: índice único do Builder + coluna `source_type` em `ai_documents` + backfills + trigger de provisionamento de Builder e KB padrão.
2. Arquivos `builder-knowledge/` (manual vazio aguardando seu conteúdo + 6 docs padrão escritos neutros).
3. Edge `ai-builder` com `ping` + stub de `generate_system_prompt`.
4. Setup card do Builder em `Agents.tsx` com estados e "Testar conexão".
5. Módulo `builder-errors.ts` + banner.

Quando você me passar o **manual de boas práticas**, eu colo em `builder-knowledge/best-practices.md` antes da Fase 3 entrar.
