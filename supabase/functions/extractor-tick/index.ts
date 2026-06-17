// extractor-tick — cron 10 min.
// Lê leads marcados (needs_ai_review=true) e usa a chave OpenAI da clínica (BYOK)
// pra preencher custom fields ainda vazios via gpt-5-nano (structured output / tool calling).
//
// Salvaguardas:
//   - só processa clínicas com openai_status='configured'
//   - respeita manual_lock_until (não sobrescreve)
//   - só preenche campos vazios, a menos que classifier_config.allow_overwrite_filled=true
//     E confidence >= threshold
//   - limites configuráveis: max_messages_per_extraction, max_extractions_per_lead_per_day,
//     daily_budget_extractions
//   - registra cada execução em lead_ai_extraction_runs (uniq (lead_id, message_id, kind))
//   - silenciosamente pula leads que excedam budget (kind=skipped)
//
// Trigger via cron OU via POST manual (force=true, clinic_id, lead_ids).

import { corsHeaders, json, sb } from "../_shared/evolution.ts";
import { calcCostUsd } from "../_shared/ai-pricing.ts";
import { parseFutureDateInTZ } from "../_shared/dates.ts";

// Fuso da clínica. Hoje todas as clínicas operam em America/Sao_Paulo;
// se virar multi-tz, ler de settings/clinics.timezone.
const CLINIC_TZ = "America/Sao_Paulo";
import {
  detectOrigin,
  isTemplateOnly,
  knownCtaLabels,
  type DetectedOrigin,
} from "../_shared/wa-redirect-templates.ts";

interface ClinicCfg {
  manual_lock_minutes: number;
  confidence_threshold: number;
  max_messages_per_extraction: number;
  max_extractions_per_lead_per_day: number;
  daily_budget_extractions: number;
  allow_overwrite_filled: boolean;
  openai_status: string;
  openai_model_text: string;
}

const DEFAULTS: ClinicCfg = {
  manual_lock_minutes: 30,
  confidence_threshold: 0.7,
  max_messages_per_extraction: 8,
  max_extractions_per_lead_per_day: 3,
  daily_budget_extractions: 200,
  allow_overwrite_filled: false,
  openai_status: "empty",
  openai_model_text: "gpt-5-nano",
};

function mergeCfg(raw: any): ClinicCfg {
  return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
}

// JSON schema do tool de extração (Onda 2: cobre B5, B25, B29, B30, B32, B33, I5, I6).
export const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_lead_fields",
    description:
      "Extrai informações estruturadas de uma conversa de WhatsApp entre uma clínica de psiquiatria e um lead. Preencha apenas o que estiver explícito ou claramente subentendido. Use null quando não tiver certeza.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        confidence: { type: "number", description: "Confiança geral na extração (0 a 1)." },

        // ────────── classificação do contato ──────────
        is_administrative_contact: {
          type: ["boolean", "null"],
          description:
            "true quando NÃO é paciente: médico parceiro, hospital/clínica encaminhando paciente, secretária, fornecedor, agência, dono da clínica. Quando true, deixe todos os outros campos null. (Invariante I5)",
        },

        // ────────── interesse / qualificação ──────────
        procedimento_interesse: {
          type: ["string", "null"],
          enum: [
            "cetamina", "emt", "primeira_consulta", "retorno", "seguimento", "terapia",
            "alcoolismo", "hipnoterapia", "depressao", "outro", null,
          ],
          description: "Procedimento que o lead demonstrou interesse (B5).",
        },
        qualificacao: {
          type: ["string", "null"],
          enum: ["interessado", "em_negociacao", "desqualificado", "retorno_reativacao", null],
          description:
            "Estado de qualificação. 'retorno_reativacao' SÓ se o lead esteve inativo ≥14 dias E pediu explicitamente voltar (I8). 'vou pensar e te retorno' durante negociação ativa NÃO conta como retorno (B32).",
        },
        motivo_desqualificacao: {
          type: ["string", "null"],
          enum: [
            "spam_propaganda", "fora_perfil", "sem_interesse",
            "contato_invalido", "duplicado", "outro", null,
          ],
          description:
            "Obrigatório quando qualificacao='desqualificado' (I6). Use 'spam_propaganda' para pitches B2B/cold-outreach (B33). 'fora_perfil' para EMDR ou procedimento não oferecido.",
        },

        // ────────── taxonomia do atendimento (B30) ──────────
        tipo_atendimento: {
          type: ["string", "null"],
          enum: ["consulta_psiquiatria", "consulta_terapia", "sessao_emt", "sessao_cetamina", null],
          description:
            "Tipo do atendimento agendado/em negociação. Use o mapa profissional→modalidade do system prompt (B29, B30). null se não há agendamento.",
        },

        demonstrou_interesse: { type: ["boolean", "null"] },
        tentou_pagamento: { type: ["boolean", "null"] },
        pagamento_confirmado: {
          type: ["boolean", "null"],
          description: "True só se o atendente CONFIRMOU recebimento.",
        },
        pagamento_valor: {
          type: ["number", "null"],
          description: "Valor em R$ (somente número) combinado/pago, se houver.",
        },
        teleconsulta: { type: ["boolean", "null"] },
        origem: {
          type: ["string", "null"],
          enum: [
            "Google - Orgânico", "Google - Ads", "Youtube", "Redes Sociais",
            "Indicação de paciente", "Indicação de Médico", "Indicação de Psicóloga",
            "Indeterminado", null,
          ],
        },
        tentou_agendar: { type: ["boolean", "null"] },
        tipo_agendamento: {
          type: ["string", "null"],
          enum: ["consulta", "procedimento", null],
          description: "Legado — preferir tipo_atendimento (B30). null se não há agendamento confirmado.",
        },
        consulta_agendada_em: {
          type: ["string", "null"],
          description: "Data/hora ISO 8601 da CONSULTA combinada (não use para sessões de procedimento).",
        },
        procedimento_agendado_em: {
          type: ["string", "null"],
          description: "Data/hora ISO 8601 de uma SESSÃO DE PROCEDIMENTO (cetamina, infusão, EMT).",
        },
        status_consulta: {
          type: ["string", "null"],
          enum: ["agendada", "realizada", "no_show", "cancelada", "reagendada", null],
          description:
            "Estado atual da consulta/procedimento (B11). Use 'realizada' SOMENTE com sinais claros pós-atendimento: NF/recibo emitido pela clínica, 'obrigado pela consulta', 'foi excelente o atendimento', 'gostei da sessão', 'estou bem melhor desde a consulta'. 'cancelada' / 'no_show' / 'reagendada' exigem confirmação explícita do lead ou do atendente.",
        },
        nome_preferido: { type: ["string", "null"] },
        observacoes: {
          type: ["string", "null"],
          description: "Observações curtas (até 280 chars) úteis pro atendente.",
        },

        // ────────── F2 (2026-06) — Reestruturação do pipeline ──────────
        interesse_inicial: {
          type: ["string", "null"],
          enum: ["psiquiatria", "psicologia", "emt", "cetamina", "avaliacao", "indefinido", null],
          description:
            "Por qual serviço o lead PROCUROU a clínica na primeira vez. Não muda depois — é o ponto de entrada. 'indefinido' quando o lead só pediu informação genérica.",
        },
        servicos_ativos: {
          type: ["array", "null"],
          items: { type: "string", enum: ["emt", "cetamina", "psiquiatria", "psicologia"] },
          description:
            "Lista do que o lead ESTÁ fazendo hoje (pacote em andamento ou consultas recorrentes). Pode ter mais de um. Vazio quando não há tratamento ativo.",
        },
        tipo_contato: {
          type: ["string", "null"],
          enum: ["paciente", "terceiro_familiar", "b2b", "fornecedor", "imprensa", "outro", null],
          description:
            "Quem é a pessoa do outro lado. 'paciente' = é ele mesmo quem se trata; 'terceiro_familiar' = mãe/filho/cônjuge falando pelo paciente; 'b2b'/'fornecedor'/'imprensa' = não-paciente. Quando ≠ paciente, defina também is_b2b/contato_eh_terceiro corretamente.",
        },
        contato_eh_terceiro: {
          type: ["boolean", "null"],
          description:
            "true SOMENTE quando tipo_contato='terceiro_familiar' (mãe, pai, filho, cônjuge, cuidador falando pelo paciente). Senão false.",
        },
        responsavel: {
          type: ["string", "null"],
          description:
            "Nome do paciente real quando contato_eh_terceiro=true. Ex.: mãe escreve 'minha filha Ana precisa...' → responsavel='Ana'. null caso contrário.",
        },
        risco_clinico: {
          type: ["boolean", "null"],
          description:
            "true quando há sinais claros de ideação suicida, crise aguda, autoflagelação ou pedido explícito de socorro. Frases como 'quero me matar', 'não aguento mais viver', 'penso em desistir', 'me cortei', 'vou acabar com tudo'. Quando true, deixe o atendimento clínico assumir — não tente vender consulta.",
        },
        is_b2b: {
          type: ["boolean", "null"],
          description:
            "true para qualquer contato comercial dirigido à clínica (parceiro, fornecedor, agência, pitch B2B). Espelha is_administrative_contact mas separa B2B real de paciente confuso.",
        },
        saldo_sessoes_pacote: {
          type: ["integer", "null"],
          description:
            "Quantas sessões ainda faltam no pacote ATUAL do paciente (EMT/Cetamina). Preencha quando vir 'faltam X sessões', 'última sessão', 'sessão X de Y'. null se não houver pacote ativo.",
        },
        status_nf_reembolso: {
          type: ["string", "null"],
          enum: ["pendente", "enviada", "nao_aplica", null],
          description:
            "Estado da nota fiscal para reembolso do convênio. 'pendente' = paciente pediu e ainda não foi emitida; 'enviada' = NF já foi mandada; 'nao_aplica' = particular sem reembolso.",
        },
      },
      required: ["confidence"],
    },
  },
} as const;


/**
 * Constrói o system prompt injetando a data atual (B4) e o mapa
 * profissional→modalidade da clínica (D5, B29, B30).
 */
export function buildSystemPrompt(now: Date = new Date()): string {
  // Data formatada em America/Sao_Paulo para evitar drift de fuso (B4)
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(now);
  const iso = now.toISOString();

  return `Você é um extrator de dados de conversas de WhatsApp de uma clínica de psiquiatria (Clínica Ór).

CONTEXTO TEMPORAL (B4):
Hoje é ${fmt} (ISO: ${iso}, fuso America/Sao_Paulo).
Use isso para resolver "amanhã", "segunda que vem", "daqui a duas semanas", etc.

PROCEDIMENTOS OFERECIDOS:
- Infusão de Cetamina → "cetamina"
- EMT (Estimulação Magnética Transcraniana) → "emt"
- Primeira Consulta / Avaliação → "primeira_consulta"
- Retorno / Reavaliação → "retorno"
- Seguimento / Acompanhamento → "seguimento"
- Psicoterapia / Terapia → "terapia"
- Tratamento de Alcoolismo → "alcoolismo"
- Hipnoterapia → "hipnoterapia"
- Tratamento de Depressão → "depressao"

NÃO OFERECIDOS (qualquer menção → qualificacao='desqualificado', motivo_desqualificacao='fora_perfil'):
- EMDR e qualquer outro fora da lista acima.

MAPA PROFISSIONAL → MODALIDADE (Clínica Ór, D5/B29):
- Dr. Ivan / Dr. Ivan Barenboim → consulta_psiquiatria
- Dr. Maísa / Dra Maisa / Psicologa Ana Maisa → consulta_terapia (psicóloga)
- Sem profissional + "cetamina"/"infusão" → sessao_cetamina
- Sem profissional + "EMT"/"estimulação magnética"/"EMTr" → sessao_emt

DESAMBIGUAÇÃO DE "SESSÃO" (B29):
- "sessão com Dr. Maísa" / "sessão com a psicóloga" → consulta_terapia
- "sessão de cetamina"/"infusão" → sessao_cetamina
- "sessão de EMT"/"sessão de estimulação" → sessao_emt
- "sessão" sozinho sem contexto: NÃO chute — use null e baixe a confidence.

CONTATO ADMINISTRATIVO (I5, B33):
SEMPRE preencha is_administrative_contact com booleano explícito (true OU false). NUNCA deixe null.
Marque is_administrative_contact=true E deixe os demais campos null quando ≥2 destes sinais:
- Apresenta-se como médico/psicóloga/secretária/hospital/clínica/agência/fornecedor.
- Está encaminhando outro paciente ("vou mandar a Maria pra vocês").
- Conversa é entre profissionais (interconsulta, parceria, cobrança, agenda interna).
- Pitch B2B / cold-outreach: usa termos como "criei", "desenvolvi", "minha empresa", "posso te mostrar", "demo", "automatizar atendimento", "IA pra clínicas", "marketing", "SEO", "tráfego pago", "CRM", junto com URL/domínio comercial e oferta dirigida à clínica.

Se é PITCH B2B/spam (qualquer pitch comercial dirigido à clínica, mesmo sem se apresentar como empresa):
- is_administrative_contact=true
- qualificacao='desqualificado'
- motivo_desqualificacao='spam_propaganda'
Os TRÊS campos juntos. Não esqueça nenhum (B33).

Caso contrário (paciente real, lead comum): is_administrative_contact=false explicitamente.

REGRAS DE PAGAMENTO (I2):
- pagamento_confirmado=true SÓ se o atendente confirmou recebimento explicitamente.
- Sempre que pagamento_confirmado=true, tentou_pagamento TAMBÉM é true (confirmação implica tentativa). Preencha os dois.
- Lead mandando comprovante sem confirmação do atendente = tentou_pagamento=true, pagamento_confirmado=null.

REGRAS DE AGENDAMENTO:
- tentou_agendar=true SOMENTE quando o lead CONFIRMOU uma CONSULTA. Pedir horário, perguntar disponibilidade ou citar um dia da semana NÃO conta.
- Sempre preencha tipo_atendimento usando o mapa profissional→modalidade acima (B30).
- Se for sessão de procedimento (sessao_emt/sessao_cetamina): preencha procedimento_agendado_em.
- Se for consulta (consulta_psiquiatria/consulta_terapia): preencha consulta_agendada_em.
- Se o lead já tem "procedimentos" preenchido (ex.: "Infusão de cetamina"), o default para agendamentos novos é a sessão correspondente, exceto se a mensagem disser explicitamente "consulta"/"avaliação".
- Data preenchida precisa ser HOJE ou FUTURO (I3). Passado → null.
- Não invente datas. Não infira "semana que vem" sem confirmação.
- FORMATO DE DATA (obrigatório): ISO 8601 "AAAA-MM-DDTHH:mm" SEM sufixo 'Z' e SEM offset (+/-HH:MM). Interprete e devolva sempre em horário LOCAL da clínica (America/Sao_Paulo). O backend converte para UTC. Exemplo: lead diz "amanhã às 18h" e hoje é 14/06/2026 → devolva "2026-06-15T18:00". Nunca devolva "2026-06-15T18:00Z" nem "2026-06-15T18:00-03:00".
- Sem hora explícita → use 12:00 (também em horário local).
- REAGENDAMENTO EXPLÍCITO (B10): sinais como "remarcar", "remarcação", "preciso mudar", "podemos passar pra", "ao invés de", "na verdade vai ser", "mudou pra", "trocar pra".
- REAGENDAMENTO IMPLÍCITO (B10.1 — IMPORTANTE): o atendente propõe data/horário, o lead RECUSA ("nesse dia não", "de manhã não consegue", "à tarde não dá", "quarta sim", "só consigo X"), o atendente propõe NOVA data, o lead ACEITA ("pode ser", "ok", "tá", "fechado", "perfeito", "isso", "online tá", "👍"). Mesmo sem a palavra "remarcar", isto É reagendamento.
- REGRA GERAL: SEMPRE preencha consulta_agendada_em / procedimento_agendado_em com a ÚLTIMA data que o lead aceitou. Ignore datas anteriores que foram recusadas ou substituídas. Se a única data proposta foi recusada e nenhuma nova foi aceita, devolva null (não tente "salvar" a data antiga).
- Se o lead aceitou explicitamente atendimento online ("online tá", "pode ser online", "prefiro online"), preencha teleconsulta=true.

STATUS DA CONSULTA (B11, Onda 6):
- Preencha status_consulta='realizada' quando houver evidência clara de PÓS-ATENDIMENTO: "nota fiscal", "NF emitida", "recibo da consulta", "obrigado pela consulta/sessão", "consulta foi ótima", "gostei do atendimento", "estou bem melhor depois da", "tive a primeira consulta e gostei". Não confunda com sinais ANTES da consulta ("estou ansioso pra consulta").
- Preencha 'cancelada' apenas se houver confirmação explícita ("cancelar a consulta", "não vou poder ir e não quero remarcar").
- Preencha 'reagendada' quando há sinal de remarcação E nova data combinada (use com B10).
- Quando incerto, deixe null. Não infira 'realizada' só porque a data passou (existe cron específico pra isso — D3).

REABRIR ATENDIMENTO FINALIZADO (B24, Onda 6):
- Se o lead já tem status_consulta='realizada' (campo informado em "Contexto do lead") e a conversa traz claramente intenção de NOVO agendamento ("quero remarcar", "quero agendar de novo", "outra sessão", "preciso voltar", "marca outra pra mim"), preencha qualificacao='retorno_reativacao' E tentou_agendar=true. Isso permite que o card saia da coluna de finalizados.


RETORNO/REATIVAÇÃO (I8, B32):
Use qualificacao='retorno_reativacao' quando QUALQUER UMA destas condições for satisfeita:
(1) Há gap explícito ≥14 dias entre a última mensagem do lead e a atual (verifique timestamps/datas se presentes) E o lead retoma a conversa; OU
(2) O lead admite explicitamente que sumiu/ficou ausente E sinaliza retomada (mesmo sem ver timestamps). Frases-chave que disparam isso: "sumi", "fiquei sumido(a)", "sumi um tempo", "fiquei longe", "depois de tanto tempo", "voltei", "demorei pra responder", "fiquei sem responder", combinadas com "quero retomar", "ainda tenho interesse", "vamos marcar", "agora consigo", "posso agendar". Quando o lead já tem procedimentos preenchidos (paciente antigo) e diz "quero retomar" / "próxima infusão depois de sumir", é retorno_reativacao.

Exemplos POSITIVOS (retorno_reativacao):
- "Oi, sumi um tempo mas quero retomar o tratamento" → retorno_reativacao.
- Lead sumiu em janeiro, volta em março: "oi, voltei. ainda tem horário?" → retorno_reativacao.
- "fiquei sem responder, mas agora consigo marcar" → retorno_reativacao.

Exemplos NEGATIVOS (mantém em_negociacao ou interessado):
- "vou pensar e te retorno" dentro da mesma negociação → em_negociacao.
- Lead respondendo no mesmo dia, mesmo dizendo "voltei a pensar" → em_negociacao.
- Lead novo perguntando preço pela primeira vez → interessado (não é retorno).

MENSAGENS-TEMPLATE DO SITE (wa-redirect):
Mensagens que contêm o bloco fixo:
    ---
    *Mantenha esse código na sua mensagem para entrar na fila de atendimento:*
    (ref=XXXXXXXX)
NÃO foram digitadas pelo lead — são templates automáticos disparados pelos CTAs do site
(testes PHQ-9/GAD-7, botões "agendar consulta", páginas de tratamento). CTAs conhecidos:
${knownCtaLabels().join("\n")}

Quando a ÚNICA mensagem do lead é esse template (sem nada digitado depois do "(ref=...)"):
- NÃO preencha tentou_agendar, consulta_agendada_em, procedimento_agendado_em
- NÃO classifique qualificacao — deixe null. Verbos como "gostaria de agendar" NÃO contam aqui.
- Pode preencher procedimento_interesse APENAS quando o CTA mencionar explicitamente
  um procedimento ("tratamento com EMT" → emt; "cetamina"/"escetamina"/"spravato" → cetamina;
  "hipnose"/"hipnoterapia" → hipnoterapia). CTA genérico ("agendar consulta") → null.
- Em observacoes pode anotar "lead veio do CTA <texto>".

Quando o lead manda o template E DEPOIS digita algo próprio (ex.: "oi, quero terça 14h"),
a parte digitada conta normalmente — aplique as regras de qualificação/agendamento sobre ela.

F2 (2026-06) — CAMPOS NOVOS DO PIPELINE REESTRUTURADO:

interesse_inicial — POR QUE o lead procurou a clínica na primeira mensagem:
- "queria consulta com psiquiatra" / "preciso de remédio" → psiquiatria
- "preciso de terapia" / "psicólogo" / "Dra. Maísa" → psicologia
- "tenho interesse em EMT" / "estimulação magnética" → emt
- "cetamina" / "infusão" / "spravato" → cetamina
- "avaliação", "primeira consulta" sem especificar → avaliacao
- só "quanto custa?" / "vocês atendem?" → indefinido

servicos_ativos — o que o paciente JÁ FAZ hoje (pacote em andamento):
- Preencha array com os serviços ATIVOS (ex.: ["cetamina","psiquiatria"]).
- Sinais: "minha próxima infusão", "estou na 3ª sessão de EMT", "sigo com Dr. Ivan", "faço terapia com Maísa".
- Lead novo perguntando preço NÃO tem serviço ativo → null.

tipo_contato + contato_eh_terceiro + responsavel:
- Mãe/pai/filho/cônjuge/cuidador falando pelo paciente → tipo_contato='terceiro_familiar', contato_eh_terceiro=true, responsavel=<nome do paciente real>.
- Pitch B2B (junto com is_b2b=true) → tipo_contato='b2b'.
- Fornecedor/representante de produto → tipo_contato='fornecedor', is_b2b=true.
- Jornalista/imprensa → tipo_contato='imprensa', is_b2b=true.
- Paciente normal falando por si → tipo_contato='paciente', contato_eh_terceiro=false, responsavel=null.

risco_clinico (CAMPO SENSÍVEL):
- true SOMENTE quando o lead expressa risco real: ideação suicida ("quero me matar", "vou acabar com tudo", "não aguento mais viver", "penso em desistir"), autoflagelação ("me cortei", "vontade de me machucar"), crise aguda ("não consigo sair da cama", "estou em surto").
- "estou triste" / "ansiedade está difícil" SOZINHOS não bastam — exige verbo de risco.
- Quando true, NÃO tente vender consulta no observacoes; sinalize "encaminhar para atendimento clínico imediato".

is_b2b — espelha is_administrative_contact mas serve à field-rule nova:
- Sempre que is_administrative_contact=true → is_b2b=true.
- Pitch comercial à clínica (mesmo sem se apresentar como empresa) → is_b2b=true.

saldo_sessoes_pacote (int):
- "última sessão", "faltam 2", "sessão 4 de 6", "acabou meu pacote (=0)" → preencha número exato.
- Sem menção → null. NÃO chute.

status_nf_reembolso:
- "vocês mandam nota fiscal?", "preciso da NF pro reembolso", "convênio pede recibo" sem confirmação → pendente.
- "obrigado pela NF", "recebi a nota" → enviada.
- "é particular mesmo", "não preciso de nota" → nao_aplica.

REGRA FINAL:
- Use null quando não estiver claro. Prefira null a chutar.
- Exceção: is_administrative_contact e (quando pagamento_confirmado=true) tentou_pagamento são SEMPRE explícitos.
- Chame a função extract_lead_fields exatamente uma vez.`;
}

// Mantém SYSTEM_PROMPT como fallback estático (data calculada em runtime no callsite).
const SYSTEM_PROMPT_STATIC_NOTE =
  "// SYSTEM_PROMPT é construído via buildSystemPrompt(now) para injetar data atual (B4).";

interface OpenAIUsage { prompt_tokens?: number; completion_tokens?: number; }
interface OpenAIResp {
  choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
  usage?: OpenAIUsage;
  error?: { message?: string };
}

function modelRejectsTemperature(model: string): boolean {
  // Reasoning models só aceitam temperature default (1). Lista conservadora.
  return /^(gpt-5|gpt-4\.1|o[134])/i.test(model);
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ ok: boolean; data?: OpenAIResp; error?: string; status?: number }> {
  async function doFetch(includeTemperature: boolean) {
    const body: Record<string, unknown> = {
      model,
      messages,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "function", function: { name: "extract_lead_fields" } },
    };
    if (includeTemperature) body.temperature = 0.1;
    return await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
  try {
    let r = await doFetch(!modelRejectsTemperature(model));
    let data = (await r.json()) as OpenAIResp;
    if (!r.ok && /temperature/i.test(data?.error?.message ?? "")) {
      // retry sem temperature
      r = await doFetch(false);
      data = (await r.json()) as OpenAIResp;
    }
    if (!r.ok) {
      return { ok: false, status: r.status, error: data?.error?.message ?? `HTTP ${r.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function extractArgs(data: OpenAIResp): Record<string, unknown> | null {
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc?.function?.arguments) return null;
  try {
    return JSON.parse(tc.function.arguments);
  } catch {
    return null;
  }
}

function fieldIsEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "";
}

/**
 * Normaliza saída do extractor (Onda 2.1) antes do merge.
 * - I5: is_administrative_contact null/undefined → false (modelo costuma omitir).
 * - I2: pagamento_confirmado=true implica tentou_pagamento=true.
 * - B33: motivo='spam_propaganda' força qualificacao='desqualificado'.
 * Idempotente — chamada também pelo eval runner.
 */
export function normalizeExtracted(
  extracted: Record<string, unknown>,
  convo?: string,
  leadName?: string | null,
): Record<string, unknown> {
  const out = { ...extracted };
  if (out.is_administrative_contact === null || out.is_administrative_contact === undefined) {
    out.is_administrative_contact = false;
  }
  if (out.pagamento_confirmado === true && (out.tentou_pagamento === null || out.tentou_pagamento === undefined)) {
    out.tentou_pagamento = true;
  }
  if (out.motivo_desqualificacao === "spam_propaganda" && out.qualificacao !== "desqualificado") {
    out.qualificacao = "desqualificado";
  }
  // B33 — Heurística determinística de pitch B2B / spam (cobre variância do modelo).
  if (convo && detectSpamB2B(convo)) {
    out.is_administrative_contact = true;
    out.qualificacao = "desqualificado";
    out.motivo_desqualificacao = "spam_propaganda";
    out.procedimento_interesse = null;
    out.tipo_atendimento = null;
  }
  // I5/B14/B19 (Onda 5) — Heurística determinística de contato administrativo
  if (out.is_administrative_contact !== true && detectAdministrativeContact(convo ?? "", leadName ?? null)) {
    out.is_administrative_contact = true;
    out.procedimento_interesse = null;
    out.tipo_atendimento = null;
  }
  // B11 (Onda 6) — Heurística determinística de status_consulta='realizada'
  if (convo && !out.status_consulta && detectConsultaRealizada(convo)) {
    out.status_consulta = "realizada";
  }
  // wa-redirect template: lead só mandou o template do site → suprime intenção falsa
  // e marca campo interno `_wa_redirect_origin` para o caller aplicar tag/evento.
  if (convo) {
    const origin = detectWaRedirectOriginFromConvo(convo);
    if (origin && origin.isTemplate) {
      out.tentou_agendar = null;
      out.consulta_agendada_em = null;
      out.procedimento_agendado_em = null;
      out.qualificacao = null;
      // só sobrescreve procedimento_interesse se o CTA dá uma pista clara
      if (origin.procedimento) {
        out.procedimento_interesse = origin.procedimento;
      } else {
        out.procedimento_interesse = null;
      }
      (out as Record<string, unknown>)._wa_redirect_origin = origin;
    }
  }
  return out;
}

/**
 * Inspeciona a conversa serializada ("Lead: ...\nAtendente: ...") e devolve
 * a origem do wa-redirect quando TODAS as mensagens do lead são templates do site.
 * Retorna null caso o lead já tenha digitado algo próprio.
 */
function detectWaRedirectOriginFromConvo(convo: string): DetectedOrigin | null {
  // Reconstroi blocos por orador. Mensagens do lead podem ter múltiplas linhas
  // (template tem \n---\n no meio), por isso não dá pra usar split('\n').
  const lines = convo.split("\n");
  const leadMessages: string[] = [];
  let current: { who: "Lead" | "Atendente" | null; buf: string[] } = { who: null, buf: [] };
  const flush = () => {
    if (current.who === "Lead" && current.buf.length) {
      leadMessages.push(current.buf.join("\n").replace(/^Lead:\s*/i, "").trim());
    }
    current = { who: null, buf: [] };
  };
  for (const ln of lines) {
    if (/^Lead:/i.test(ln)) {
      flush();
      current = { who: "Lead", buf: [ln] };
    } else if (/^Atendente:/i.test(ln)) {
      flush();
      current = { who: "Atendente", buf: [ln] };
    } else {
      current.buf.push(ln);
    }
  }
  flush();
  if (leadMessages.length === 0) return null;
  // Todas as mensagens do lead precisam ser template-only.
  let detected: DetectedOrigin | null = null;
  for (const m of leadMessages) {
    if (!isTemplateOnly(m)) return null;
    const o = detectOrigin(m);
    if (!o.isTemplate) return null;
    // Se mais de um template, prefere o primeiro com procedimento conhecido.
    if (!detected || (!detected.procedimento && o.procedimento)) detected = o;
  }
  return detected;
}


const SPAM_COMMERCIAL_TERMS = [
  "criei", "desenvolvi", "minha empresa", "nossa empresa",
  "posso te mostrar", "agendar uma demo", "agendar uma call", "marcar uma call",
  "reunião rápida", "reuniao rapida", "tenho cases", "case de sucesso",
  "automatiza", "automatizar atendimento", "atendimento automatizado",
  "recepcionista com ia", "recepcionista virtual", "secretária virtual", "secretaria virtual",
  "marketing", "tráfego pago", "trafego pago", "seo", "crm",
  "aumentou conversão", "aumentaram conversão", "aumentaram conversao",
];
const SPAM_CLINIC_TARGETS = [
  "pra clínicas", "para clínicas", "pra clinicas", "para clinicas",
  "pra psicólog", "para psicólog", "pra psicolog", "para psicolog",
  "pra consultórios", "para consultórios", "pra consultorios", "para consultorios",
  "outras clínicas", "outras clinicas",
];
const URL_DOMAIN_RE = /\b[a-z0-9-]+\.(com|com\.br|online|app|io|net|co|me|tech|ai|digital|store)\b/i;

export function detectSpamB2B(convo: string): boolean {
  // Só olha mensagens do lead (linhas que começam com "Lead:") — atendente
  // pode legitimamente usar termos comerciais ao responder ao cliente.
  const leadLines = convo
    .split("\n")
    .filter((l) => /^lead:/i.test(l))
    .join(" ")
    .toLowerCase();
  if (!leadLines) return false;
  let commercial = 0;
  for (const t of SPAM_COMMERCIAL_TERMS) if (leadLines.includes(t)) commercial++;
  let clinicTarget = 0;
  for (const t of SPAM_CLINIC_TARGETS) if (leadLines.includes(t)) clinicTarget++;
  const url = URL_DOMAIN_RE.test(leadLines);
  // Regra: precisa de ≥2 sinais comerciais OU (1 comercial + alvo clínica) OU (1 comercial + URL).
  if (commercial >= 2) return true;
  if (commercial >= 1 && clinicTarget >= 1) return true;
  if (commercial >= 1 && url) return true;
  return false;
}

// I5/B14/B19 (Onda 5) — Heurística determinística para contato administrativo
// (médico parceiro, agência, distribuidora, hospital, fornecedor).
const ADMIN_NAME_TITLE_RE = /^\s*(dr\.?|dra\.?|prof\.?|profa\.?|enf\.?|enfa\.?)\s+\S+/i;
const ADMIN_NAME_ORG_RE = /\b(ag[êe]ncia|distribuidora|distrib\.?|distri\w*med|hospital(ar)?|laborat[óo]rio|farm[áa]cia|farma|comercial|fornecedor|representante|cl[íi]nica|consult[óo]rio)\b/i;
const ADMIN_CONTENT_SIGNALS = [
  "vou encaminhar", "vou mandar pra vocês", "encaminhando paciente", "encaminho paciente",
  "interconsulta", "parceria", "somos representantes", "somos fornecedor", "represento a",
  "sou médic", "sou medic", "sou psicólog", "sou psicolog",
  "sou enfermeir", "sou secretári", "sou secretaria",
  "atendo paciente", "atendo na clínica", "atendo na clinica",
  "minha clínica", "minha clinica", "meu consultório", "meu consultorio",
];



export function detectAdministrativeContact(convo: string, leadName: string | null): boolean {
  // Sinal forte por NOME: título médico/profissional prefixado.
  if (leadName && ADMIN_NAME_TITLE_RE.test(leadName)) return true;
  // Sinal por NOME corporativo + ≥1 sinal de conteúdo (evita "Clínica" sobrenome casual).
  if (leadName && ADMIN_NAME_ORG_RE.test(leadName)) {
    const lower = convo.toLowerCase();
    for (const s of ADMIN_CONTENT_SIGNALS) if (lower.includes(s)) return true;
    // Nome corporativo isolado já indica entidade — mas exige um leve gatekeeper:
    // qualquer menção a "paciente", "encaminh", "parceiro" no conteúdo confirma.
    if (/\b(paciente|encaminh|parceir|fornecedor)/i.test(convo)) return true;
  }
  // Sinal por CONTEÚDO: 2 sinais administrativos na fala do lead.
  const leadLines = convo
    .split("\n").filter((l) => /^lead:/i.test(l)).join(" ").toLowerCase();
  if (leadLines) {
    let hits = 0;
    for (const s of ADMIN_CONTENT_SIGNALS) if (leadLines.includes(s)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}



// B11 (Onda 6) — Detecta sinais inequívocos de PÓS-ATENDIMENTO no que o lead diz.
// Não dispara apenas pelo atendente: o lead precisa expressar que JÁ esteve na consulta.
const REALIZADA_LEAD_PHRASES = [
  "obrigado pela consulta", "obrigada pela consulta",
  "obrigado pela sessão", "obrigada pela sessão", "obrigado pela sessao", "obrigada pela sessao",
  "obrigado pelo atendimento", "obrigada pelo atendimento",
  "consulta foi ótima", "consulta foi otima", "consulta foi excelente", "consulta foi muito boa",
  "sessão foi ótima", "sessao foi otima", "sessão foi excelente", "sessao foi excelente",
  "gostei muito da consulta", "gostei muito do atendimento", "gostei do atendimento",
  "gostei da sessão", "gostei da sessao",
  "tive a primeira consulta", "tive a consulta", "fiz a consulta", "fiz a sessão", "fiz a sessao",
  "estou bem melhor depois da consulta", "estou melhor depois da consulta",
  "depois da nossa consulta", "depois da nossa sessão", "depois da nossa sessao",
];
const REALIZADA_ATTENDANT_PHRASES = [
  "nota fiscal", "nf emitida", "nf enviada", "segue a nota fiscal", "segue a nf",
  "recibo da consulta", "recibo do atendimento", "segue o recibo",
];

export function detectConsultaRealizada(convo: string): boolean {
  const lower = convo.toLowerCase();
  const leadLower = convo
    .split("\n").filter((l) => /^lead:/i.test(l)).join(" ").toLowerCase();
  for (const p of REALIZADA_LEAD_PHRASES) if (leadLower.includes(p)) return true;
  // Atendente mandando NF/recibo só conta se há ≥1 mensagem do lead na conversa
  // (evita falso positivo de modelo de mensagem que ninguém respondeu).
  if (leadLower) {
    for (const p of REALIZADA_ATTENDANT_PHRASES) if (lower.includes(p)) return true;
  }
  return false;
}

function applyFields(
  current: Record<string, unknown>,
  extracted: Record<string, unknown>,
  cfg: ClinicCfg,
  confidence: number,
): { merged: Record<string, unknown>; setKeys: string[] } {
  const merged = { ...current };
  const setKeys: string[] = [];

  // Validação extra: datas precisam ser futuras válidas.
  // Se a IA mandou algo no passado ou inválido, descarta.
  for (const dateKey of ["consulta_agendada_em", "procedimento_agendado_em"] as const) {
    const rawDate = extracted[dateKey];
    if (rawDate !== undefined && rawDate !== null) {
      const valid = parseFutureDateInTZ(rawDate, CLINIC_TZ);
      if (!valid) {
        extracted = { ...extracted, [dateKey]: null };
      } else {
        extracted = { ...extracted, [dateKey]: valid.toISOString() };
      }
    }
  }

  // Se tipo_agendamento=procedimento, garante que não escreve campos de consulta
  if (extracted.tipo_agendamento === "procedimento") {
    extracted = { ...extracted, consulta_agendada_em: null, tentou_agendar: null };
  }
  // Se nenhuma data válida sobrou e tentou_agendar veio só por inferência, zera
  if (
    extracted["tentou_agendar"] === true &&
    !extracted["consulta_agendada_em"] &&
    !extracted["procedimento_agendado_em"]
  ) {
    extracted = { ...extracted, tentou_agendar: null };
  }

  // I6: se desqualificado sem motivo, default 'outro' (evita exceção do trigger)
  if (extracted.qualificacao === "desqualificado" && !extracted.motivo_desqualificacao) {
    extracted = { ...extracted, motivo_desqualificacao: "outro" };
  }

  const writable = [
    "procedimento_interesse",
    "qualificacao",
    "motivo_desqualificacao",
    "tipo_atendimento",
    "demonstrou_interesse",
    "tentou_pagamento",
    "pagamento_confirmado",
    "tentou_agendar",
    "consulta_agendada_em",
    "procedimento_agendado_em",
    "nome_preferido",
    "observacoes",
    "status_consulta",
    // F2 (2026-06)
    "interesse_inicial",
    "servicos_ativos",
    "tipo_contato",
    "contato_eh_terceiro",
    "responsavel",
    "risco_clinico",
    "is_b2b",
    "saldo_sessoes_pacote",
    "status_nf_reembolso",
  ];
  // Threshold mais alto para campos sensíveis (B6: baixado de 0.8 → 0.7)
  const SENSITIVE = new Set(["consulta_agendada_em", "procedimento_agendado_em", "tentou_agendar"]);
  // B10.1 — Reagendamento: campos de agenda/teleconsulta SEMPRE seguem o estado
  // mais recente da conversa; se a IA detectou uma data diferente da atual com
  // confiança suficiente, sobrescreve mesmo sem allow_overwrite_filled.
  // manual_lock_until ainda protege contra correções manuais recentes.
  const RESCHEDULE_TRACKED = new Set([
    "consulta_agendada_em",
    "procedimento_agendado_em",
    "tentou_agendar",
    "tipo_atendimento",
    "teleconsulta",
    "status_consulta",
  ]);
  const sensitiveThreshold = Math.max(0.7, cfg.confidence_threshold);

  for (const k of writable) {
    const newVal = extracted[k];
    if (newVal === undefined || newVal === null) continue;
    if (SENSITIVE.has(k) && confidence < sensitiveThreshold) continue;
    const isEmpty = fieldIsEmpty(current[k]);
    const canOverwrite =
      (cfg.allow_overwrite_filled && confidence >= cfg.confidence_threshold) ||
      (RESCHEDULE_TRACKED.has(k) && confidence >= sensitiveThreshold && current[k] !== newVal);
    if (isEmpty || canOverwrite) {
      if (merged[k] !== newVal) {
        merged[k] = newVal;
        setKeys.push(k);
      }
    }
  }
  return { merged, setKeys };
}


// Mapeia procedimento_interesse (enum interno) para os labels das opções
// que costumam aparecer nos campos custom da clínica.
const PROC_TO_INTERESSE_LABEL: Record<string, string[]> = {
  cetamina: ["Infusão de Cetamina", "Infusão de cetamina"],
  emt: ["EMT"],
  primeira_consulta: ["Consulta com psiquiatria", "Primeira Consulta"],
  retorno: ["Retorno"],
  seguimento: ["Consulta de seguimento"],
  terapia: ["Psicoterapia", "Sessão de terapia"],
};
const PROC_TO_PROCEDIMENTO_LABEL: Record<string, string[]> = {
  cetamina: ["Infusão de cetamina"],
  emt: ["EMT"],
  primeira_consulta: ["Primeira Consulta"],
  retorno: ["Retorno"],
  seguimento: ["Consulta de seguimento"],
  terapia: ["Sessão de terapia"],
};

interface CustomFieldDef {
  field_key: string;
  field_type: string;
  label: string;
  options: string[] | null;
}

function pickOption(candidates: string[], options: string[] | null): string | null {
  if (!options || options.length === 0) return candidates[0] ?? null;
  for (const c of candidates) {
    const found = options.find((o) => o.toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  return null;
}

// Traduz chaves internas extraídas para os field_keys reais da clínica.
// Só preenche campos vazios (nunca sobrescreve algo já preenchido manualmente).
function applyClinicFieldMapping(
  merged: Record<string, unknown>,
  extracted: Record<string, unknown>,
  defs: CustomFieldDef[],
): string[] {
  const setKeys: string[] = [];
  const byKey = new Map(defs.map((d) => [d.field_key, d]));
  const setIfEmpty = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    if (!fieldIsEmpty(merged[key])) return;
    merged[key] = value;
    setKeys.push(key);
  };

  const proc = extracted.procedimento_interesse as string | null | undefined;

  // interesse (select)
  const interesseDef = byKey.get("interesse");
  if (interesseDef && proc) {
    const candidates = PROC_TO_INTERESSE_LABEL[proc] ?? [];
    const opt = pickOption(candidates, interesseDef.options);
    if (opt) setIfEmpty("interesse", opt);
  }

  // procedimentos (multiselect)
  const procDef = byKey.get("procedimentos");
  if (procDef && proc) {
    const candidates = PROC_TO_PROCEDIMENTO_LABEL[proc] ?? [];
    const opt = pickOption(candidates, procDef.options);
    if (opt && fieldIsEmpty(merged["procedimentos"])) {
      merged["procedimentos"] = [opt];
      setKeys.push("procedimentos");
    }
  }

  // data_horario (datetime) — recebe a data de procedimento se houver, senão consulta
  if (byKey.has("data_horario")) {
    const validProc = parseFutureDateInTZ(extracted.procedimento_agendado_em, CLINIC_TZ);
    const validCons = parseFutureDateInTZ(extracted.consulta_agendada_em, CLINIC_TZ);
    const chosen = validProc ?? validCons;
    if (chosen) setIfEmpty("data_horario", chosen.toISOString());
  }

  // procedimento_agendado_em (datetime) — campo dedicado de sessão de procedimento
  if (byKey.has("procedimento_agendado_em")) {
    const valid = parseFutureDateInTZ(extracted.procedimento_agendado_em, CLINIC_TZ);
    if (valid) setIfEmpty("procedimento_agendado_em", valid.toISOString());
  }


  // teleconsulta (boolean)
  if (byKey.has("teleconsulta") && typeof extracted.teleconsulta === "boolean") {
    setIfEmpty("teleconsulta", extracted.teleconsulta);
  }

  // pagamento (currency)
  if (byKey.has("pagamento") && typeof extracted.pagamento_valor === "number" && extracted.pagamento_valor > 0) {
    setIfEmpty("pagamento", extracted.pagamento_valor);
  }

  // origem (select)
  const origemDef = byKey.get("origem");
  if (origemDef && typeof extracted.origem === "string") {
    const opt = pickOption([extracted.origem], origemDef.options);
    if (opt) setIfEmpty("origem", opt);
  }

  // mensagem (textarea) — usa observacoes
  if (byKey.has("mensagem")) {
    setIfEmpty("mensagem", extracted.observacoes);
  }

  return setKeys;
}

interface LeadRow {
  id: string;
  clinic_id: string;
  custom_fields: Record<string, unknown> | null;
  manual_lock_until: string | null;
  ai_review_reasons: string[] | null;
  ai_review_queued_at: string | null;
  name: string | null;
  phone: string;
  is_internal_contact: boolean;
  tags: string[] | null;
}

async function processClinic(clinicId: string, cfg: ClinicCfg, leadIds?: string[], force?: boolean) {
  const supabase = sb();

  // 1) carrega a chave
  const { data: keyData } = await supabase.rpc("get_openai_key", { _clinic_id: clinicId });
  const apiKey = typeof keyData === "string" ? keyData : null;
  if (!apiKey) return { clinic_id: clinicId, processed: 0, skipped: 0, error: "no_key" };

  // 2) budget diário
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: usedToday } = await supabase
    .from("lead_ai_extraction_runs")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("kind", "text")
    .gte("created_at", since);
  const used = usedToday ?? 0;
  const remaining = Math.max(0, cfg.daily_budget_extractions - used);
  if (remaining === 0) {
    return { clinic_id: clinicId, processed: 0, skipped: 0, error: "daily_budget_exhausted" };
  }

  // 2.1) defs de custom fields da clínica (pra mapear chaves IA -> chaves visíveis)
  const { data: fieldDefsRaw } = await supabase
    .from("lead_custom_fields")
    .select("field_key, field_type, label, options")
    .eq("clinic_id", clinicId);
  const fieldDefs = (fieldDefsRaw ?? []) as CustomFieldDef[];

  // 3) leads da fila
  const leadsQ = supabase
    .from("leads")
    .select("id, clinic_id, custom_fields, manual_lock_until, ai_review_reasons, ai_review_queued_at, name, phone, is_internal_contact, tags")
    .eq("clinic_id", clinicId)
    .order("ai_review_queued_at", { ascending: true, nullsFirst: false })
    .limit(Math.min(remaining, 30));
  // Em runs forçadas com lead_ids explícitos, ignora a flag needs_ai_review
  if (!(force && leadIds?.length)) leadsQ.eq("needs_ai_review", true);
  // I5: nunca extrair em contatos administrativos/B2B (a menos que force+lead_ids explícitos)
  if (!(force && leadIds?.length)) leadsQ.eq("is_internal_contact", false);
  if (leadIds?.length) leadsQ.in("id", leadIds);

  const { data: leads, error: leadsErr } = await leadsQ;
  if (leadsErr) return { clinic_id: clinicId, error: leadsErr.message };
  if (!leads || leads.length === 0) return { clinic_id: clinicId, processed: 0, skipped: 0 };

  let processed = 0;
  let skipped = 0;
  const now = new Date();
  const nowIso = now.toISOString();

  for (const lead of leads as LeadRow[]) {
    // manual lock
    if (lead.manual_lock_until && new Date(lead.manual_lock_until) > now) {
      // mantém na fila e segue
      skipped++;
      continue;
    }

    // limite diário por lead
    const { count: perLeadToday } = await supabase
      .from("lead_ai_extraction_runs")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("kind", "text")
      .gte("created_at", since);
    if ((perLeadToday ?? 0) >= cfg.max_extractions_per_lead_per_day) {
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        kind: "skipped",
        skipped_reason: "per_lead_daily_limit",
      });
      // tira da fila pra não ficar girando
      await supabase
        .from("leads")
        .update({ needs_ai_review: false })
        .eq("id", lead.id);
      skipped++;
      continue;
    }

    // últimas N mensagens (inbound + outbound) pra contexto
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, from_me, content, message_type, transcript, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(cfg.max_messages_per_extraction);

    const ordered = (msgs ?? []).reverse();
    const lastMessageId = ordered.length ? ordered[ordered.length - 1].id : null;

    const convo = ordered
      .map((m) => {
        const who = m.from_me ? "Atendente" : "Lead";
        let txt = (m.content ?? "").trim();
        if (!txt && m.transcript) txt = `[áudio transcrito]: ${m.transcript}`;
        if (!txt && m.message_type) txt = `[${m.message_type}]`;
        return `${who}: ${txt}`;
      })
      .join("\n");

    if (!convo.trim()) {
      skipped++;
      continue;
    }

    // B3: custom_fields em prosa (não JSON cru) — modelo se confunde com aspas/brackets
    const cf = (lead.custom_fields ?? {}) as Record<string, unknown>;
    const cfLines: string[] = [];
    if (Array.isArray(cf.procedimentos) && cf.procedimentos.length) {
      cfLines.push(`- Procedimentos já registrados: ${(cf.procedimentos as unknown[]).join(", ")}`);
    }
    if (cf.interesse) cfLines.push(`- Interesse atual: ${cf.interesse}`);
    if (cf.tipo_atendimento) cfLines.push(`- Tipo de atendimento atual: ${cf.tipo_atendimento}`);
    if (cf.qualificacao) cfLines.push(`- Qualificação atual: ${cf.qualificacao}`);
    if (cf.pagamento_confirmado === true) cfLines.push(`- Pagamento já confirmado`);
    const cfBlock = cfLines.length
      ? `Contexto do lead (campos já preenchidos):\n${cfLines.join("\n")}\n\n`
      : "";

    const userPrompt =
      `${cfBlock}Conversa (mais antiga em cima, mais recente embaixo):\n\n${convo}\n\nExtraia.`;

    const r = await callOpenAI(apiKey, cfg.openai_model_text, [
      { role: "system", content: buildSystemPrompt(now) },
      { role: "user", content: userPrompt },
    ]);

    if (!r.ok) {
      // erro -> registra mas não estoura
      await supabase.from("lead_ai_extraction_runs").insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        message_id: lastMessageId,
        kind: "text",
        model: cfg.openai_model_text,
        error: r.error?.slice(0, 500),
      });
      // se a chave deu 401, atualiza status
      if (r.status === 401) {
        await supabase
          .from("clinic_secrets")
          .update({ openai_status: "invalid", openai_last_error: r.error?.slice(0, 240) ?? "401", openai_last_checked_at: nowIso })
          .eq("clinic_id", clinicId);
        return { clinic_id: clinicId, processed, skipped, error: "invalid_key" };
      }
      skipped++;
      continue;
    }

    const extracted = normalizeExtracted(extractArgs(r.data!) ?? {}, convo, lead.name);
    const confidence = typeof extracted.confidence === "number" ? Number(extracted.confidence) : 0;
    const { merged, setKeys } = applyFields(
      lead.custom_fields ?? {},
      extracted,
      cfg,
      confidence,
    );
    // mapping para field_keys reais da clínica (interesse, procedimentos, etc.)
    const mappedKeys = applyClinicFieldMapping(merged, extracted, fieldDefs);
    const allSetKeys = Array.from(new Set([...setKeys, ...mappedKeys]));

    const tokensIn = r.data?.usage?.prompt_tokens ?? 0;
    const tokensOut = r.data?.usage?.completion_tokens ?? 0;
    const cost = calcCostUsd(cfg.openai_model_text, tokensIn, tokensOut) ?? 0;

    // grava run
    await supabase.from("lead_ai_extraction_runs").insert({
      clinic_id: lead.clinic_id,
      lead_id: lead.id,
      message_id: lastMessageId,
      kind: "text",
      model: cfg.openai_model_text,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: cost,
      fields_set: allSetKeys.reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = merged[k];
        return acc;
      }, {}),
      confidence,
    });

    // atualiza o lead
    const update: Record<string, unknown> = {
      needs_ai_review: false,
      ai_review_queued_at: null,
      ai_review_reasons: [],
    };
    if (allSetKeys.length) update.custom_fields = merged;
    // I5/B33: extractor sinalizou contato administrativo → marca a flag estrutural
    if (extracted.is_administrative_contact === true && !lead.is_internal_contact) {
      update.is_internal_contact = true;
    }

    // wa-redirect: aplica tag de origem do CTA se detectado.
    const waOrigin = (extracted as Record<string, unknown>)._wa_redirect_origin as
      | DetectedOrigin
      | undefined;
    let tagsAddedForWaRedirect: string | null = null;
    if (waOrigin?.isTemplate && waOrigin.tag) {
      const currentTags = Array.isArray(lead.tags) ? lead.tags : [];
      if (!currentTags.includes(waOrigin.tag)) {
        update.tags = [...currentTags, waOrigin.tag];
        tagsAddedForWaRedirect = waOrigin.tag;
      }
    }

    await supabase.from("leads").update(update).eq("id", lead.id);

    // evento auditável
    if (allSetKeys.length) {
      await supabase.from("lead_events").insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        type: "ai_fields_extracted",
        payload: {
          fields: allSetKeys,
          confidence,
          model: cfg.openai_model_text,
          message_id: lastMessageId,
          cost_usd: cost,
        },
      });
    }
    if (waOrigin?.isTemplate) {
      await supabase.from("lead_events").insert({
        clinic_id: lead.clinic_id,
        lead_id: lead.id,
        type: "wa_redirect_template_detected",
        payload: {
          tag: waOrigin.tag,
          cta: waOrigin.cta,
          procedimento: waOrigin.procedimento,
          tag_added: tagsAddedForWaRedirect !== null,
          message_id: lastMessageId,
        },
      });
    }

    processed++;
  }

  return { clinic_id: clinicId, processed, skipped };
}

interface Body {
  clinic_id?: string;
  lead_ids?: string[];
  force?: boolean;
}

if (import.meta.main) Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { /* cron sem body */ }
  }

  const supabase = sb();

  // Lista de clínicas com chave configurada
  let q = supabase
    .from("clinic_secrets")
    .select("clinic_id, openai_status, clinics:clinic_id(classifier_config)");
  if (body.clinic_id) q = q.eq("clinic_id", body.clinic_id);

  const { data: secrets, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results: any[] = [];
  for (const s of (secrets ?? []) as any[]) {
    if (s.openai_status !== "configured" && !body.force) continue;
    const cfg = mergeCfg((s.clinics?.classifier_config));
    if (cfg.openai_status !== "configured" && !body.force) {
      // status no clinics.classifier_config pode estar dessincronizado, mas
      // confiamos no secrets.openai_status acima
    }
    const r = await processClinic(s.clinic_id, cfg, body.lead_ids, body.force);
    results.push(r);
  }

  return json({ ok: true, results });
});
